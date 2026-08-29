/**
 * DocsView Component: Documentation & Getting Started Guide
 * 
 * Displays comprehensive documentation including:
 * - Feature highlights (smart rate limiting, multi-threaded, matrix generation)
 * - Full setup instructions for CLI + Web UI
 * - CLI usage examples for direct URL submissions and bulk processing
 * - Web UI guide with feature descriptions
 * - Copy-to-clipboard functionality for quick command sharing
 * 
 * Educational focus: help users quickly understand and get started with urlscan.io-submitter
 */

import React, { useState } from 'react';
import { Copy, Check, Shield, Zap, Activity } from 'lucide-react';

export default function DocsView() {
  // State: tracks which section was copied for visual feedback (2 second toast)
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  /**
   * Copy text to clipboard and show brief success feedback
   * Clears feedback after 2 seconds
   */
  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-2xs">
          <Shield className="text-indigo-500 shrink-0 mt-0.5" size={20} />
          <div>
            <strong className="block text-gray-900 text-sm mb-1">Smart Rate Limiting</strong>
            <span className="text-sm text-gray-600 leading-snug block">
              Auto-pauses accurately based on <code className="bg-gray-100 px-1 rounded text-xs text-gray-800">X-Rate-Limit</code> headers.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-2xs">
          <Zap className="text-amber-500 shrink-0 mt-0.5" size={20} />
          <div>
            <strong className="block text-gray-900 text-sm mb-1">Multi-threaded</strong>
            <span className="text-sm text-gray-600 leading-snug block">
              Process bulk domains concurrently with <code className="bg-gray-100 px-1 rounded text-xs text-gray-800">-w</code> flag.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-2xs">
          <Activity className="text-emerald-500 shrink-0 mt-0.5" size={20} />
          <div>
            <strong className="block text-gray-900 text-sm mb-1">Matrix Generation</strong>
            <span className="text-sm text-gray-600 leading-snug block">
              Auto-expand scopes using 140+ common recon subdomains.
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Installation & Examples */}
        <div className="lg:col-span-5 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">🛠️ Full Setup (CLI + Web UI)</h2>
              <button
                onClick={() =>
                  handleCopy(
                    'git clone https://github.com/deadjdona/urlscan.io-submitter.git\ncd urlscan.io-submitter\npython -m venv venv\nsource venv/bin/activate\npip install .\nexport URLSCAN_API_KEY="your-api-key"\nnpm install\nnpm run dev',
                    'install'
                  )
                }
                className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-md"
              >
                {copiedSection === 'install' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copiedSection === 'install' ? 'Copied' : 'Copy All'}
              </button>
            </div>
            <div className="bg-[#0D1117] rounded-xl p-5 text-[13px] font-mono text-gray-300 shadow-inner space-y-5 overflow-x-auto border border-gray-800">
              <div>
                <p className="text-gray-500 mb-1"># 1. Clone repository</p>
                <p className="mb-1"><span className="text-blue-400">git</span> clone https://github.com/deadjdona/urlscan.io-submitter.git</p>
                <p className="mb-1"><span className="text-blue-400">cd</span> urlscan.io-submitter</p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># 2. Setup Python CLI Tool</p>
                <p className="mb-1"><span className="text-blue-400">python</span> -m venv venv</p>
                <p className="mb-1"><span className="text-blue-400">source</span> venv/bin/activate</p>
                <p><span className="text-blue-400">pip</span> install .</p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># 3. Setup Web Dashboard & Node.js Server</p>
                <p className="mb-1"><span className="text-blue-400">npm</span> install</p>
                <p><span className="text-blue-400">npm</span> run dev</p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># 4. Configure your API key</p>
                <p className="mb-1"><span className="text-blue-400">export</span> URLSCAN_API_KEY="your-api-key"</p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold mb-3 text-gray-900">🚀 CLI Usage Examples</h2>
            <div className="bg-[#0D1117] rounded-xl p-5 text-[13px] font-mono text-gray-300 shadow-inner space-y-4 overflow-x-auto border border-gray-800">
              <div>
                <p className="text-gray-500 mb-1"># Basic single domain scan</p>
                <p><span className="text-yellow-300">urlscan-submit</span> -d example.com</p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># High-speed bulk scanning (10 workers)</p>
                <p><span className="text-yellow-300">urlscan-submit</span> -f massive_list.txt -w 10</p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># Deep reconnaissance with JSON output</p>
                <p className="mb-1"><span className="text-gray-500 text-xs"># Scans http/https, root/www, and 140+ subdomains</span></p>
                <p><span className="text-yellow-300">urlscan-submit</span> -d target.com -j output.json -p both -s both -xxx</p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># Private bulk scan + summary + export</p>
                <p className="mb-1"><span className="text-yellow-300">urlscan-submit</span> -e summary.csv \</p>
                <p className="mb-1 pl-4">-f domains.txt -j logs.json \</p>
                <p className="pl-4">-p both -r -V private</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Parameters */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <h2 className="text-base font-bold mb-3 text-gray-900">📋 Parameters & CLI Flags</h2>
            <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-xs bg-white">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-1/3">Argument</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-c, --config, -⚙</td>
                    <td className="px-4 py-2.5 text-gray-600">Path to JSON or YAML config file. Defaults to <code className="bg-gray-100 px-1 rounded">.urlscan-config.json</code>.</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-d, --domain, -🎯</td>
                    <td className="px-4 py-2.5 text-gray-600">A single base domain to scan.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">--delay, -🐢</td>
                    <td className="px-4 py-2.5 text-gray-600">Intentional delay in seconds between thread dispatches (e.g. <code className="bg-gray-100 px-1 rounded">-🐢 1.5</code>).</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-e, --export-csv, -📊</td>
                    <td className="px-4 py-2.5 text-gray-600">Export summary results to a CSV file (e.g. <code className="bg-gray-100 px-1 rounded">results.csv</code>).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-f, --file, -📁</td>
                    <td className="px-4 py-2.5 text-gray-600">Path to a text file containing domains.</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-j, --json-log, -📜</td>
                    <td className="px-4 py-2.5 text-gray-600">Export full raw API results to a JSON file.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-p, --protocols, -🌐</td>
                    <td className="px-4 py-2.5 text-gray-600">Protocols: <code className="bg-gray-100 px-1 rounded">http</code>, <code className="bg-gray-100 px-1 rounded">https</code>, <code className="bg-gray-100 px-1 rounded">both</code>.</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-r, --report, -📝</td>
                    <td className="px-4 py-2.5 text-gray-600">Wait for scan to finish and print a summary report.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-s, --subdomains, -🏢</td>
                    <td className="px-4 py-2.5 text-gray-600">Base subdomains applied: <code className="bg-gray-100 px-1 rounded">root</code>, <code className="bg-gray-100 px-1 rounded">www</code>, <code className="bg-gray-100 px-1 rounded">both</code>.</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-V, --visibility, -👻</td>
                    <td className="px-4 py-2.5 text-gray-600">Scan visibility: <code className="bg-gray-100 px-1 rounded">public</code>, <code className="bg-gray-100 px-1 rounded">unlisted</code>, <code className="bg-gray-100 px-1 rounded">private</code>.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-w, --workers, -🚀</td>
                    <td className="px-4 py-2.5 text-gray-600">Number of concurrent background workers (e.g. <code className="bg-gray-100 px-1 rounded">-w 4</code>).</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-x / -xx / -xxx</td>
                    <td className="px-4 py-2.5 text-gray-600">Exploratory Cartesian matrix: Basic (+20), Deep (+60), Massive (+140).</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold mb-3 text-gray-900">⚙️ How It Works (Architecture)</h2>
            <div className="space-y-4 text-xs text-gray-600 bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
              <div>
                <h3 className="font-bold text-gray-900 mb-1">1. Cartesian Matrix Generation</h3>
                <p className="leading-relaxed">
                  Instead of writing complex bash loops to handle combinations, supplying <code className="bg-gray-100 px-1 rounded font-mono">-d target.com -p both -s both -xx</code> automatically produces a multidimensional target matrix of <strong>(HTTP, HTTPS) × (Root, www) × (60+ Subdomains)</strong>.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">2. Intelligent Concurrency</h3>
                <p className="leading-relaxed">
                  Network boundaries are IO-bound tasks. The tool utilizes thread pooling with worker dispatch queues and dynamic rate-limit management.
                </p>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">3. Native Rate Limit Evasion</h3>
                <p className="leading-relaxed">
                  Urlscan restricts submissions via the <code className="bg-gray-100 px-1 rounded font-mono">X-Rate-Limit-Reset-After</code> header alongside HTTP 429. The tool parses the reset window and suspends only the affected worker thread until the quota bucket recovers.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

