export type VisibilityMode = 'public' | 'unlisted' | 'private';
export type ProtocolMode = 'https' | 'http' | 'both';
export type SubdomainMode = 'root' | 'www' | 'both';
export type ExploreMode = 'none' | 'basic' | 'deep' | 'massive';
export type EngineMode = 'simulation' | 'client_api' | 'backend_sse';

export interface ScanConfig {
  apiKey?: string;
  visibility: VisibilityMode;
  protocols: ProtocolMode;
  subdomains: SubdomainMode;
  explore: ExploreMode;
  workers: number;
  delay: number; // in seconds
  tags: string[];
  country?: string;
  userAgent?: string;
  referer?: string;
  engine: EngineMode;
}

export type WorkerState = 'idle' | 'submitting' | 'backoff' | 'completed';

export interface WorkerStatus {
  id: number;
  state: WorkerState;
  currentTarget?: string;
  backoffRemaining?: number;
  totalProcessed: number;
}

export type ResultStatus = 'success' | 'rate_limited' | 'error' | 'pending';

export interface ScanResult {
  id: string;
  target: string;
  url: string;
  status: ResultStatus;
  statusCode?: number;
  uuid?: string;
  resultUrl?: string;
  latencyMs: number;
  timestamp: string;
  workerId: number;
  errorMessage?: string;
  visibility: VisibilityMode;
  tags?: string[];
}

export interface ProgressMetrics {
  total: number;
  processed: number;
  percentage: number;
  ratePerSec: number;
  elapsedSeconds: number;
  etaSeconds: number;
  counts: {
    success: number;
    rateLimited: number;
    error: number;
  };
  activeWorkers: number;
  isBackingOff: boolean;
  backoffSeconds: number;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'success' | 'warn' | 'error';
  workerId?: number;
  message: string;
}

export interface DatasetInfo {
  filename: string;
  path: string;
  sizeBytes: number;
  lineCount: number;
}

export interface DatasetStats {
  file_path: string;
  total_records: number;
  unique_records: number;
  duplicates: number;
  classification: {
    pages_dev_count: number;
    pages_dev_pct: number;
    external_count: number;
    external_pct: number;
    external_samples: string[];
  };
  length_metrics: {
    min: number;
    max: number;
    average: number;
  };
  entropy_metrics: {
    average_shannon_entropy: number;
  };
  structure: {
    first_char_distribution: Record<string, number>;
    top_prefix_stems: Record<string, number>;
    hyphen_distribution: Record<string, number>;
  };
}

