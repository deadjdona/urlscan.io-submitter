/**
 * Type definitions for URL scan orchestration and result tracking
 * 
 * Core concepts:
 * - EngineMode: How URLs are submitted (simulation, direct API, or backend streaming)
 * - ScanConfig: Complete scan configuration from UI inputs
 * - ScanResult: Individual URL submission outcome and metadata
 * - ProgressMetrics: Real-time scan statistics and performance
 */

/**
 * How results are displayed to users on urlscan.io
 * - 'public': Visible to all users, searchable
 * - 'unlisted': Requires direct link, not searchable
 * - 'private': Only visible to result owner
 */
export type VisibilityMode = 'public' | 'unlisted' | 'private';

/**
 * Protocol selection for URL scanning
 * - 'http': Scan only http:// URLs
 * - 'https': Scan only https:// URLs
 * - 'both': Generate both http and https variants for each target
 */
export type ProtocolMode = 'https' | 'http' | 'both';

/**
 * Subdomain inclusion for URL generation
 * - 'root': Scan only root domain (e.g., example.com)
 * - 'www': Scan only www subdomain (e.g., www.example.com)
 * - 'both': Generate both root and www variants
 */
export type SubdomainMode = 'root' | 'www' | 'both';

/**
 * Subdomain enumeration scope for reconnaissance
 * - 'none': No subdomain enumeration
 * - 'basic': 18 common subdomains (api, admin, cdn, etc.)
 * - 'deep': 47 common subdomains (including staging, dev, test variants)
 * - 'massive': 59+ subdomains including obscure admin/config variants
 * 
 * Combined with protocol and subdomain settings to generate comprehensive target matrix
 */
export type ExploreMode = 'none' | 'basic' | 'deep' | 'massive';

/**
 * Submission engine selection
 * - 'simulation': Mock submissions with realistic latency/errors for UI testing (no API quota usage)
 * - 'client_api': Direct API calls from React frontend to urlscan.io (subject to browser CORS)
 * - 'backend_sse': Submit via Node.js backend with Server-Sent Events streaming (recommended for production)
 */
export type EngineMode = 'simulation' | 'client_api' | 'backend_sse';

/**
 * Complete scan configuration from UI inputs
 * Defines target expansion, submission behavior, and result metadata
 */
export interface ScanConfig {
  apiKey?: string; // urlscan.io API key (required for client_api and backend_sse engines)
  visibility: VisibilityMode; // Result visibility setting on urlscan.io
  protocols: ProtocolMode; // HTTP/HTTPS or both
  subdomains: SubdomainMode; // Root domain, www, or both
  explore: ExploreMode; // Subdomain enumeration scope (none/basic/deep/massive)
  workers: number; // Concurrent worker threads (default 4)
  delay: number; // Delay between submissions in seconds
  tags: string[]; // Metadata tags for urlscan.io results
  country?: string; // Optional geographic region for scanning
  userAgent?: string; // Custom User-Agent header (default: Chrome)
  referer?: string; // Custom Referer header
  resolveIps?: boolean; // Resolve DNS A-records for subdomains and submit IP variants
  engine: EngineMode; // Submission backend (simulation/client_api/backend_sse)
}

/**
 * Worker thread execution state
 * - 'idle': Waiting for next URL from queue
 * - 'submitting': Currently submitting URL to urlscan.io
 * - 'backoff': Rate-limited, waiting before retry
 * - 'completed': Finished all URLs in queue
 */
export type WorkerState = 'idle' | 'submitting' | 'backoff' | 'completed';

/**
 * Worker thread status snapshot
 * Includes current state, target being processed, backoff countdown, and progress count
 */
export interface WorkerStatus {
  id: number; // Worker thread ID (0-based)
  state: WorkerState; // Current execution state
  currentTarget?: string; // Target domain being processed
  backoffRemaining?: number; // Seconds remaining before retry (if in backoff)
  totalProcessed: number; // Cumulative URLs submitted by this worker
}

/**
 * URL submission outcome
 * - 'success': Successfully submitted to urlscan.io (HTTP 200)
 * - 'rate_limited': API rate limit hit (HTTP 429), will retry on backoff
 * - 'error': Submission failed (HTTP error or network error)
 * - 'pending': Not yet submitted (batch mode queue)
 */
export type ResultStatus = 'success' | 'rate_limited' | 'error' | 'pending';

/**
 * Individual URL submission result with metadata
 * Includes submission outcome, urlscan.io UUID, latency, and error details
 */
export interface ScanResult {
  id: string; // Unique result ID (UUID v4)
  target: string; // Original target domain
  url: string; // Expanded full URL submitted
  status: ResultStatus; // Submission outcome
  statusCode?: number; // HTTP status code from urlscan.io API
  uuid?: string; // UUID assigned by urlscan.io (on success)
  resultUrl?: string; // Direct link to urlscan.io result page (on success)
  latencyMs: number; // Round-trip time in milliseconds
  timestamp: string; // ISO 8601 submission timestamp
  workerId: number; // Which worker thread submitted this URL
  errorMessage?: string; // Error details (if status=error or rate_limited)
  visibility: VisibilityMode; // Result visibility setting
  tags?: string[]; // Metadata tags applied
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

