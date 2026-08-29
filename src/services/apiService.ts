/**
 * API Service: Backend Communication Layer
 * 
 * Provides type-safe client functions for communicating with the Node.js/Express backend.
 * Handles both REST API calls and Server-Sent Events (SSE) streaming for real-time scan updates.
 * 
 * Key responsibilities:
 * - Health checks to verify backend availability
 * - Dataset discovery and exploration (list, sample, statistics)
 * - Scan session management (initiate, stream, terminate)
 * - Real-time progress updates via SSE event streaming
 */

import {
  DatasetInfo,
  DatasetStats,
  ScanConfig,
  ScanResult,
  WorkerStatus,
  ProgressMetrics,
  LogEntry,
} from '../types/scanner';

const API_BASE = '/api';

/**
 * Verify backend server health and availability
 * @returns true if backend responds successfully within 2s timeout, false otherwise
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch list of available domain datasets
 * @returns Array of dataset metadata (filename, filesize, domain count)
 */
export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const res = await fetch(`${API_BASE}/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

/**
 * Fetch sample of domains from a dataset
 * @param filename - Dataset filename (default: 'pages.dev')
 * @param limit - Number of samples to return (default: 50)
 * @returns Sample of domains from the dataset
 */
export async function fetchDatasetSample(
  filename: string = 'pages.dev',
  limit: number = 50
): Promise<{ file: string; count: number; sample: string[] }> {
  const res = await fetch(`${API_BASE}/datasets/sample?file=${encodeURIComponent(filename)}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch dataset sample');
  return res.json();
}

/**
 * Fetch statistical analysis of a dataset
 * Includes entropy calculation, domain pattern analysis, TLD distribution, etc.
 * @param filename - Dataset filename (default: 'pages.dev')
 * @returns Comprehensive statistics about the dataset
 */
export async function fetchDatasetStats(filename: string = 'pages.dev'): Promise<DatasetStats> {
  const res = await fetch(`${API_BASE}/datasets/stats?file=${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error('Failed to fetch dataset stats');
  return res.json();
}

/**
 * Callback interface for Server-Sent Events (SSE) during scan execution
 * Allows UI to listen for real-time updates from backend workers
 */
export interface SSECallbacks {
  /** Called when scan session initializes with session metadata */
  onInit?: (data: { sessionId: string; total: number; workers: number }) => void;
  /** Called when a worker updates its processing state */
  onWorkerUpdate?: (worker: WorkerStatus) => void;
  /** Called when a URL scan completes with result data */
  onScanResult?: (result: ScanResult) => void;
  /** Called periodically with aggregated progress metrics */
  onProgress?: (progress: ProgressMetrics) => void;
  /** Called for detailed log entries from workers */
  onLog?: (log: LogEntry) => void;
  /** Called when scan session completes with final summary */
  onComplete?: (summary: any) => void;
  /** Called if connection error occurs */
  onError?: (err: any) => void;
}

/**
 * Initiate a URL scanning session on the backend
 * Starts worker threads that will process URLs in parallel with rate-limit handling
 * @param config - Scan configuration (worker count, rate limits, etc.)
 * @param targets - Array of URLs/domains to scan
 * @returns Session ID and target count confirmation
 */
export async function startBackendScan(
  config: ScanConfig,
  targets: string[]
): Promise<{ sessionId: string; targetCount: number }> {
  const res = await fetch(`${API_BASE}/scan/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, targets }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to start backend scan');
  }
  return res.json();
}

/**
 * Subscribe to real-time scan updates via Server-Sent Events (SSE)
 * Opens persistent connection to backend streaming endpoint and parses events
 * Provides graceful error handling for malformed JSON in events
 * @param sessionId - Session ID from startBackendScan
 * @param callbacks - Object with optional handlers for each event type
 * @returns Cleanup function to close the SSE connection
 */
export function connectScanSSE(sessionId: string, callbacks: SSECallbacks): () => void {
  const eventSource = new EventSource(`${API_BASE}/scan/stream/${sessionId}`);

  // Session initialization event with metadata
  eventSource.addEventListener('init', (e) => {
    try {
      callbacks.onInit?.(JSON.parse(e.data));
    } catch (err) {
      console.error('SSE parse init error', err);
    }
  });

  // Worker state changes (idle, processing, backing off)
  eventSource.addEventListener('worker_update', (e) => {
    try {
      const data = JSON.parse(e.data);
      callbacks.onWorkerUpdate?.({
        id: data.workerId,
        state: data.state,
        currentTarget: data.currentTarget,
        backoffRemaining: data.backoffRemaining,
        totalProcessed: 0,
      });
    } catch (err) {
      console.error('SSE parse worker_update error', err);
    }
  });

  // Individual URL scan completion results
  eventSource.addEventListener('scan_result', (e) => {
    try {
      callbacks.onScanResult?.(JSON.parse(e.data));
    } catch (err) {
      console.error('SSE parse scan_result error', err);
    }
  });

  // Aggregated progress update (total/processed/percentage/rate/ETA)
  eventSource.addEventListener('progress', (e) => {
    try {
      const p = JSON.parse(e.data);
      callbacks.onProgress?.({
        total: p.total,
        processed: p.processed,
        percentage: p.percentage,
        ratePerSec: p.ratePerSec,
        elapsedSeconds: p.elapsedSeconds,
        etaSeconds: p.etaSeconds,
        counts: p.counts,
        activeWorkers: 0,
        isBackingOff: false,
        backoffSeconds: 0,
      });
    } catch (err) {
      console.error('SSE parse progress error', err);
    }
  });

  // Detailed worker log entries (debug/info/warn/error)
  eventSource.addEventListener('log', (e) => {
    try {
      const l = JSON.parse(e.data);
      callbacks.onLog?.({
        id: Math.random().toString(36).substring(2, 9),
        timestamp: l.timestamp,
        level: l.level,
        workerId: l.workerId,
        message: l.message,
      });
    } catch (err) {
      console.error('SSE parse log error', err);
    }
  });

  // Scan session complete with final statistics
  eventSource.addEventListener('complete', (e) => {
    try {
      callbacks.onComplete?.(JSON.parse(e.data));
    } catch (err) {
      console.error('SSE parse complete error', err);
    }
    eventSource.close();
  });

  // Network error or unexpected closure
  eventSource.onerror = (err) => {
    callbacks.onError?.(err);
    eventSource.close();
  };

  // Return cleanup function for manual disconnection
  return () => {
    eventSource.close();
  };
}

/**
 * Stop a running scan session
 * Signals all workers to terminate gracefully and clean up session data
 * @param sessionId - Session ID to terminate
 */
export async function stopBackendScan(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/scan/stop/${sessionId}`, { method: 'POST' });
}

