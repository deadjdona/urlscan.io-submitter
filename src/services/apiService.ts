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

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const res = await fetch(`${API_BASE}/datasets`);
  if (!res.ok) throw new Error('Failed to fetch datasets');
  return res.json();
}

export async function fetchDatasetSample(
  filename: string = 'pages.dev',
  limit: number = 50
): Promise<{ file: string; count: number; sample: string[] }> {
  const res = await fetch(`${API_BASE}/datasets/sample?file=${encodeURIComponent(filename)}&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch dataset sample');
  return res.json();
}

export async function fetchDatasetStats(filename: string = 'pages.dev'): Promise<DatasetStats> {
  const res = await fetch(`${API_BASE}/datasets/stats?file=${encodeURIComponent(filename)}`);
  if (!res.ok) throw new Error('Failed to fetch dataset stats');
  return res.json();
}

export interface SSECallbacks {
  onInit?: (data: { sessionId: string; total: number; workers: number }) => void;
  onWorkerUpdate?: (worker: WorkerStatus) => void;
  onScanResult?: (result: ScanResult) => void;
  onProgress?: (progress: ProgressMetrics) => void;
  onLog?: (log: LogEntry) => void;
  onComplete?: (summary: any) => void;
  onError?: (err: any) => void;
}

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

export function connectScanSSE(sessionId: string, callbacks: SSECallbacks): () => void {
  const eventSource = new EventSource(`${API_BASE}/scan/stream/${sessionId}`);

  eventSource.addEventListener('init', (e) => {
    try {
      callbacks.onInit?.(JSON.parse(e.data));
    } catch (err) {
      console.error('SSE parse init error', err);
    }
  });

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

  eventSource.addEventListener('scan_result', (e) => {
    try {
      callbacks.onScanResult?.(JSON.parse(e.data));
    } catch (err) {
      console.error('SSE parse scan_result error', err);
    }
  });

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

  eventSource.addEventListener('complete', (e) => {
    try {
      callbacks.onComplete?.(JSON.parse(e.data));
    } catch (err) {
      console.error('SSE parse complete error', err);
    }
    eventSource.close();
  });

  eventSource.onerror = (err) => {
    callbacks.onError?.(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}

export async function stopBackendScan(sessionId: string): Promise<void> {
  await fetch(`${API_BASE}/scan/stop/${sessionId}`, { method: 'POST' });
}

