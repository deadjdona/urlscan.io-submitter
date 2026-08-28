import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Play,
  Pause,
  Square,
  RotateCcw,
  Download,
  Search,
  Filter,
  Clock,
  Gauge,
  Shield,
  Zap,
  Activity,
  Layers,
  Terminal as TerminalIcon,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Upload,
  Key,
  Sliders,
  Sparkles,
  Server,
  Globe,
  RefreshCw,
} from 'lucide-react';
import {
  ScanConfig,
  ScanResult,
  WorkerStatus,
  ProgressMetrics,
  LogEntry,
  VisibilityMode,
  ProtocolMode,
  SubdomainMode,
  ExploreMode,
  EngineMode,
} from '../types/scanner';
import { ClientScanRunner, expandTargetMatrix } from '../services/scanRunner';
import {
  startBackendScan,
  connectScanSSE,
  stopBackendScan,
  fetchDatasetSample,
  checkBackendHealth,
} from '../services/apiService';

const SAMPLE_PAGES_DEV = [
  '0-0.pages.dev',
  '0-1.pages.dev',
  '0-100-percent.pages.dev',
  '0-1learning-vue.pages.dev',
  '01kitkat.pages.dev',
  '02pi.pages.dev',
  '1-minute-math.pages.dev',
  '100days-css.pages.dev',
  '100xdevs-assignment.pages.dev',
  '123movies-online.pages.dev',
  '2-step-verification.pages.dev',
  '2026-portal.pages.dev',
  '3d-portfolio-showcase.pages.dev',
  '404-not-found-theme.pages.dev',
  '5g-telecom-portal.pages.dev',
  '6figure-crypto.pages.dev',
  'admin-login-stage.pages.dev',
  'auth-sso-gateway.pages.dev',
  'dashboard-metrics-v2.pages.dev',
  'pay-checkout-flow.pages.dev',
];

const BANKING_SAMPLES = [
  'bank-garantiya-fz.ru',
  'api.bank-garantiya-fz.ru',
  'portal.bank-garantiya-fz.ru',
  'stage.bank-garantiya-fz.ru',
];

