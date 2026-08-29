/**
 * Client-Side Scan Runner: Local Parallel URL Scanning Engine
 * 
 * Provides a multi-threaded URL scanner that runs locally in the browser.
 * Supports both real submissions to urlscan.io and simulated mode for testing.
 * 
 * Key features:
 * - Configurable worker threads for parallel URL processing
 * - Rate-limit detection and automatic exponential backoff
 * - URL expansion with subdomain enumeration (basic/deep/massive modes)
 * - Progress tracking, pause/resume, and cancellation
 * - Real-time worker status updates and detailed logging
 */

import {
  ScanConfig,
  ScanResult,
  WorkerStatus,
  ProgressMetrics,
  LogEntry,
  ExploreMode,
} from '../types/scanner';

/**
 * Common subdomains for basic reconnaissance enumeration
 * (mail, ftp, admin, dev, api, etc.)
 */
export const COMMON_SUBDOMAINS: string[] = [
  'mail', 'ftp', 'webmail', 'smtp', 'pop', 'imap',
  'cpanel', 'admin', 'dev', 'test', 'stage', 'blog',
  'vpn', 'ns1', 'ns2', 'dns', 'portal', 'api',
  'support', 'shop'
];

/**
 * Extended subdomain list for deeper reconnaissance
 * (auth, login, dashboard, git, monitoring, staging, etc.)
 */
export const DEEP_SUBDOMAINS: string[] = [
  ...COMMON_SUBDOMAINS,
  'auth', 'login', 'secure', 'dashboard', 'billing',
  'app', 'mobile', 'cdn', 'static', 'assets',
  'git', 'gitlab', 'github', 'jenkins', 'ci',
  'status', 'monitor', 'grafana', 'kibana', 'prometheus',
  'beta', 'alpha', 'demo', 'staging', 'preview',
  'docs', 'help', 'kb', 'forum', 'community',
  'db', 'sql', 'mysql', 'redis', 'elastic',
  'ws', 'graphql', 'rest', 'gateway', 'proxy'
];

/**
 * Comprehensive subdomain list for aggressive reconnaissance
 * (SSO, intranet, internal systems, payment, webhooks, logs, chat services, etc.)
 */
export const MASSIVE_SUBDOMAINS: string[] = [
  ...DEEP_SUBDOMAINS,
  'sso', 'idp', 'oauth', 'saml', 'ldap', 'radius',
  'intranet', 'internal', 'corp', 'staff', 'employee',
  'remote', 'connect', 'access', 'gateway2', 'direct',
  'pay', 'payment', 'checkout', 'cart', 'store',
  'webhook', 'hooks', 'events', 'pubsub', 'kafka',
  'sandbox', 'lab', 'poc', 'uat', 'dr',
  'logs', 'metrics', 'audit', 'telemetry', 'trace',
  'media', 'images', 'img', 'video', 'files',
  'download', 'dl', 'repo', 'registry', 'npm',
  'mx', 'relay', 'postfix', 'sendgrid', 'mailer',
  'chat', 'meet', 'zoom', 'slack', 'jira', 'confluence'
];

/**
 * Expands a list of base target domains into a full enumeration matrix.
 * 
 * Generates all combination of:
 * - Protocols: http, https, or both
 * - Subdomains: root domain, www, and optionally enumerated subdomains
 * - Explore modes: 'basic' (common), 'deep' (extended), 'massive' (comprehensive)
 * 
 * @param baseTargets - Array of domain names or URLs (leading schemes and paths stripped)
 * @param protocols - Which protocols to include ('https', 'http', or 'both')
 * @param subdomains - Which subdomains to include ('root', 'www', or 'both')
 * @param explore - Subdomain enumeration depth ('none', 'basic', 'deep', or 'massive')
 * @returns Array of fully expanded target URLs (deduplicated as Set)
 * 
 * @example
 * expandTargetMatrix(['example.com'], 'https', 'both', 'basic')
 * // Returns: ['https://example.com', 'https://www.example.com', 'https://mail.example.com', ...]
 */
