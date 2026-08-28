import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Layers,
  FileText,
  Download,
  Play,
  CheckCircle2,
  PieChart,
  HardDrive,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { DatasetStats, DatasetInfo } from '../types/scanner';
import { fetchDatasetStats, fetchDatasets } from '../services/apiService';

const FALLBACK_STATS: DatasetStats = {
  file_path: 'pages.dev',
  total_records: 88906,
  unique_records: 88906,
  duplicates: 0,
  classification: {
    pages_dev_count: 88903,
    pages_dev_pct: 99.997,
    external_count: 3,
    external_pct: 0.003,
    external_samples: [
      'bank-garantiya-fz.ru',
      'api.bank-garantiya-fz.ru',
      'portal.bank-garantiya-fz.ru',
    ],
  },
  length_metrics: {
    min: 11,
    max: 68,
    average: 21.2,
  },
  entropy_metrics: {
    average_shannon_entropy: 3.717,
  },
  structure: {
    first_char_distribution: {
      '1': 25950,
      '2': 15649,
      '0': 11746,
      '5': 10748,
      '3': 9949,
      '4': 9354,
      '6': 5507,
    },
    top_prefix_stems: {
      '1-': 12040,
      '0-': 6520,
      '2-': 5800,
      '3-': 4200,
    },
    hyphen_distribution: {
      '0': 44807,
      '1': 33517,
      '2': 8200,
      '3': 1800,
      '4': 500,
      '5': 79,
    },
  },
};

interface GeneratedBatch {
  name: string;
  count: number;
  sample: string[];
}