export default function LiveScanner() {
  // Scan Configuration State
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('urlscan_api_key') || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [visibility, setVisibility] = useState<VisibilityMode>('public');
  const [protocols, setProtocols] = useState<ProtocolMode>('https');
  const [subdomains, setSubdomains] = useState<SubdomainMode>('root');
  const [explore, setExplore] = useState<ExploreMode>('none');
  const [workersCount, setWorkersCount] = useState<number>(4);
  const [delay, setDelay] = useState<number>(0.5);
  const [tagsInput, setTagsInput] = useState<string>('pages-dev-recon');
  const [country, setCountry] = useState<string>('');
  const [engine, setEngine] = useState<EngineMode>('simulation');

  // Input Targets State
  const [targetsInput, setTargetsInput] = useState<string>(SAMPLE_PAGES_DEV.join('\n'));
  const [backendAvailable, setBackendAvailable] = useState<boolean>(false);

  // Runtime State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [workers, setWorkers] = useState<WorkerStatus[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [metrics, setMetrics] = useState<ProgressMetrics>({
    total: 0,
    processed: 0,
    percentage: 0,
    ratePerSec: 0,
    elapsedSeconds: 0,
    etaSeconds: 0,
    counts: { success: 0, rateLimited: 0, error: 0 },
    activeWorkers: 0,
    isBackingOff: false,
    backoffSeconds: 0,
  });

  // Table Filtering & UI State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'rate_limited' | 'error'>('all');
  const [activeTab, setActiveTab] = useState<'results' | 'workers' | 'logs'>('results');
  const [autoScrollLogs, setAutoScrollLogs] = useState<boolean>(true);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(true);

  // References for active scan
  const clientRunnerRef = useRef<ClientScanRunner | null>(null);
  const backendSessionIdRef = useRef<string | null>(null);
  const sseCleanupRef = useRef<(() => void) | null>(null);
  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Check backend health on mount
  useEffect(() => {
    checkBackendHealth().then((available) => {
      setBackendAvailable(available);
      if (available && engine === 'backend_sse') {
        // keep backend_sse
      }
    });
  }, []);

  // Save API key to local storage
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('urlscan_api_key', apiKey);
    }
  }, [apiKey]);

  // Auto-scroll logs
  useEffect(() => {
    if (autoScrollLogs && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScrollLogs]);

  // Computed raw targets array
  const rawTargets = useMemo(() => {
    return targetsInput
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));
  }, [targetsInput]);

  // Matrix expanded target count preview
  const matrixCount = useMemo(() => {
    return expandTargetMatrix(rawTargets, protocols, subdomains, explore).length;
  }, [rawTargets, protocols, subdomains, explore]);

  // Filtered results for table
  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      const matchesSearch =
        !searchQuery ||
        r.target.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.uuid && r.uuid.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' || r.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [results, searchQuery, statusFilter]);

  // Format seconds to mm:ss or hh:mm:ss
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Helper: append log
  const appendLog = (level: LogEntry['level'], message: string, workerId?: number) => {
    setLogs((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toLocaleTimeString(),
        level,
        workerId,
        message,
      },
    ]);
  };

  // Presets
  const loadPreset = (type: 'pages20' | 'pages100' | 'banking') => {
    if (type === 'pages20') {
      setTargetsInput(SAMPLE_PAGES_DEV.join('\n'));
      appendLog('info', 'Loaded 20 sample Cloudflare Pages targets.');
    } else if (type === 'banking') {
      setTargetsInput(BANKING_SAMPLES.join('\n'));
      appendLog('info', 'Loaded Russian banking domain targets from dataset.');
    } else if (type === 'pages100') {
      fetchDatasetSample('pages.dev', 100)
        .then((res) => {
          setTargetsInput(res.sample.join('\n'));
          appendLog('info', `Fetched ${res.sample.length} targets from pages.dev dataset.`);
        })
        .catch(() => {
          // Fallback if backend not running
          const multiplied = Array.from({ length: 100 }, (_, i) => `${i}-app.pages.dev`);
          setTargetsInput(multiplied.join('\n'));
          appendLog('info', 'Generated 100 sample Cloudflare Pages targets.');
        });
    }
  };

  // File Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setTargetsInput(content);
        const count = content.split('\n').filter((l) => l.trim() && !l.startsWith('#')).length;
        appendLog('info', `Loaded ${count} targets from file: ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  // Start Scan handler
  const handleStartScan = async () => {
    if (rawTargets.length === 0) {
      alert('Please provide at least one target domain.');
      return;
    }

    const config: ScanConfig = {
      apiKey: apiKey.trim() || undefined,
      visibility,
      protocols,
      subdomains,
      explore,
      workers: workersCount,
      delay,
      tags: tagsInput.split(',').map((t) => t.trim()).filter(Boolean),
      country: country.trim() || undefined,
      engine,
    };

    setIsRunning(true);
    setIsPaused(false);
    setResults([]);
    setLogs([]);

    // Initialize initial worker list
    const initialWorkers: WorkerStatus[] = [];
    for (let i = 1; i <= workersCount; i++) {
      initialWorkers.push({ id: i, state: 'idle', totalProcessed: 0 });
    }
    setWorkers(initialWorkers);

    if (engine === 'backend_sse' && backendAvailable) {
      // BACKEND RUNNER MODE (SSE)
      try {
        appendLog('info', `🌐 Starting backend scan session on server via SSE...`);
        const expanded = expandTargetMatrix(rawTargets, protocols, subdomains, explore);
        const session = await startBackendScan(config, expanded);
        backendSessionIdRef.current = session.sessionId;

        const cleanup = connectScanSSE(session.sessionId, {
          onWorkerUpdate: (worker) => {
            setWorkers((prev) => {
              const next = [...prev];
              const idx = next.findIndex((w) => w.id === worker.id);
              if (idx !== -1) next[idx] = { ...next[idx], ...worker };
              else next.push(worker);
              return next;
            });
          },
          onScanResult: (result) => {
            setResults((prev) => [result, ...prev]);
          },
          onProgress: (p) => {
            setMetrics(p);
          },
          onLog: (log) => {
            setLogs((prev) => [...prev, log]);
          },
          onComplete: (summary) => {
            setIsRunning(false);
            appendLog('success', `🏁 Backend scan completed: ${JSON.stringify(summary)}`);
          },
          onError: (err) => {
            console.error(err);
            setIsRunning(false);
            appendLog('error', 'Backend scan connection error occurred.');
          },
        });
        sseCleanupRef.current = cleanup;
      } catch (err: any) {
        setIsRunning(false);
        appendLog('error', `Failed to start backend scan: ${err.message}`);
      }
    } else {
      // IN-BROWSER CLIENT RUNNER (Simulation or Direct urlscan.io API)
      const runner = new ClientScanRunner(config, rawTargets);
      clientRunnerRef.current = runner;

      runner.onWorkerUpdate = (worker) => {
        setWorkers((prev) => {
          const next = [...prev];
          const idx = next.findIndex((w) => w.id === worker.id);
          if (idx !== -1) next[idx] = worker;
          else next.push(worker);
          return next;
        });
      };

      runner.onProgress = (p) => {
        setMetrics(p);
      };

      runner.onResult = (result) => {
        setResults((prev) => [result, ...prev]);
      };

      runner.onLog = (log) => {
        setLogs((prev) => [...prev, log]);
      };

      runner.onComplete = () => {
        setIsRunning(false);
        setIsPaused(false);
      };

      try {
        await runner.start();
      } catch (err: any) {
        setIsRunning(false);
        appendLog('error', `Client scanner encountered an error: ${err.message}`);
      }
    }
  };

  // Pause / Resume handler
  const handleTogglePause = () => {
    if (isPaused) {
      clientRunnerRef.current?.resume();
      setIsPaused(false);
    } else {
      clientRunnerRef.current?.pause();
      setIsPaused(true);
    }
  };

  // Stop Scan handler
  const handleStopScan = () => {
    if (clientRunnerRef.current) {
      clientRunnerRef.current.stop();
    }
    if (backendSessionIdRef.current) {
      stopBackendScan(backendSessionIdRef.current);
    }
    if (sseCleanupRef.current) {
      sseCleanupRef.current();
    }
    setIsRunning(false);
    setIsPaused(false);
    appendLog('warn', 'Scan process stopped by user.');
  };

  // Export Results to CSV
  const handleExportCSV = () => {
    if (results.length === 0) return;
    const headers = ['ID', 'Target', 'URL', 'Status', 'HTTP_Status', 'UUID', 'Result_URL', 'Latency_ms', 'Timestamp', 'Visibility'];
    const rows = results.map((r) => [
      r.id,
      r.target,
      r.url,
      r.status,
      r.statusCode || '',
      r.uuid || '',
      r.resultUrl || '',
      r.latencyMs,
      `"${r.timestamp}"`,
      r.visibility,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `urlscan_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog('info', `Exported ${results.length} results to CSV.`);
  };

  // Export Results to JSON
  const handleExportJSON = () => {
    if (results.length === 0) return;
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `urlscan_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    appendLog('info', `Exported ${results.length} results to JSON.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Mode Selector */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
            <Activity className="animate-pulse" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              Live Submission & Progress Hub
              {isRunning && (
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span> Active Scan
                </span>
              )}
              {isPaused && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
                  Paused
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Execute real-time urlscan.io reconnaissance with live rate-limit evasion and thread monitoring
            </p>
          </div>
        </div>

        {/* Engine Switcher */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl border border-gray-200 text-xs font-medium self-stretch md:self-auto justify-center">
          <button
            onClick={() => setEngine('simulation')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              engine === 'simulation'
                ? 'bg-white text-blue-600 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles size={14} /> Interactive Simulation
          </button>

          <button
            onClick={() => setEngine('client_api')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              engine === 'client_api'
                ? 'bg-white text-indigo-600 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Globe size={14} /> Direct urlscan.io API
          </button>

          <button
            onClick={() => setEngine('backend_sse')}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              engine === 'backend_sse'
                ? 'bg-white text-emerald-600 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Server size={14} /> Backend Express SSE
            {backendAvailable && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>}
          </button>
        </div>
      </div>

      {/* Real-time Rate Limit Alert Banner */}
      {metrics.isBackingOff && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 text-amber-900 animate-pulse">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-amber-600 shrink-0" size={24} />
            <div>
              <strong className="block text-sm font-semibold">Rate Limit Threshold Encountered (HTTP 429)</strong>
              <p className="text-xs text-amber-700">
                Worker thread automatically throttled. Resuming dispatch in <strong>{metrics.backoffSeconds}s</strong> with zero drop rate.
              </p>
            </div>
          </div>
          <div className="text-xs font-mono font-bold bg-amber-200/80 px-2.5 py-1 rounded text-amber-900">
            Backoff: {metrics.backoffSeconds}s
          </div>
        </div>
      )}

      {/* HUD: Real-Time Progress & Metric Counters */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {/* Progress % */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium mb-1">
            <span>Overall Progress</span>
            <Layers size={15} className="text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {metrics.percentage}%
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {metrics.processed} / {metrics.total} targets
          </div>
        </div>

        {/* Speed */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium mb-1">
            <span>Scan Velocity</span>
            <Gauge size={15} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-gray-900 font-mono">
            {metrics.ratePerSec} <span className="text-xs font-normal text-gray-500">req/s</span>
          </div>
          <div className="text-[11px] text-gray-500 mt-1">
            {workersCount} concurrent workers
          </div>
        </div>

        {/* Elapsed & ETA */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-gray-500 font-medium mb-1">
            <span>Elapsed / ETA</span>
            <Clock size={15} className="text-amber-500" />
          </div>
          <div className="text-xl font-bold text-gray-900 font-mono">
            {formatTime(metrics.elapsedSeconds)}
          </div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            {metrics.etaSeconds > 0 ? `ETA ~${formatTime(metrics.etaSeconds)}` : 'Completed / Idle'}
          </div>
        </div>

        {/* 200 OK Success */}
        <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-emerald-700 font-medium mb-1">
            <span>200 Submitted</span>
            <CheckCircle2 size={15} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600 font-mono">
            {metrics.counts.success}
          </div>
          <div className="text-[11px] text-emerald-600 mt-1">
            {metrics.processed > 0 ? `${((metrics.counts.success / metrics.processed) * 100).toFixed(1)}% success` : '0%'}
          </div>
        </div>

        {/* 429 Rate Limited */}
        <div className="bg-white p-4 rounded-xl border border-amber-100 bg-amber-50/20 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-amber-700 font-medium mb-1">
            <span>429 Rate Limits</span>
            <Shield size={15} className="text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-amber-600 font-mono">
            {metrics.counts.rateLimited}
          </div>
          <div className="text-[11px] text-amber-600 mt-1">
            Evasive backoff
          </div>
        </div>

        {/* Errors */}
        <div className="bg-white p-4 rounded-xl border border-rose-100 bg-rose-50/20 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-rose-700 font-medium mb-1">
            <span>Failed / Errors</span>
            <XCircle size={15} className="text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 font-mono">
            {metrics.counts.error}
          </div>
          <div className="text-[11px] text-rose-600 mt-1">
            Network / timeouts
          </div>
        </div>
      </div>

      {/* Main Animated Progress Bar */}
      <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-xs space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-green-500 animate-ping' : 'bg-gray-400'}`}></span>
            Execution Pipeline: {metrics.processed} of {metrics.total} Dispatched
          </span>
          <span className="font-mono text-blue-600">{metrics.percentage}%</span>
        </div>
        <div className="w-full h-3.5 bg-gray-100 rounded-full overflow-hidden p-0.5 border border-gray-200">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              metrics.isBackingOff
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-blue-500 via-indigo-500 to-emerald-500'
            }`}
            style={{ width: `${metrics.percentage}%` }}
          ></div>
        </div>
      </div>

      {/* Main Control Panel: Configuration & Input */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div
          className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between cursor-pointer select-none"
          onClick={() => setIsConfigOpen(!isConfigOpen)}
        >
          <div className="flex items-center gap-2 font-semibold text-gray-900 text-sm">
            <Sliders size={18} className="text-blue-600" />
            <span>Target Pipeline Configuration & Parameters</span>
            <span className="text-xs text-gray-500 font-normal">
              ({rawTargets.length} base domains &rarr; {matrixCount} matrix targets)
            </span>
          </div>
          <button className="text-xs text-gray-500 hover:text-gray-800 font-medium">
            {isConfigOpen ? 'Collapse' : 'Expand'}
          </button>
        </div>

        {isConfigOpen && (
          <div className="p-6 space-y-6">
            {/* Target Domains Input & Presets */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Target Domain List ({rawTargets.length} entries)
                </label>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-gray-400 mr-1">Presets:</span>
                  <button
                    onClick={() => loadPreset('pages20')}
                    className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-md text-xs font-medium transition-colors"
                  >
                    20 pages.dev
                  </button>
                  <button
                    onClick={() => loadPreset('pages100')}
                    className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium transition-colors"
                  >
                    100 pages.dev
                  </button>
                  <button
                    onClick={() => loadPreset('banking')}
                    className="px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-md text-xs font-medium transition-colors"
                  >
                    Banking targets
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md text-xs font-medium transition-colors flex items-center gap-1"
                  >
                    <Upload size={12} /> Upload .txt
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept=".txt,.dev,.csv"
                    className="hidden"
                  />
                </div>
              </div>

              <textarea
                value={targetsInput}
                onChange={(e) => setTargetsInput(e.target.value)}
                disabled={isRunning}
                rows={5}
                placeholder="Enter domains (one per line, e.g. 0-1learning-vue.pages.dev)"
                className="w-full font-mono text-xs p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-gray-50/50 disabled:bg-gray-100"
              />
            </div>

            {/* Matrix & Parameters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* API Key */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
                  <Key size={13} className="text-gray-500" />
                  urlscan.io API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={engine === 'simulation' ? 'Optional in Simulation' : 'Enter API Key...'}
                    className="w-full text-xs font-mono p-2.5 pr-14 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-2.5 text-[11px] text-gray-500 hover:text-gray-800"
                  >
                    {showApiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              {/* Workers Count */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Zap size={13} className="text-amber-500" />
                    Workers (-w)
                  </span>
                  <span className="font-mono text-blue-600 font-bold">{workersCount} threads</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="16"
                  value={workersCount}
                  onChange={(e) => setWorkersCount(parseInt(e.target.value, 10))}
                  disabled={isRunning}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-0.5">
                  <span>1 (Seq)</span>
                  <span>4 (Std)</span>
                  <span>8 (Fast)</span>
                  <span>16 (Max)</span>
                </div>
              </div>

              {/* Request Stagger Delay */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Clock size={13} className="text-indigo-500" />
                    Delay (--delay)
                  </span>
                  <span className="font-mono text-blue-600 font-bold">{delay}s</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={delay}
                  onChange={(e) => setDelay(parseFloat(e.target.value))}
                  disabled={isRunning}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-0.5">
                  <span>0.0s (Full)</span>
                  <span>0.5s (Recom)</span>
                  <span>3.0s (Stealth)</span>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Visibility (-V)
                </label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as VisibilityMode)}
                  disabled={isRunning}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="public">Public (Visible on urlscan.io)</option>
                  <option value="unlisted">Unlisted (Hidden from public search)</option>
                  <option value="private">Private (Team/Account only)</option>
                </select>
              </div>

              {/* Protocols */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Protocols (-p)
                </label>
                <select
                  value={protocols}
                  onChange={(e) => setProtocols(e.target.value as ProtocolMode)}
                  disabled={isRunning}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="https">HTTPS only (Default)</option>
                  <option value="http">HTTP only</option>
                  <option value="both">Both (HTTP + HTTPS)</option>
                </select>
              </div>

              {/* Subdomains Mode */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Subdomains Mode (-s)
                </label>
                <select
                  value={subdomains}
                  onChange={(e) => setSubdomains(e.target.value as SubdomainMode)}
                  disabled={isRunning}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="root">Root domain (Default)</option>
                  <option value="www">WWW subdomain</option>
                  <option value="both">Both (root + www)</option>
                </select>
              </div>

              {/* Explore Mode */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Matrix Exploration (-x / -xx / -xxx)
                </label>
                <select
                  value={explore}
                  onChange={(e) => setExplore(e.target.value as ExploreMode)}
                  disabled={isRunning}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="none">None (Direct targets)</option>
                  <option value="basic">-x Basic (+20 subdomains)</option>
                  <option value="deep">-xx Deep (+60 subdomains)</option>
                  <option value="massive">-xxx Massive (+140 subdomains)</option>
                </select>
              </div>

              {/* Custom Tags */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Scan Tags (--tags)
                </label>
                <input
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="e.g. pages-dev,campaign-2026"
                  disabled={isRunning}
                  className="w-full text-xs p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            {/* Action Bar (Start, Pause, Stop, Export) */}
            <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isRunning ? (
                  <button
                    onClick={handleStartScan}
                    className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-sm shadow-sm hover:shadow flex items-center gap-2 transition-all cursor-pointer"
                  >
                    <Play size={16} fill="currentColor" />
                    Start Scan ({matrixCount} targets)
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleTogglePause}
                      className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer ${
                        isPaused
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-500 hover:bg-amber-600 text-white'
                      }`}
                    >
                      {isPaused ? <Play size={16} fill="currentColor" /> : <Pause size={16} />}
                      {isPaused ? 'Resume' : 'Pause'}
                    </button>

                    <button
                      onClick={handleStopScan}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-sm flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Square size={16} fill="currentColor" /> Stop
                    </button>
                  </>
                )}

                <button
                  onClick={() => {
                    setResults([]);
                    setLogs([]);
                    setMetrics({
                      total: 0,
                      processed: 0,
                      percentage: 0,
                      ratePerSec: 0,
                      elapsedSeconds: 0,
                      etaSeconds: 0,
                      counts: { success: 0, rateLimited: 0, error: 0 },
                      activeWorkers: 0,
                      isBackingOff: false,
                      backoffSeconds: 0,
                    });
                  }}
                  disabled={isRunning}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <RotateCcw size={14} /> Clear
                </button>
              </div>

              {/* Export Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  disabled={results.length === 0}
                  className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={14} /> Export CSV ({results.length})
                </button>

                <button
                  onClick={handleExportJSON}
                  disabled={results.length === 0}
                  className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={14} /> Export JSON
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Active Worker Thread Visualizer Grid */}
      {workers.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <Zap size={16} className="text-amber-500" />
              Active Worker Pool Matrix ({workers.length} Threads)
            </h3>
            <span className="text-xs text-gray-500 font-mono">
              Status: {metrics.isBackingOff ? 'Evasive Pause' : isRunning ? 'Dispatching' : 'Standby'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {workers.map((w) => (
              <div
                key={w.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  w.state === 'submitting'
                    ? 'bg-blue-50/50 border-blue-200 ring-1 ring-blue-300'
                    : w.state === 'backoff'
                    ? 'bg-amber-50/70 border-amber-300 ring-1 ring-amber-400'
                    : w.state === 'completed'
                    ? 'bg-emerald-50/30 border-emerald-200'
                    : 'bg-gray-50 border-gray-200 opacity-80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold font-mono text-gray-800">Worker #{w.id}</span>
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      w.state === 'submitting'
                        ? 'bg-blue-100 text-blue-700'
                        : w.state === 'backoff'
                        ? 'bg-amber-200 text-amber-900 animate-pulse'
                        : w.state === 'completed'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {w.state === 'backoff' ? `Backoff ${w.backoffRemaining}s` : w.state}
                  </span>
                </div>
                <p className="text-xs font-mono text-gray-600 truncate" title={w.currentTarget || 'Idle'}>
                  {w.currentTarget || 'Waiting for next domain...'}
                </p>
                <div className="text-[10px] text-gray-400 mt-1 font-mono">
                  Completed: {w.totalProcessed} tasks
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Results & Terminal Log Views */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="px-5 pt-4 bg-gray-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('results')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 ${
                activeTab === 'results'
                  ? 'bg-white border-gray-200 text-blue-600 -mb-px pb-2.5'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <Activity size={14} /> Live Scan Feed ({results.length})
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-2 text-xs font-bold rounded-t-xl border-t border-x transition-colors flex items-center gap-1.5 ${
                activeTab === 'logs'
                  ? 'bg-white border-gray-200 text-blue-600 -mb-px pb-2.5'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <TerminalIcon size={14} /> Live Terminal Log ({logs.length})
            </button>
          </div>

          {activeTab === 'results' && (
            <div className="flex items-center gap-2 pb-2">
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter domain / UUID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="text-xs pl-7 pr-3 py-1.5 rounded-lg border border-gray-200 focus:ring-1 focus:ring-blue-500 outline-none w-44 bg-white"
                />
              </div>

              {/* Status Filter */}
              <div className="flex items-center bg-gray-200/80 p-0.5 rounded-lg text-[11px] font-medium">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    statusFilter === 'all' ? 'bg-white text-gray-900 font-bold shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setStatusFilter('success')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    statusFilter === 'success' ? 'bg-white text-emerald-700 font-bold shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  200 OK
                </button>
                <button
                  onClick={() => setStatusFilter('rate_limited')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    statusFilter === 'rate_limited' ? 'bg-white text-amber-700 font-bold shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  429
                </button>
                <button
                  onClick={() => setStatusFilter('error')}
                  className={`px-2 py-1 rounded-md transition-colors ${
                    statusFilter === 'error' ? 'bg-white text-rose-700 font-bold shadow-2xs' : 'text-gray-600'
                  }`}
                >
                  Errors
                </button>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="flex items-center gap-2 pb-2">
              <label className="flex items-center gap-1 text-xs text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoScrollLogs}
                  onChange={(e) => setAutoScrollLogs(e.target.checked)}
                  className="rounded text-blue-600"
                />
                Auto-scroll
              </label>
              <button
                onClick={() => setLogs([])}
                className="text-xs text-gray-500 hover:text-gray-800 bg-gray-200/70 px-2 py-1 rounded"
              >
                Clear logs
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: Live Results Table */}
        {activeTab === 'results' && (
          <div className="p-0 overflow-x-auto">
            {results.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Activity size={36} className="mx-auto mb-3 opacity-40 text-blue-500" />
                <p className="text-sm font-semibold text-gray-600">No submissions recorded yet</p>
                <p className="text-xs text-gray-400 mt-1">
                  Click <strong>Start Scan</strong> above to launch multi-threaded submissions
                </p>
              </div>
            ) : (
              <table className="min-w-full text-xs text-left">
                <thead className="bg-gray-50/80 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Target Domain & URL</th>
                    <th className="px-4 py-3 font-semibold">HTTP</th>
                    <th className="px-4 py-3 font-semibold">Latency</th>
                    <th className="px-4 py-3 font-semibold">Worker</th>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold text-right">urlscan.io Report</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-mono">
                  {filteredResults.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {r.status === 'success' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            200 OK
                          </span>
                        )}
                        {r.status === 'rate_limited' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            429 BACKOFF
                          </span>
                        )}
                        {r.status === 'error' && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            ERROR
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-gray-900 max-w-xs truncate">
                        <span className="text-gray-500 font-normal">{r.url.split('://')[0]}://</span>
                        <strong>{r.target}</strong>
                        {r.errorMessage && (
                          <span className="block text-[10px] text-rose-500 font-sans truncate">
                            {r.errorMessage}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                        {r.statusCode || '-'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        {r.latencyMs}ms
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                        Worker #{r.workerId}
                      </td>
                      <td className="px-4 py-2.5 text-gray-400 whitespace-nowrap">
                        {r.timestamp}
                      </td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {r.resultUrl ? (
                          <a
                            href={r.resultUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-[11px] font-semibold"
                          >
                            <span>View Scan</span>
                            <ExternalLink size={12} />
                          </a>
                        ) : (
                          <span className="text-gray-300">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 2: Terminal Console Log */}
        {activeTab === 'logs' && (
          <div className="p-4 bg-[#0D1117] text-gray-200 font-mono text-xs max-h-96 overflow-y-auto space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 py-6 text-center">No terminal logs generated yet.</div>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="leading-relaxed">
                  <span className="text-gray-500">[{l.timestamp}]</span>{' '}
                  {l.level === 'info' && <span className="text-blue-400">[INFO]</span>}
                  {l.level === 'success' && <span className="text-emerald-400">[SUCCESS]</span>}
                  {l.level === 'warn' && <span className="text-amber-400">[WARN]</span>}
                  {l.level === 'error' && <span className="text-rose-400">[ERROR]</span>}{' '}
                  <span>{l.message}</span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