export function expandTargetMatrix(
  baseTargets: string[],
  protocols: 'https' | 'http' | 'both',
  subdomains: 'root' | 'www' | 'both',
  explore: ExploreMode
): string[] {
  const schemeList = protocols === 'both' ? ['https', 'http'] : [protocols];
  const results = new Set<string>();

  for (const raw of baseTargets) {
    let clean = raw.trim();
    if (!clean || clean.startsWith('#')) continue;
    // Strip leading schemes if present
    clean = clean.replace(/^[a-zA-Z]+:\/\//, '').replace(/\/.*$/, '');

    const subs: string[] = [];
    if (subdomains === 'root' || subdomains === 'both') {
      subs.push('');
    }
    if (subdomains === 'www' || subdomains === 'both') {
      subs.push('www.');
    }

    if (explore === 'basic') {
      for (const s of COMMON_SUBDOMAINS) subs.push(`${s}.`);
    } else if (explore === 'deep') {
      for (const s of DEEP_SUBDOMAINS) subs.push(`${s}.`);
    } else if (explore === 'massive') {
      for (const s of MASSIVE_SUBDOMAINS) subs.push(`${s}.`);
    }

    for (const prefix of subs) {
      const fqdn = `${prefix}${clean}`;
      for (const scheme of schemeList) {
        results.add(`${scheme}://${fqdn}`);
      }
    }
  }

  return Array.from(results);
}

export class ClientScanRunner {
  // Scan configuration and target URLs
  private config: ScanConfig;
  private targetUrls: string[] = [];
  
  // Execution state: running, paused, stopped
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;

  // Results collection and worker state
  private results: ScanResult[] = [];
  private workerStatuses: Map<number, WorkerStatus> = new Map();
  
  // Progress tracking: thread-safe index pickup and timing metrics
  private currentIndex: number = 0;
  private startTime: number = 0;
  private pauseStartTime: number = 0;
  private totalPausedMs: number = 0;

  // Result tallies: success, rate-limited, error outcomes
  private successCount: number = 0;
  private rateLimitedCount: number = 0;
  private errorCount: number = 0;

  // Event callbacks for UI updates and logging
  public onProgress?: (metrics: ProgressMetrics) => void;
  public onWorkerUpdate?: (worker: WorkerStatus) => void;
  public onResult?: (result: ScanResult) => void;
  public onLog?: (log: LogEntry) => void;
  public onComplete?: (results: ScanResult[]) => void;

  /**
   * Initializes a new client-side scan runner.
   * 
   * Expands raw target inputs into a full URL matrix based on protocols,
   * subdomain options, and exploration modes. Initializes worker status
   * tracking for the configured thread count.
   * 
   * @param config - Scan configuration (workers, engine mode, delays, etc.)
   * @param rawTargets - Array of domain inputs (will be expanded via expandTargetMatrix)
   */
  constructor(config: ScanConfig, rawTargets: string[]) {
    this.config = config;
    this.targetUrls = expandTargetMatrix(
      rawTargets,
      config.protocols,
      config.subdomains,
      config.explore
    );

    // Initialize worker status for each thread
    for (let i = 1; i <= config.workers; i++) {
      this.workerStatuses.set(i, {
        id: i,
        state: 'idle',
        totalProcessed: 0,
      });
    }
  }

  /**
   * Returns the count of expanded target URLs after matrix generation.
   */
  public getExpandedTargetCount(): number {
    return this.targetUrls.length;
  }

  /**
   * Returns the full list of expanded target URLs.
   */
  public getTargetUrls(): string[] {
    return this.targetUrls;
  }

  /**
   * Logs a message to the activity log with timestamp and optional worker ID.
   * 
   * @param level - Log level ('info', 'success', 'warn', 'error')
   * @param message - Human-readable log message
   * @param workerId - Optional worker ID for worker-specific logging
   */
  private addLog(level: LogEntry['level'], message: string, workerId?: number) {
    const entry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      level,
      workerId,
      message,
    };
    this.onLog?.(entry);
  }

  /**
   * Calculates and emits current progress metrics.
   * 
   * Metrics include:
   * - Processed count and percentage completion
   * - Rate (submissions per second) and estimated time remaining
   * - Result tallies: success, rate-limited, error counts
   * - Active worker count
   * - Backoff state if any worker is backing off from rate limit
   * 
   * Time calculations exclude pause durations to show only active processing time.
   * 
   * @param isBackingOff - Whether the scan is currently backed off due to rate limit
   * @param backoffSeconds - Remaining backoff time in seconds (0 if not backed off)
   */
  private emitMetrics(isBackingOff: boolean = false, backoffSeconds: number = 0) {
    const processed = this.currentIndex;
    const total = this.targetUrls.length;
    const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

    // Calculate elapsed time excluding pause durations
    const now = Date.now();
    const activeElapsedMs = (now - this.startTime) - this.totalPausedMs;
    const elapsedSeconds = Math.max(0, Math.floor(activeElapsedMs / 1000));
    
    // Calculate rate and ETA
    const ratePerSec = elapsedSeconds > 0 ? Number((processed / elapsedSeconds).toFixed(2)) : 0;
    const remaining = Math.max(0, total - processed);
    const etaSeconds = ratePerSec > 0 ? Math.ceil(remaining / ratePerSec) : 0;

    // Count active workers (submitting or backing off)
    const activeWorkersCount = Array.from(this.workerStatuses.values()).filter(
      (w) => w.state === 'submitting' || w.state === 'backoff'
    ).length;

    const metrics: ProgressMetrics = {
      total,
      processed,
      percentage,
      ratePerSec,
      elapsedSeconds,
      etaSeconds,
      counts: {
        success: this.successCount,
        rateLimited: this.rateLimitedCount,
        error: this.errorCount,
      },
      activeWorkers: activeWorkersCount,
      isBackingOff,
      backoffSeconds,
    };

    this.onProgress?.(metrics);
  }

  /**
   * Updates worker status and broadcasts the updated state to listeners.
   * 
   * @param id - Worker ID
   * @param update - Partial worker status object (will be merged with current state)
   */
  private updateWorker(id: number, update: Partial<WorkerStatus>) {
    const current = this.workerStatuses.get(id) || { id, state: 'idle', totalProcessed: 0 };
    const updated = { ...current, ...update };
    this.workerStatuses.set(id, updated);
    this.onWorkerUpdate?.(updated);
  }

  /**
   * Starts the scan with all worker threads.
   * 
   * Initializes execution state, spawns worker threads, and waits for all to complete.
   * Each worker independently picks up the next target URL using an atomic currentIndex
   * increment (lock-free thread safety). Emits progress updates and logs after each submission.
   * 
   * @returns Promise resolving to the complete array of scan results
   */
  public async start(): Promise<ScanResult[]> {
    if (this.isRunning) return this.results;
    this.isRunning = true;
    this.isPaused = false;
    this.abortController = new AbortController();
    this.startTime = Date.now();
    this.totalPausedMs = 0;
    this.currentIndex = 0;
    this.results = [];
    this.successCount = 0;
    this.rateLimitedCount = 0;
    this.errorCount = 0;

    this.addLog(
      'info',
      `🚀 Initialized scan: ${this.targetUrls.length} targets across ${this.config.workers} worker threads (${this.config.engine.toUpperCase()} mode).`
    );

    this.emitMetrics();

    // Spawn all worker threads
    const workerPromises: Promise<void>[] = [];
    for (let w = 1; w <= this.config.workers; w++) {
      workerPromises.push(this.runWorker(w));
    }

    // Wait for all workers to complete
    await Promise.all(workerPromises);

    this.isRunning = false;
    // Mark all workers as completed
    for (let w = 1; w <= this.config.workers; w++) {
      this.updateWorker(w, { state: 'completed', currentTarget: undefined });
    }

    this.emitMetrics();
    this.addLog(
      'success',
      `🏁 Scan complete! Total: ${this.targetUrls.length} | Success: ${this.successCount} | Rate-Limited: ${this.rateLimitedCount} | Errors: ${this.errorCount}`
    );
    this.onComplete?.(this.results);
    return this.results;
  }

  /**
   * Pauses the scan execution without terminating worker threads.
   * 
   * Workers remain alive but block in handlePause() until resume() is called.
   * Enables pause/resume without losing state.
   */
  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.pauseStartTime = Date.now();
    this.addLog('warn', '⏸️ Scan execution paused by user.');
  }

  /**
   * Resumes the scan after pause.
   * 
   * Accumulated pause duration is tracked and excluded from timing calculations
   * to ensure accurate rate and ETA metrics.
   */
  public resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.totalPausedMs += Date.now() - this.pauseStartTime;
    this.addLog('info', '▶️ Scan execution resumed.');
  }

  /**
   * Terminates the scan immediately.
   * 
   * Aborts all worker threads, clears their active state, and stops accepting new submissions.
   */
  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.isPaused = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    // Reset all workers to idle
    for (let w = 1; w <= this.config.workers; w++) {
      this.updateWorker(w, { state: 'idle', currentTarget: undefined });
    }
    this.addLog('error', '🛑 Scan terminated by user.');
  }

  /**
   * Utility: sleep/delay.
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Blocks a worker until pause is released.
   * 
   * Called by runWorker during pause cycles. Workers poll isPaused
   * and yield CPU time while paused.
   */
  private async handlePause(): Promise<void> {
    while (this.isPaused && this.isRunning) {
      await this.sleep(200);
    }
  }

  /**
   * Worker thread main loop.
   * 
   * Each worker:
   * 1. Waits for pause to be released
   * 2. Atomically picks up the next target URL via this.currentIndex++
   * 3. Submits the URL (real or simulated based on config.engine)
   * 4. Collects result and emits callbacks
   * 5. Repeats until all URLs are claimed or scan is stopped
   * 
   * Lock-free: Workers use atomic increment of currentIndex without explicit locks.
   * If currentIndex >= targetUrls.length, worker exits.
   * 
   * @param workerId - Unique worker identifier (1 to config.workers)
   */
  private async runWorker(workerId: number): Promise<void> {
    while (this.isRunning) {
      await this.handlePause();
      if (!this.isRunning) break;

      let targetUrl: string | null = null;
      let targetIndex = 0;

      // Lock-free target pickup: increment currentIndex atomically
      if (this.currentIndex < this.targetUrls.length) {
        targetIndex = this.currentIndex;
        targetUrl = this.targetUrls[this.currentIndex++];
      } else {
        // All targets claimed by some worker; exit
        break;
      }

      if (!targetUrl) break;

      this.updateWorker(workerId, {
        state: 'submitting',
        currentTarget: targetUrl,
      });

      this.addLog('info', `[Worker #${workerId}] Dispatching: ${targetUrl}`, workerId);

      // Apply configured delay between submissions (if configured)
      if (this.config.delay > 0) {
        await this.sleep(this.config.delay * 1000);
      }

      const reqStart = Date.now();
      let result: ScanResult;

      // Route to simulation or real submission based on engine mode
      if (this.config.engine === 'simulation') {
        result = await this.simulateSubmit(workerId, targetUrl, reqStart);
      } else {
        result = await this.realSubmit(workerId, targetUrl, reqStart);
      }

      this.results.push(result);
      const workerStatus = this.workerStatuses.get(workerId);
      this.updateWorker(workerId, {
        totalProcessed: (workerStatus?.totalProcessed || 0) + 1,
      });

      // Update tallies and emit result-specific logs
      if (result.status === 'success') {
        this.successCount++;
        this.addLog(
          'success',
          `[Worker #${workerId}] ✅ 200 OK: ${targetUrl} (UUID: ${result.uuid?.substring(0, 8)}... | ${result.latencyMs}ms)`,
          workerId
        );
      } else if (result.status === 'rate_limited') {
        this.rateLimitedCount++;
        this.addLog(
          'warn',
          `[Worker #${workerId}] ⚠️ 429 Rate-Limited on ${targetUrl}. Backing off...`,
          workerId
        );
      } else {
        this.errorCount++;
        this.addLog(
          'error',
          `[Worker #${workerId}] ❌ Error submitting ${targetUrl}: ${result.errorMessage || 'Unknown failure'}`,
          workerId
        );
      }

      this.onResult?.(result);
      this.emitMetrics();
    }

    this.updateWorker(workerId, {
      state: 'idle',
      currentTarget: undefined,
    });
  }

  /**
   * Simulates a URL submission without hitting the real urlscan.io API.
   * 
   * Provides realistic mock behavior for UI testing:
   * - Random latency: 250-800ms
   * - 5% chance of rate limit (429) with 2-4 second backoff countdown
   * - 3% chance of error (502/DNS/timeout)
   * - Otherwise returns success with mock UUID
   * 
   * This allows developers to test the UI without hitting real API limits
   * or consuming API quota during development.
   * 
   * @param workerId - Worker ID for logging
   * @param targetUrl - URL being submitted
   * @param startTime - Request start timestamp for latency calculation
   * @returns Mock ScanResult
   */
  private async simulateSubmit(
    workerId: number,
    targetUrl: string,
    startTime: number
  ): Promise<ScanResult> {
    // Realistic mock latency: 250-800ms
    const latency = Math.floor(Math.random() * 550) + 250;
    await this.sleep(latency);

    // Simulate occasional 429 rate limits (5% chance) to showcase backoff UI
    const isRateLimited = Math.random() < 0.05;
    const isError = !isRateLimited && Math.random() < 0.03;

    const domain = targetUrl.replace(/^[a-zA-Z]+:\/\//, '');

    // 429 Rate Limit response with backoff countdown
    if (isRateLimited) {
      const backoffSecs = Math.floor(Math.random() * 3) + 2;
      this.updateWorker(workerId, {
        state: 'backoff',
        backoffRemaining: backoffSecs,
      });
      this.emitMetrics(true, backoffSecs);

      // Count down backoff timer (simulating Retry-After)
      for (let s = backoffSecs; s > 0; s--) {
        if (!this.isRunning) break;
        this.updateWorker(workerId, { backoffRemaining: s });
        await this.sleep(1000);
      }

      return {
        id: Math.random().toString(36).substring(2, 9),
        target: domain,
        url: targetUrl,
        status: 'rate_limited',
        statusCode: 429,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toLocaleTimeString(),
        workerId,
        errorMessage: 'Rate limit exceeded (429). Worker auto-backed off.',
        visibility: this.config.visibility,
      };
    }

    // 502/Error response
    if (isError) {
      return {
        id: Math.random().toString(36).substring(2, 9),
        target: domain,
        url: targetUrl,
        status: 'error',
        statusCode: 502,
        latencyMs: Date.now() - startTime,
        timestamp: new Date().toLocaleTimeString(),
        workerId,
        errorMessage: 'DNS resolution failed or upstream gateway timeout',
        visibility: this.config.visibility,
      };
    }

    // Success response with mock UUID (v4 format)
    const mockUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    return {
      id: Math.random().toString(36).substring(2, 9),
      target: domain,
      url: targetUrl,
      status: 'success',
      statusCode: 200,
      uuid: mockUuid,
      resultUrl: `https://urlscan.io/result/${mockUuid}/`,
      latencyMs: Date.now() - startTime,
      timestamp: new Date().toLocaleTimeString(),
      workerId,
      visibility: this.config.visibility,
      tags: this.config.tags,
    };
  }

  /**
   * Submits a URL to the real urlscan.io API via the Node.js backend.
   * 
   * Constructs a JSON payload with optional API key, visibility, tags, and custom headers.
   * Handles rate-limit responses (429) by extracting Retry-After and entering backoff state.
   * Parses UUID from response Location header.
   * 
   * @param workerId - Worker ID for logging
   * @param targetUrl - URL being submitted
   * @param startTime - Request start timestamp for latency calculation
   * @returns Real or error ScanResult
   */
  private async realSubmit(
    workerId: number,
    targetUrl: string,
    startTime: number
  ): Promise<ScanResult> {
    const domain = targetUrl.replace(/^[a-zA-Z]+:\/\//, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

   // Add API key if configured
   if (this.config.apiKey) {
     headers['API-Key'] = this.config.apiKey;
   }

   // Build scan payload with optional metadata
   const payload: Record<string, any> = {
     url: targetUrl,
     visibility: this.config.visibility,
   };

   if (this.config.tags && this.config.tags.length > 0) {
     payload.tags = this.config.tags;
   }
   if (this.config.country) {
     payload.country = this.config.country;
   }
   if (this.config.userAgent) {
     payload.customagent = this.config.userAgent;
   }
   if (this.config.referer) {
     payload.referer = this.config.referer;
   }

   try {
     // POST to real urlscan.io API
     const res = await fetch('https://urlscan.io/api/v1/scan/', {
       method: 'POST',
       headers,
       body: JSON.stringify(payload),
       signal: this.abortController?.signal,
     });

     const latencyMs = Date.now() - startTime;

     // 200 OK: Successful submission
     if (res.status === 200) {
       const data = await res.json();
       return {
         id: Math.random().toString(36).substring(2, 9),
         target: domain,
         url: targetUrl,
         status: 'success',
         statusCode: 200,
         uuid: data.uuid,
         resultUrl: data.result || `https://urlscan.io/result/${data.uuid}/`,
         latencyMs,
         timestamp: new Date().toLocaleTimeString(),
         workerId,
         visibility: this.config.visibility,
         tags: this.config.tags,
       };
     }

     // 429 Rate Limit: Extract backoff time from Retry-After or X-Rate-Limit-Reset-After header
     if (res.status === 429) {
       const resetHeader = res.headers.get('X-Rate-Limit-Reset-After') || res.headers.get('Retry-After');
       const backoffSecs = resetHeader ? parseInt(resetHeader, 10) + 1 : 10;

       this.updateWorker(workerId, {
         state: 'backoff',
         backoffRemaining: backoffSecs,
       });
       this.emitMetrics(true, backoffSecs);

       // Count down backoff timer
       for (let s = backoffSecs; s > 0; s--) {
         if (!this.isRunning) break;
         this.updateWorker(workerId, { backoffRemaining: s });
         await this.sleep(1000);
       }

       return {
         id: Math.random().toString(36).substring(2, 9),
         target: domain,
         url: targetUrl,
         status: 'rate_limited',
         statusCode: 429,
         latencyMs,
         timestamp: new Date().toLocaleTimeString(),
         workerId,
         errorMessage: `HTTP 429 Rate Limit (waited ${backoffSecs}s)`,
         visibility: this.config.visibility,
       };
     }

     // Other HTTP errors (4xx, 5xx)
     const errText = await res.text();
     return {
       id: Math.random().toString(36).substring(2, 9),
       target: domain,
       url: targetUrl,
       status: 'error',
       statusCode: res.status,
       latencyMs,
       timestamp: new Date().toLocaleTimeString(),
       workerId,
       errorMessage: `HTTP ${res.status}: ${errText.substring(0, 100)}`,
       visibility: this.config.visibility,
     };
   } catch (err: any) {
     // Network errors, abort, fetch failures, etc.
     return {
       id: Math.random().toString(36).substring(2, 9),
       target: domain,
       url: targetUrl,
       status: 'error',
       latencyMs: Date.now() - startTime,
       timestamp: new Date().toLocaleTimeString(),
       workerId,
       errorMessage: err.message || 'Network / Fetch request failed',
       visibility: this.config.visibility,
     };
   }
  }
}

