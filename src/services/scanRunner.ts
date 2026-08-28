import {
  ScanConfig,
  ScanResult,
  WorkerStatus,
  ProgressMetrics,
  LogEntry,
  ExploreMode,
} from '../types/scanner';

export const COMMON_SUBDOMAINS: string[] = [
  'mail', 'ftp', 'webmail', 'smtp', 'pop', 'imap',
  'cpanel', 'admin', 'dev', 'test', 'stage', 'blog',
  'vpn', 'ns1', 'ns2', 'dns', 'portal', 'api',
  'support', 'shop'
];

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
  private config: ScanConfig;
  private targetUrls: string[] = [];
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private abortController: AbortController | null = null;

  private results: ScanResult[] = [];
  private workerStatuses: Map<number, WorkerStatus> = new Map();
  private currentIndex: number = 0;
  private startTime: number = 0;
  private pauseStartTime: number = 0;
  private totalPausedMs: number = 0;

  private successCount: number = 0;
  private rateLimitedCount: number = 0;
  private errorCount: number = 0;

  // Callbacks
  public onProgress?: (metrics: ProgressMetrics) => void;
  public onWorkerUpdate?: (worker: WorkerStatus) => void;
  public onResult?: (result: ScanResult) => void;
  public onLog?: (log: LogEntry) => void;
  public onComplete?: (results: ScanResult[]) => void;

  constructor(config: ScanConfig, rawTargets: string[]) {
    this.config = config;
    this.targetUrls = expandTargetMatrix(
      rawTargets,
      config.protocols,
      config.subdomains,
      config.explore
    );

    for (let i = 1; i <= config.workers; i++) {
      this.workerStatuses.set(i, {
        id: i,
        state: 'idle',
        totalProcessed: 0,
      });
    }
  }

  public getExpandedTargetCount(): number {
    return this.targetUrls.length;
  }

  public getTargetUrls(): string[] {
    return this.targetUrls;
  }

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

  private emitMetrics(isBackingOff: boolean = false, backoffSeconds: number = 0) {
    const processed = this.currentIndex;
    const total = this.targetUrls.length;
    const percentage = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

    const now = Date.now();
    const activeElapsedMs = (now - this.startTime) - this.totalPausedMs;
    const elapsedSeconds = Math.max(0, Math.floor(activeElapsedMs / 1000));
    
    const ratePerSec = elapsedSeconds > 0 ? Number((processed / elapsedSeconds).toFixed(2)) : 0;
    const remaining = Math.max(0, total - processed);
    const etaSeconds = ratePerSec > 0 ? Math.ceil(remaining / ratePerSec) : 0;

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

  private updateWorker(id: number, update: Partial<WorkerStatus>) {
    const current = this.workerStatuses.get(id) || { id, state: 'idle', totalProcessed: 0 };
    const updated = { ...current, ...update };
    this.workerStatuses.set(id, updated);
    this.onWorkerUpdate?.(updated);
  }

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

    const workerPromises: Promise<void>[] = [];
    for (let w = 1; w <= this.config.workers; w++) {
      workerPromises.push(this.runWorker(w));
    }

    await Promise.all(workerPromises);

    this.isRunning = false;
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

  public pause(): void {
    if (!this.isRunning || this.isPaused) return;
    this.isPaused = true;
    this.pauseStartTime = Date.now();
    this.addLog('warn', '⏸️ Scan execution paused by user.');
  }

  public resume(): void {
    if (!this.isRunning || !this.isPaused) return;
    this.isPaused = false;
    this.totalPausedMs += Date.now() - this.pauseStartTime;
    this.addLog('info', '▶️ Scan execution resumed.');
  }

  public stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.isPaused = false;
    if (this.abortController) {
      this.abortController.abort();
    }
    for (let w = 1; w <= this.config.workers; w++) {
      this.updateWorker(w, { state: 'idle', currentTarget: undefined });
    }
    this.addLog('error', '🛑 Scan terminated by user.');
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async handlePause(): Promise<void> {
    while (this.isPaused && this.isRunning) {
      await this.sleep(200);
    }
  }

  private async runWorker(workerId: number): Promise<void> {
    while (this.isRunning) {
      await this.handlePause();
      if (!this.isRunning) break;

      let targetUrl: string | null = null;
      let targetIndex = 0;

      // Lock-free index pickup
      if (this.currentIndex < this.targetUrls.length) {
        targetIndex = this.currentIndex;
        targetUrl = this.targetUrls[this.currentIndex++];
      } else {
        break;
      }

      if (!targetUrl) break;

      this.updateWorker(workerId, {
        state: 'submitting',
        currentTarget: targetUrl,
      });

      this.addLog('info', `[Worker #${workerId}] Dispatching: ${targetUrl}`, workerId);

      // Stagger delay if configured
      if (this.config.delay > 0) {
        await this.sleep(this.config.delay * 1000);
      }

      const reqStart = Date.now();
      let result: ScanResult;

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

  private async simulateSubmit(
    workerId: number,
    targetUrl: string,
    startTime: number
  ): Promise<ScanResult> {
    // Realistic mock latency 250ms - 800ms
    const latency = Math.floor(Math.random() * 550) + 250;
    await this.sleep(latency);

    // Occasional simulated 429 rate limit (5% chance) to showcase evasive backoff UI
    const isRateLimited = Math.random() < 0.05;
    const isError = !isRateLimited && Math.random() < 0.03;

    const domain = targetUrl.replace(/^[a-zA-Z]+:\/\//, '');

    if (isRateLimited) {
      const backoffSecs = Math.floor(Math.random() * 3) + 2;
      this.updateWorker(workerId, {
        state: 'backoff',
        backoffRemaining: backoffSecs,
      });
      this.emitMetrics(true, backoffSecs);

      // Count down the backoff
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

  private async realSubmit(
    workerId: number,
    targetUrl: string,
    startTime: number
  ): Promise<ScanResult> {
    const domain = targetUrl.replace(/^[a-zA-Z]+:\/\//, '');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers['API-Key'] = this.config.apiKey;
    }

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
      const res = await fetch('https://urlscan.io/api/v1/scan/', {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: this.abortController?.signal,
      });

      const latencyMs = Date.now() - startTime;

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

      if (res.status === 429) {
        const resetHeader = res.headers.get('X-Rate-Limit-Reset-After') || res.headers.get('Retry-After');
        const backoffSecs = resetHeader ? parseInt(resetHeader, 10) + 1 : 10;

        this.updateWorker(workerId, {
          state: 'backoff',
          backoffRemaining: backoffSecs,
        });
        this.emitMetrics(true, backoffSecs);

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

