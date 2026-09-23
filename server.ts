/**
 * urlscan-submitter Backend Server
 * 
 * Express.js server providing REST API endpoints for:
 * - Health checks and configuration validation
 * - Dataset discovery, sampling, and statistical analysis
 * - Scan session management with Server-Sent Events (SSE) streaming
 * - Rate-limit resilient URL submission to urlscan.io
 */

import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Enable CORS for all origins (local development)
// Allows frontend running on different port to make API requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, API-Key');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Directory containing scan datasets and results
// Directories containing scan datasets and results
const DATASET_DIRS = [
  path.resolve(__dirname), // current repository root (domains.txt, gov.ru.txt, etc.)
  path.resolve(__dirname, '../scans'), // scans directory (pages.dev, etc.)
];
const SCANS_DIR = path.resolve(__dirname, '../scans');

/**
 * Locate a dataset file across known search directories
 */
function findDatasetFile(filename: string): string | null {
  for (const dir of DATASET_DIRS) {
    const candidate = path.join(dir, filename);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

/**
 * Load urlscan.io API key from environment or local api_key.txt
 */
function getLocalApiKey(): string {
  if (process.env.URLSCAN_API_KEY) {
    return process.env.URLSCAN_API_KEY.trim();
  }
  const keyFile = path.resolve(__dirname, 'api_key.txt');
  if (fs.existsSync(keyFile)) {
    try {
      return fs.readFileSync(keyFile, 'utf-8').trim();
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Calculate Shannon entropy of a string to measure randomness/uniformity
 * Used to analyze domain name patterns in datasets
 * Higher entropy = more random/diverse character distribution
 */
function calculateEntropy(text: string): number {
  if (!text) return 0;
  const freq: Record<string, number> = {};
  for (const c of text) {
    freq[c] = (freq[c] || 0) + 1;
  }
  const len = text.length;
  let entropy = 0;
  for (const count of Object.values(freq)) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Submit target URL to urlscan.io REST API
 */
async function submitToUrlscan(targetUrl: string, config: any, apiKey: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'API-Key': apiKey,
  };

  const payload: Record<string, any> = {
    url: targetUrl,
    visibility: config.visibility || 'public',
  };
  if (config.tags && Array.isArray(config.tags) && config.tags.length > 0) {
    payload.tags = config.tags;
  }
  if (config.country) {
    payload.country = config.country;
  }
  if (config.userAgent) {
    payload.customagent = config.userAgent;
  }
  if (config.referer) {
    payload.referer = config.referer;
  }

  const startTime = Date.now();
  const res = await fetch('https://urlscan.io/api/v1/scan/', {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const latencyMs = Date.now() - startTime;
  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  return {
    status: res.status,
    headers: res.headers,
    data,
    latencyMs,
  };
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * Health check endpoint
 * Returns server status and configuration details
 * GET /api/health
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', serverTime: new Date().toISOString(), scansDirExists: fs.existsSync(SCANS_DIR) });
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    scansDirExists: DATASET_DIRS.some((d) => fs.existsSync(d)),
    hasApiKey: Boolean(getLocalApiKey()),
  });
});

/**
 * List all available datasets in the scans directory
 * Local API key retrieval endpoint for localhost dashboard
 * GET /api/key
 */
app.get('/api/key', (_req: Request, res: Response) => {
  res.json({ apiKey: getLocalApiKey() });
});

/**
 * List all available datasets in repo and scans directory
 * Returns metadata for each file (name, path, size, modification time)
 * GET /api/datasets
 */
app.get('/api/datasets', (_req: Request, res: Response) => {
  try {
    if (!fs.existsSync(SCANS_DIR)) {
      res.json([]);
      return;
    const seen = new Set<string>();
    const datasets: any[] = [];
    const ignoredFiles = new Set(['api_key.txt', 'requirements.txt', 'license.txt', 'package.json', 'package-lock.json', 'tsconfig.json']);

    for (const dir of DATASET_DIRS) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (seen.has(f) || ignoredFiles.has(f.toLowerCase())) continue;
        if (f.endsWith('.dev') || f.endsWith('.txt') || f.endsWith('.csv') || f === 'pages.dev') {
          const fullPath = path.join(dir, f);
          const stats = fs.statSync(fullPath);
          if (stats.isFile()) {
            seen.add(f);
            datasets.push({
              filename: f,
              path: fullPath,
              sizeBytes: stats.size,
              modified: stats.mtime,
            });
          }
        }
      }
    }
    const files = fs.readdirSync(SCANS_DIR);
    const datasets = files
      .filter((f) => f.endsWith('.dev') || f.endsWith('.txt') || f.endsWith('.csv') || f === 'pages.dev')
      .map((f) => {
        const fullPath = path.join(SCANS_DIR, f);
        const stats = fs.statSync(fullPath);
        return {
          filename: f,
          path: fullPath,
          sizeBytes: stats.size,
          modified: stats.mtime,
        };
      });
    res.json(datasets);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Fetch a sample of lines from a dataset file
 * Useful for preview/inspection without loading entire file
 * GET /api/datasets/sample?file=pages.dev&limit=50
 * GET /api/datasets/sample?file=domains.txt&limit=50
 */
app.get('/api/datasets/sample', (req: Request, res: Response) => {
  try {
    const filename = (req.query.file as string) || 'pages.dev';
    const filename = (req.query.file as string) || 'domains.txt';
    const limit = parseInt(req.query.limit as string, 10) || 50;
    const targetFile = path.join(SCANS_DIR, filename);
    const targetFile = findDatasetFile(filename);

    if (!fs.existsSync(targetFile)) {
    if (!targetFile) {
      res.status(404).json({ error: `File not found: ${filename}` });
      return;
    }

    const content = fs.readFileSync(targetFile, 'utf-8');
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .slice(0, limit);

    res.json({
      file: filename,
      count: lines.length,
      sample: lines,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Compute and return detailed statistics for a dataset
 * Analyzes domain patterns, entropy, length metrics, and classification
 * Useful for reconnaissance and dataset characterization
 * GET /api/datasets/stats?file=pages.dev
 * GET /api/datasets/stats?file=domains.txt
 */
app.get('/api/datasets/stats', (req: Request, res: Response) => {
  try {
    const filename = (req.query.file as string) || 'pages.dev';
    const targetFile = path.join(SCANS_DIR, filename);
    const filename = (req.query.file as string) || 'domains.txt';
    const targetFile = findDatasetFile(filename);

    if (!fs.existsSync(targetFile)) {
    if (!targetFile) {
      res.status(404).json({ error: `File not found: ${filename}` });
      return;
    }

    const content = fs.readFileSync(targetFile, 'utf-8');
    const rawLines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    // Count unique vs duplicate entries
    const totalRecords = rawLines.length;
    const uniqueDomains = Array.from(new Set(rawLines));
    const duplicates = totalRecords - uniqueDomains.length;

    // Classify domains (.pages.dev vs external)
    const pagesDevDomains = uniqueDomains.filter((d) => d.endsWith('.pages.dev'));
    const otherDomains = uniqueDomains.filter((d) => !d.endsWith('.pages.dev'));

    // Compute length metrics
    const lengths = uniqueDomains.map((d) => d.length);
    const minLen = lengths.length ? Math.min(...lengths) : 0;
    const maxLen = lengths.length ? Math.max(...lengths) : 0;
    const avgLen = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;

    // Compute entropy metrics
    let totalEntropy = 0;
    for (const d of uniqueDomains) {
      totalEntropy += calculateEntropy(d);
    }
    const avgEntropy = uniqueDomains.length ? totalEntropy / uniqueDomains.length : 0;

    // Analyze domain structure (prefix patterns, hyphens, etc.)
    const firstCharDist: Record<string, number> = {};
    const firstTwoChars: Record<string, number> = {};
    const hyphenCounts: Record<string, number> = {};

    for (const d of pagesDevDomains) {
      const prefix = d.replace(/\.pages\.dev$/, '');
      if (prefix.length > 0) {
        const c1 = prefix[0];
    for (const d of uniqueDomains) {
      const clean = d.replace(/^[a-zA-Z]+:\/\//, '').replace(/\/.*$/, '');
      if (clean.length > 0) {
        const c1 = clean[0];
        firstCharDist[c1] = (firstCharDist[c1] || 0) + 1;
        if (prefix.length >= 2) {
          const c2 = prefix.substring(0, 2);
        if (clean.length >= 2) {
          const c2 = clean.substring(0, 2);
          firstTwoChars[c2] = (firstTwoChars[c2] || 0) + 1;
        }
      }
      const hyphens = (prefix.match(/-/g) || []).length;
      const hyphens = (clean.match(/-/g) || []).length;
      hyphenCounts[hyphens] = (hyphenCounts[hyphens] || 0) + 1;
    }

    res.json({
      file_path: filename,
      total_records: totalRecords,
      unique_records: uniqueDomains.length,
      duplicates,
      classification: {
        pages_dev_count: pagesDevDomains.length,
        pages_dev_pct: (pagesDevDomains.length / (uniqueDomains.length || 1)) * 100,
        external_count: otherDomains.length,
        external_pct: (otherDomains.length / (uniqueDomains.length || 1)) * 100,
        external_samples: otherDomains.slice(0, 10),
      },
      length_metrics: {
        min: minLen,
        max: maxLen,
        average: parseFloat(avgLen.toFixed(2)),
      },
      entropy_metrics: {
        average_shannon_entropy: parseFloat(avgEntropy.toFixed(3)),
      },
      structure: {
        first_char_distribution: firstCharDist,
        top_prefix_stems: firstTwoChars,
        hyphen_distribution: hyphenCounts,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Browser Proxy Submission endpoint
 * Overcomes CORS restrictions for browser clients calling urlscan.io
 * POST /api/scan/proxy-submit
 */
app.post('/api/scan/proxy-submit', async (req: Request, res: Response) => {
  const { url, config, apiKey: clientKey } = req.body;
  if (!url) {
    res.status(400).json({ error: 'url is required' });
    return;
  }
  const keyToUse = clientKey || config?.apiKey || getLocalApiKey();
  if (!keyToUse) {
    res.status(400).json({ error: 'API key is required. None found in request, api_key.txt, or environment.' });
    return;
  }

  try {
    const result = await submitToUrlscan(url, config || {}, keyToUse);
    res.status(result.status).json(result.data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ============================================================================
// SCAN SESSION MANAGEMENT (Server-Sent Events)
// ============================================================================

/**
 * Backend scan session: tracks in-memory state for a single scan operation
 * Maintains config, targets, status, and SSE response stream
 */
interface BackendScanSession {
  id: string;
  config: any;
  targets: string[];
  status: 'running' | 'completed' | 'stopped';
  resStream?: Response;
  startTime: number;
}

// Active scan sessions stored in-memory (lost on server restart)
const activeSessions = new Map<string, BackendScanSession>();

/**
 * Initiate a new scan session with specified configuration and targets
 * Returns a sessionId for tracking progress via SSE
 * POST /api/scan/start
 */
app.post('/api/scan/start', (req: Request, res: Response) => {
  const { config, targets } = req.body;
  if (!targets || !Array.isArray(targets) || targets.length === 0) {
    res.status(400).json({ error: 'targets array is required and must not be empty' });
    return;
  }

  const sessionId = Math.random().toString(36).substring(2, 12);
  const session: BackendScanSession = {
    id: sessionId,
    config: config || {},
    targets,
    status: 'running',
    startTime: Date.now(),
  };

  activeSessions.set(sessionId, session);
  res.json({ sessionId, targetCount: targets.length });
});

/**
 * Server-Sent Events endpoint for live scan progress streaming
 * Sends real-time updates on worker status, scan results, and progress
 * GET /api/scan/stream/:sessionId
 */
app.get('/api/scan/stream/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Scan session not found' });
    return;
  }

  // Configure headers for SSE streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  session.resStream = res;

  // Helper function to send SSE formatted events
  const sendEvent = (eventType: string, data: any) => {
    res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial session metadata
  sendEvent('init', {
    sessionId,
    total: session.targets.length,
    workers: session.config.workers || 4,
    startTime: session.startTime,
  });

  // Backend worker loop that processes targets
  const total = session.targets.length;
  const workers = session.config.workers || 4;
  const delaySec = session.config.delay || 0.5;
  let processed = 0;
  let successCount = 0;
  let rateLimitedCount = 0;
  let errorCount = 0;

  const runWorkerLoop = async () => {
    let index = 0;
    const workerStatus: Record<number, any> = {};

    for (let w = 1; w <= workers; w++) {
      workerStatus[w] = { id: w, state: 'idle', totalProcessed: 0 };
    }

    const effectiveApiKey = session.config.apiKey || getLocalApiKey();
    const isSimulation = session.config.engine === 'simulation' || !effectiveApiKey;

    const workerTasks = Array.from({ length: workers }, async (_, wIdx) => {
      const workerId = wIdx + 1;

      while (session.status === 'running' && index < total) {
        const target = session.targets[index++];
        if (!target) break;

        sendEvent('worker_update', {
          workerId,
          state: 'submitting',
          currentTarget: target,
        });

        sendEvent('log', {
          level: 'info',
          workerId,
          message: `[Worker #${workerId}] Submitting ${target}`,
          timestamp: new Date().toLocaleTimeString(),
        });

        // Delay & mock request execution
        await new Promise((r) => setTimeout(r, Math.max(150, delaySec * 1000)));
        // Delay between submissions
        if (delaySec > 0) {
          await new Promise((r) => setTimeout(r, Math.max(100, delaySec * 1000)));
        }

        const isRateLimited = Math.random() < 0.05;
        const isError = !isRateLimited && Math.random() < 0.02;
        const latencyMs = Math.floor(Math.random() * 400) + 150;
        const mockUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
        });
        if (isSimulation) {
          // Simulation / Mock mode
          const isRateLimited = Math.random() < 0.05;
          const isError = !isRateLimited && Math.random() < 0.02;
          const latencyMs = Math.floor(Math.random() * 400) + 150;
          const mockUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (Math.random() * 16) | 0;
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
          });

        processed++;
          processed++;

        if (isRateLimited) {
          rateLimitedCount++;
          sendEvent('worker_update', {
            workerId,
            state: 'backoff',
            backoffRemaining: 3,
            currentTarget: target,
          });
          sendEvent('scan_result', {
            id: Math.random().toString(36).substring(2, 9),
            target,
            url: `https://${target}`,
            status: 'rate_limited',
            statusCode: 429,
            latencyMs,
            timestamp: new Date().toLocaleTimeString(),
            workerId,
            errorMessage: 'HTTP 429 Rate Limit encountered (Backing off)',
          });
          await new Promise((r) => setTimeout(r, 2000));
        } else if (isError) {
          errorCount++;
          sendEvent('scan_result', {
            id: Math.random().toString(36).substring(2, 9),
            target,
            url: `https://${target}`,
            status: 'error',
            statusCode: 500,
            latencyMs,
            timestamp: new Date().toLocaleTimeString(),
            workerId,
            errorMessage: 'Upstream server error (500)',
          });
          if (isRateLimited) {
            rateLimitedCount++;
            sendEvent('worker_update', {
              workerId,
              state: 'backoff',
              backoffRemaining: 3,
              currentTarget: target,
            });
            sendEvent('scan_result', {
              id: Math.random().toString(36).substring(2, 9),
              target,
              url: target.startsWith('http') ? target : `https://${target}`,
              status: 'rate_limited',
              statusCode: 429,
              latencyMs,
              timestamp: new Date().toLocaleTimeString(),
              workerId,
              errorMessage: 'HTTP 429 Rate Limit encountered (Backing off)',
            });
            await new Promise((r) => setTimeout(r, 2000));
          } else if (isError) {
            errorCount++;
            sendEvent('scan_result', {
              id: Math.random().toString(36).substring(2, 9),
              target,
              url: target.startsWith('http') ? target : `https://${target}`,
              status: 'error',
              statusCode: 500,
              latencyMs,
              timestamp: new Date().toLocaleTimeString(),
              workerId,
              errorMessage: 'Upstream server error (500)',
            });
          } else {
            successCount++;
            sendEvent('scan_result', {
              id: Math.random().toString(36).substring(2, 9),
              target,
              url: target.startsWith('http') ? target : `https://${target}`,
              status: 'success',
              statusCode: 200,
              uuid: mockUuid,
              resultUrl: `https://urlscan.io/result/${mockUuid}/`,
              latencyMs,
              timestamp: new Date().toLocaleTimeString(),
              workerId,
            });
          }
        } else {
          successCount++;
          sendEvent('scan_result', {
            id: Math.random().toString(36).substring(2, 9),
            target,
            url: `https://${target}`,
            status: 'success',
            statusCode: 200,
            uuid: mockUuid,
            resultUrl: `https://urlscan.io/result/${mockUuid}/`,
            latencyMs,
            timestamp: new Date().toLocaleTimeString(),
            workerId,
          });
          // Real urlscan.io submission
          const targetUrl = target.startsWith('http://') || target.startsWith('https://')
            ? target
            : `https://${target}`;
          const domain = target.replace(/^[a-zA-Z]+:\/\//, '').replace(/\/.*$/, '');

          try {
            const resp = await submitToUrlscan(targetUrl, session.config, effectiveApiKey);
            processed++;

            if (resp.status === 200 && resp.data?.uuid) {
              successCount++;
              sendEvent('scan_result', {
                id: Math.random().toString(36).substring(2, 9),
                target: domain,
                url: targetUrl,
                status: 'success',
                statusCode: 200,
                uuid: resp.data.uuid,
                resultUrl: resp.data.result || `https://urlscan.io/result/${resp.data.uuid}/`,
                latencyMs: resp.latencyMs,
                timestamp: new Date().toLocaleTimeString(),
                workerId,
              });
              sendEvent('log', {
                level: 'info',
                workerId,
                message: `[Worker #${workerId}] ✅ 200 OK: ${targetUrl} (UUID: ${resp.data.uuid.substring(0, 8)}... | ${resp.latencyMs}ms)`,
                timestamp: new Date().toLocaleTimeString(),
              });
            } else if (resp.status === 429) {
              rateLimitedCount++;
              const resetHeader = resp.headers.get('x-rate-limit-reset-after') || resp.headers.get('retry-after');
              const backoffSec = resetHeader ? Math.max(1, parseInt(resetHeader, 10) || 5) : 5;
              sendEvent('worker_update', {
                workerId,
                state: 'backoff',
                backoffRemaining: backoffSec,
                currentTarget: target,
              });
              sendEvent('scan_result', {
                id: Math.random().toString(36).substring(2, 9),
                target: domain,
                url: targetUrl,
                status: 'rate_limited',
                statusCode: 429,
                latencyMs: resp.latencyMs,
                timestamp: new Date().toLocaleTimeString(),
                workerId,
                errorMessage: `HTTP 429: ${resp.data?.message || 'Rate limit exceeded'} (backing off ${backoffSec}s)`,
              });
              sendEvent('log', {
                level: 'warn',
                workerId,
                message: `[Worker #${workerId}] ⚠️ Rate limit encountered. Backing off for ${backoffSec}s...`,
                timestamp: new Date().toLocaleTimeString(),
              });
              await new Promise((r) => setTimeout(r, backoffSec * 1000));
            } else {
              errorCount++;
              const errorMsg = resp.data?.message || resp.data?.description || `HTTP ${resp.status}`;
              sendEvent('scan_result', {
                id: Math.random().toString(36).substring(2, 9),
                target: domain,
                url: targetUrl,
                status: 'error',
                statusCode: resp.status,
                latencyMs: resp.latencyMs,
                timestamp: new Date().toLocaleTimeString(),
                workerId,
                errorMessage: errorMsg,
              });
              sendEvent('log', {
                level: 'error',
                workerId,
                message: `[Worker #${workerId}] ❌ Error submitting ${targetUrl}: ${errorMsg}`,
                timestamp: new Date().toLocaleTimeString(),
              });
            }
          } catch (err: any) {
            processed++;
            errorCount++;
            sendEvent('scan_result', {
              id: Math.random().toString(36).substring(2, 9),
              target: domain,
              url: targetUrl,
              status: 'error',
              statusCode: 500,
              latencyMs: 0,
              timestamp: new Date().toLocaleTimeString(),
              workerId,
              errorMessage: err.message || 'Network error submitting to urlscan.io',
            });
            sendEvent('log', {
              level: 'error',
              workerId,
              message: `[Worker #${workerId}] ❌ Network error for ${targetUrl}: ${err.message}`,
              timestamp: new Date().toLocaleTimeString(),
            });
          }
        }

        const elapsedSec = Math.max(1, Math.floor((Date.now() - session.startTime) / 1000));
        const ratePerSec = Number((processed / elapsedSec).toFixed(2));
        const remaining = total - processed;
        const etaSeconds = ratePerSec > 0 ? Math.ceil(remaining / ratePerSec) : 0;

        sendEvent('progress', {
          total,
          processed,
          percentage: Math.min(100, Math.round((processed / total) * 100)),
          ratePerSec,
          elapsedSeconds: elapsedSec,
          etaSeconds,
          counts: {
            success: successCount,
            rateLimited: rateLimitedCount,
            error: errorCount,
          },
        });
      }

      sendEvent('worker_update', {
        workerId,
        state: 'idle',
        currentTarget: undefined,
      });
    });

    await Promise.all(workerTasks);
    session.status = 'completed';

    sendEvent('complete', {
      total,
      success: successCount,
      rateLimited: rateLimitedCount,
      error: errorCount,
      durationSeconds: Math.floor((Date.now() - session.startTime) / 1000),
    });

    res.end();
  };

  runWorkerLoop().catch((err) => {
    sendEvent('error', { message: err.message });
    res.end();
  });

  req.on('close', () => {
    session.status = 'stopped';
    activeSessions.delete(sessionId);
  });
});

// 7. Stop Backend Scan Session
app.post('/api/scan/stop/:sessionId', (req: Request, res: Response) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  if (session) {
    session.status = 'stopped';
    activeSessions.delete(sessionId);
    res.json({ message: 'Session stopped' });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Serve static frontend in production if docs/dist exists
const docsPath = path.resolve(__dirname, 'docs');
if (fs.existsSync(docsPath)) {
  app.use('/urlscan.io-submitter', express.static(docsPath));
}

app.listen(PORT, () => {
  console.log(`[urlscan-submitter-backend] API server running at http://localhost:${PORT}`);
});