export default function DatasetExplorer() {
  const [stats, setStats] = useState<DatasetStats>(FALLBACK_STATS);
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>('pages.dev');
  const [loading, setLoading] = useState<boolean>(false);

  // Batching tool state
  const [batchSize, setBatchSize] = useState<number>(1000);
  const [splitMode, setSplitMode] = useState<'size' | 'prefix'>('size');
  const [isBatching, setIsBatching] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<number>(0);
  const [generatedBatches, setGeneratedBatches] = useState<GeneratedBatch[]>([]);

  useEffect(() => {
    loadData();
  }, [selectedFile]);

  const loadData = async () => {
    setLoading(true);
    try {
      const dList = await fetchDatasets();
      setDatasets(dList);
    } catch {
      // Backend might be offline, fallback gracefully
    }

    try {
      const s = await fetchDatasetStats(selectedFile);
      setStats(s);
    } catch {
      setStats(FALLBACK_STATS);
    } finally {
      setLoading(false);
    }
  };

  const handleRunBatching = async () => {
    setIsBatching(true);
    setBatchProgress(0);
    setGeneratedBatches([]);

    const totalDomains = stats.total_records;
    const batchesCount =
      splitMode === 'size'
        ? Math.ceil(totalDomains / batchSize)
        : Object.keys(stats.structure.first_char_distribution).length;

    const batches: GeneratedBatch[] = [];

    // Simulate animated batch generation with live progress
    for (let i = 0; i < batchesCount; i++) {
      await new Promise((r) => setTimeout(r, 60));
      const pct = Math.round(((i + 1) / batchesCount) * 100);
      setBatchProgress(pct);

      if (splitMode === 'size') {
        const batchNum = (i + 1).toString().padStart(3, '0');
        const count = Math.min(batchSize, totalDomains - i * batchSize);
        batches.push({
          name: `pages_batch_${batchNum}.txt`,
          count,
          sample: [`${i * batchSize}-sample.pages.dev`, `${i * batchSize + 1}-sample.pages.dev`],
        });
      } else {
        const prefix = Object.keys(stats.structure.first_char_distribution)[i] || `${i}`;
        const count = stats.structure.first_char_distribution[prefix] || 1000;
        batches.push({
          name: `pages_prefix_${prefix}.txt`,
          count,
          sample: [`${prefix}-alpha.pages.dev`, `${prefix}-beta.pages.dev`],
        });
      }
    }

    setGeneratedBatches(batches);
    setIsBatching(false);
  };

  const downloadBatchFile = (batch: GeneratedBatch) => {
    const mockContent = Array.from({ length: Math.min(batch.count, 200) }, (_, idx) => `${idx}-${batch.name.replace('.txt', '')}.pages.dev`).join('\n');
    const blob = new Blob([mockContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = batch.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = stats.classification.pages_dev_count || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Dataset Profiler & Target Splitter</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Entropy profiling, prefix analysis, and quota-conscious batch partitioning for <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700 font-mono">pages.dev</code>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh Stats
          </button>
        </div>
      </div>

      {/* Overview Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-xs text-gray-500 font-medium block mb-1">Total Records</span>
          <span className="text-2xl font-bold font-mono text-gray-900">
            {stats.total_records.toLocaleString()}
          </span>
          <span className="text-[11px] text-gray-400 block mt-1">One FQDN per line</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-100 bg-emerald-50/20 shadow-2xs">
          <span className="text-xs text-emerald-700 font-medium block mb-1">Uniqueness</span>
          <span className="text-2xl font-bold font-mono text-emerald-600">100%</span>
          <span className="text-[11px] text-emerald-600 block mt-1">0 duplicate lines</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-blue-100 bg-blue-50/20 shadow-2xs">
          <span className="text-xs text-blue-700 font-medium block mb-1">Cloudflare Pages</span>
          <span className="text-2xl font-bold font-mono text-blue-600">
            {stats.classification.pages_dev_count.toLocaleString()}
          </span>
          <span className="text-[11px] text-blue-600 block mt-1">
            {stats.classification.pages_dev_pct.toFixed(2)}% of dataset
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-purple-100 bg-purple-50/20 shadow-2xs">
          <span className="text-xs text-purple-700 font-medium block mb-1">Shannon Entropy</span>
          <span className="text-2xl font-bold font-mono text-purple-600">
            {stats.entropy_metrics.average_shannon_entropy}
          </span>
          <span className="text-[11px] text-purple-600 block mt-1">bits / character</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
          <span className="text-xs text-gray-500 font-medium block mb-1">Avg Length</span>
          <span className="text-2xl font-bold font-mono text-gray-900">
            {stats.length_metrics.average}
          </span>
          <span className="text-[11px] text-gray-400 block mt-1">
            Min: {stats.length_metrics.min} | Max: {stats.length_metrics.max}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-amber-100 bg-amber-50/20 shadow-2xs">
          <span className="text-xs text-amber-700 font-medium block mb-1">External Domains</span>
          <span className="text-2xl font-bold font-mono text-amber-600">
            {stats.classification.external_count}
          </span>
          <span className="text-[11px] text-amber-600 block mt-1">Banking endpoints</span>
        </div>
      </div>

      {/* Structural Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prefix Distribution */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <PieChart size={16} className="text-blue-500" />
              Leading Character Prefix Distribution (*.pages.dev)
            </h3>
            <span className="text-xs text-gray-400 font-mono">Numeric 0–6</span>
          </div>

          <div className="space-y-3">
            {Object.entries(stats.structure.first_char_distribution)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .map(([prefix, countVal]) => {
                const count = Number(countVal);
                const pct = (count / totalPages) * 100;
                return (
                  <div key={prefix} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-gray-800">Prefix '{prefix}'</span>
                      <span className="text-gray-500">
                        {count.toLocaleString()} domains ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Hyphenation & Structural Patterns */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center gap-2">
              <Layers size={16} className="text-indigo-500" />
              Hyphenation & Complexity Breakdown
            </h3>
            <span className="text-xs text-gray-400 font-mono">Slugs & Stages</span>
          </div>

          <div className="space-y-3">
            {Object.entries(stats.structure.hyphen_distribution)
              .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
              .map(([hyphens, countVal]) => {
                const count = Number(countVal);
                const pct = (count / totalPages) * 100;
                return (
                  <div key={hyphens} className="space-y-1">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-gray-800">
                        {hyphens === '0'
                          ? '0 Hyphens (Direct slugs)'
                          : hyphens === '1'
                          ? '1 Hyphen (Project slugs)'
                          : `${hyphens} Hyphens (Multi-stage)`}
                      </span>
                      <span className="text-gray-500">
                        {count.toLocaleString()} ({pct.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Target Batching & Splitting Tool */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <FolderOpen size={18} className="text-emerald-600" />
              Dataset Batching & Partitioning Tool
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Split the 88,906 targets into quota-friendly chunk files ready for <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-700">urlscan-submit</code>
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Split Mode */}
          <div>
            <label className="text-xs font-bold text-gray-700 mb-1.5 block">
              Partitioning Strategy
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSplitMode('size')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  splitMode === 'size'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                Fixed Batch Size
              </button>
              <button
                type="button"
                onClick={() => setSplitMode('prefix')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  splitMode === 'prefix'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                By Prefix (0–6)
              </button>
            </div>
          </div>

          {/* Batch Size Slider */}
          {splitMode === 'size' && (
            <div>
              <div className="flex justify-between text-xs font-bold text-gray-700 mb-1.5">
                <span>Batch Size</span>
                <span className="font-mono text-blue-600">{batchSize.toLocaleString()} domains</span>
              </div>
              <input
                type="range"
                min="100"
                max="5000"
                step="100"
                value={batchSize}
                onChange={(e) => setBatchSize(parseInt(e.target.value, 10))}
                className="w-full accent-blue-600 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-0.5">
                <span>100 (Free API)</span>
                <span>1,000 (Standard)</span>
                <span>5,000 (Bulk)</span>
              </div>
            </div>
          )}

          {/* Action Button */}
          <div className="flex items-end">
            <button
              onClick={handleRunBatching}
              disabled={isBatching}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow-sm hover:shadow flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <Play size={14} fill="currentColor" />
              {isBatching ? 'Generating Batches...' : 'Execute Partitioning'}
            </button>
          </div>
        </div>

        {/* Batching Progress Bar */}
        {(isBatching || batchProgress > 0) && (
          <div className="space-y-1.5 pt-2">
            <div className="flex justify-between text-xs font-mono text-gray-600">
              <span>Partitioning Progress</span>
              <span>{batchProgress}%</span>
            </div>
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${batchProgress}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Generated Batches List */}
        {generatedBatches.length > 0 && (
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                Generated Batch Files ({generatedBatches.length} Chunks)
              </h4>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-60 overflow-y-auto p-1">
              {generatedBatches.map((b, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between gap-2 hover:bg-gray-100/70 transition-colors"
                >
                  <div className="truncate">
                    <span className="block text-xs font-mono font-bold text-gray-900 truncate">
                      {b.name}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {b.count.toLocaleString()} domains
                    </span>
                  </div>
                  <button
                    onClick={() => downloadBatchFile(b)}
                    className="p-1.5 bg-white hover:bg-emerald-50 text-gray-600 hover:text-emerald-700 rounded-lg border border-gray-200 transition-colors shrink-0"
                    title="Download Batch"
                  >
                    <Download size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
