/**
 * DocsView Component: Documentation & Getting Started Guide
 * DocsView Component: Documentation, Playbooks & Troubleshooting Guide
 * 
 * Displays comprehensive documentation including:
 * - Feature highlights (smart rate limiting, multi-threaded, matrix generation)
 * - Full setup instructions for CLI + Web UI
 * - CLI usage examples for direct URL submissions and bulk processing
 * - Web UI guide with feature descriptions
 * - Security Playbooks & real-world workflow examples
 * - Complete CLI arguments & configuration reference
 * - Troubleshooting & FAQ (400, 401, 403, 429 errors, quotas, visibility modes)
 * - Python programmatic usage & automation integration
 * - Copy-to-clipboard functionality for quick command sharing
 * 
 * Educational focus: help users quickly understand and get started with urlscan.io-submitter
 */

import React, { useState } from 'react';
import { Copy, Check, Shield, Zap, Activity } from 'lucide-react';
import { 
  Copy, 
  Check, 
  Shield, 
  Zap, 
  Activity, 
  HelpCircle, 
  FileText, 
  Terminal, 
  Key, 
  Globe, 
  AlertTriangle, 
  Sliders, 
  Layers, 
  Code2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

export default function DocsView() {
  // State: tracks which section was copied for visual feedback (2 second toast)
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  // State: active category tab for playbooks
  const [activePlaybook, setActivePlaybook] = useState<'recon' | 'phishing' | 'stealth' | 'automation'>('recon');

  // State: collapsible FAQ items
  const [openFaq, setOpenFaq] = useState<Record<string, boolean>>({
    'rate-limits': true,
    'visibility': false,
    'api-key': false,
    'matrix': false,
    'tags': false
  });

  const toggleFaq = (key: string) => {
    setOpenFaq(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Top Feature Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-2xs">
          <Shield className="text-indigo-500 shrink-0 mt-0.5" size={20} />
        <div className="flex items-start gap-3.5 p-5 rounded-2xl bg-white border border-gray-200 shadow-xs">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shrink-0">
            <Shield size={20} />
          </div>
          <div>
            <strong className="block text-gray-900 text-sm mb-1">Smart Rate Limiting</strong>
            <span className="text-sm text-gray-600 leading-snug block">
              Auto-pauses accurately based on <code className="bg-gray-100 px-1 rounded text-xs text-gray-800">X-Rate-Limit</code> headers.
            <strong className="block text-gray-900 text-sm font-bold mb-1">Smart Rate Limiting</strong>
            <span className="text-xs text-gray-600 leading-relaxed block">
              Auto-pauses based on <code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono text-[11px]">X-Rate-Limit-Reset-After</code> headers with exponential backoff fallback.
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-2xs">
          <Zap className="text-amber-500 shrink-0 mt-0.5" size={20} />
        
        <div className="flex items-start gap-3.5 p-5 rounded-2xl bg-white border border-gray-200 shadow-xs">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shrink-0">
            <Zap size={20} />
          </div>
          <div>
            <strong className="block text-gray-900 text-sm mb-1">Multi-threaded</strong>
            <span className="text-sm text-gray-600 leading-snug block">
              Process bulk domains concurrently with <code className="bg-gray-100 px-1 rounded text-xs text-gray-800">-w</code> flag.
            <strong className="block text-gray-900 text-sm font-bold mb-1">Multi-threaded Concurrency</strong>
            <span className="text-xs text-gray-600 leading-relaxed block">
              Dispatch high-volume domain lists concurrently with worker thread pooling (<code className="bg-gray-100 text-gray-800 px-1 py-0.5 rounded font-mono text-[11px]">-w</code> flag).
            </span>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white border border-gray-200 shadow-2xs">
          <Activity className="text-emerald-500 shrink-0 mt-0.5" size={20} />

        <div className="flex items-start gap-3.5 p-5 rounded-2xl bg-white border border-gray-200 shadow-xs">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
            <Activity size={20} />
          </div>
          <div>
            <strong className="block text-gray-900 text-sm mb-1">Matrix Generation</strong>
            <span className="text-sm text-gray-600 leading-snug block">
              Auto-expand scopes using 140+ common recon subdomains.
            <strong className="block text-gray-900 text-sm font-bold mb-1">Cartesian Scope Matrix</strong>
            <span className="text-xs text-gray-600 leading-relaxed block">
              Automatically expand target lists across 140+ common subdomains, root/www, and HTTP/HTTPS variants.
            </span>
          </div>
        </div>
      </div>

      {/* Main Documentation Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Installation & Examples */}
        {/* Left Column: Installation & Quick Start */}
        <div className="lg:col-span-5 space-y-8">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">🛠️ Full Setup (CLI + Web UI)</h2>
          {/* Quick Setup */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Terminal size={18} className="text-blue-600" />
                <span>Quick Setup (CLI + Web UI)</span>
              </h2>
              <button
                onClick={() =>
                  handleCopy(
                    'git clone https://github.com/deadjdona/urlscan.io-submitter.git\ncd urlscan.io-submitter\npython -m venv venv\nsource venv/bin/activate\npip install .\nexport URLSCAN_API_KEY="your-api-key"\nnpm install\nnpm run dev',
                    'git clone https://github.com/deadjdona/urlscan.io-submitter.git\ncd urlscan.io-submitter\npython -m venv venv\nsource venv/bin/activate  # Windows: venv\\Scripts\\activate\npip install .\nexport URLSCAN_API_KEY="your-api-key"\nnpm install\nnpm run dev',
                    'install'
                  )
                }
                className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-md"
                className="text-xs flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg font-medium cursor-pointer"
              >
                {copiedSection === 'install' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                {copiedSection === 'install' ? 'Copied' : 'Copy All'}
                {copiedSection === 'install' ? 'Copied' : 'Copy Commands'}
              </button>
            </div>
            <div className="bg-[#0D1117] rounded-xl p-5 text-[13px] font-mono text-gray-300 shadow-inner space-y-5 overflow-x-auto border border-gray-800">

            <div className="bg-[#0D1117] rounded-xl p-4 text-[12px] font-mono text-gray-300 shadow-inner space-y-4 overflow-x-auto border border-gray-800">
              <div>
                <p className="text-gray-500 mb-1"># 1. Clone repository</p>
                <p className="mb-1"><span className="text-blue-400">git</span> clone https://github.com/deadjdona/urlscan.io-submitter.git</p>
                <p className="mb-1"><span className="text-blue-400">cd</span> urlscan.io-submitter</p>
                <p className="text-blue-400">git <span className="text-gray-300">clone https://github.com/deadjdona/urlscan.io-submitter.git</span></p>
                <p className="text-blue-400">cd <span className="text-gray-300">urlscan.io-submitter</span></p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># 2. Setup Python CLI Tool</p>
                <p className="mb-1"><span className="text-blue-400">python</span> -m venv venv</p>
                <p className="mb-1"><span className="text-blue-400">source</span> venv/bin/activate</p>
                <p><span className="text-blue-400">pip</span> install .</p>
                <p className="text-gray-500 mb-1"># 2. Setup Python environment & install CLI</p>
                <p className="text-blue-400">python <span className="text-gray-300">-m venv venv</span></p>
                <p className="text-blue-400">source <span className="text-gray-300">venv/bin/activate</span>  <span className="text-gray-500"># Windows: venv\Scripts\activate</span></p>
                <p className="text-blue-400">pip <span className="text-gray-300">install .</span></p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># 3. Setup Web Dashboard & Node.js Server</p>
                <p className="mb-1"><span className="text-blue-400">npm</span> install</p>
                <p><span className="text-blue-400">npm</span> run dev</p>
                <p className="text-gray-500 mb-1"># 3. Configure API Key</p>
                <p className="text-blue-400">export <span className="text-yellow-300">URLSCAN_API_KEY</span>=<span className="text-green-400">"your-api-key-here"</span></p>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># 4. Configure your API key</p>
                <p className="mb-1"><span className="text-blue-400">export</span> URLSCAN_API_KEY="your-api-key"</p>
                <p className="text-gray-500 mb-1"># 4. Optional: Start Web Dashboard</p>
                <p className="text-blue-400">npm <span className="text-gray-300">install</span></p>
                <p className="text-blue-400">npm <span className="text-gray-300">run dev</span>  <span className="text-gray-500"># Opens dashboard on http://localhost:3000</span></p>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-base font-bold mb-3 text-gray-900">🚀 CLI Usage Examples</h2>
            <div className="bg-[#0D1117] rounded-xl p-5 text-[13px] font-mono text-gray-300 shadow-inner space-y-4 overflow-x-auto border border-gray-800">
              <div>
                <p className="text-gray-500 mb-1"># Basic single domain scan</p>
                <p><span className="text-yellow-300">urlscan-submit</span> -d example.com</p>
          {/* Authentication & Config Priority Guide */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Key size={18} className="text-amber-500" />
              <span>Authentication & Config Hierarchy</span>
            </h2>
            <p className="text-xs text-gray-600 leading-relaxed">
              The tool searches for your urlscan.io API key in the following priority order:
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                <span className="font-bold text-blue-600 font-mono">1</span>
                <div>
                  <strong className="text-gray-900 block">Explicit Key File CLI Argument</strong>
                  <code className="text-gray-600 text-[11px] font-mono">urlscan-submit -k /path/to/key.txt</code>
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># High-speed bulk scanning (10 workers)</p>
                <p><span className="text-yellow-300">urlscan-submit</span> -f massive_list.txt -w 10</p>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                <span className="font-bold text-blue-600 font-mono">2</span>
                <div>
                  <strong className="text-gray-900 block">Configuration File</strong>
                  <span className="text-gray-600">Defined in <code className="font-mono text-[11px]">.urlscan-config.json</code> or <code className="font-mono text-[11px]">.urlscan-config.yaml</code> in CWD or Home dir.</span>
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># Deep reconnaissance with JSON output</p>
                <p className="mb-1"><span className="text-gray-500 text-xs"># Scans http/https, root/www, and 140+ subdomains</span></p>
                <p><span className="text-yellow-300">urlscan-submit</span> -d target.com -j output.json -p both -s both -xxx</p>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                <span className="font-bold text-blue-600 font-mono">3</span>
                <div>
                  <strong className="text-gray-900 block">Environment Variable</strong>
                  <code className="text-gray-600 text-[11px] font-mono">export URLSCAN_API_KEY="your-key"</code>
                </div>
              </div>

              <div>
                <p className="text-gray-500 mb-1"># Private bulk scan + summary + export</p>
                <p className="mb-1"><span className="text-yellow-300">urlscan-submit</span> -e summary.csv \</p>
                <p className="mb-1 pl-4">-f domains.txt -j logs.json \</p>
                <p className="pl-4">-p both -r -V private</p>
              <div className="flex items-start gap-2.5 p-2.5 rounded-lg bg-gray-50 border border-gray-200">
                <span className="font-bold text-blue-600 font-mono">4</span>
                <div>
                  <strong className="text-gray-900 block">Local Text File Fallback</strong>
                  <span className="text-gray-600">Checks for a file named <code className="font-mono text-[11px]">./api_key.txt</code> in the current directory.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Programmatic Python Usage */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Code2 size={18} className="text-indigo-600" />
                <span>Python Scripting Integration</span>
              </h2>
              <button
                onClick={() =>
                  handleCopy(
                    'from urlscan_submit import submit_to_urlscan, get_scan_report\n\n# 1. Submit scan\nres = submit_to_urlscan(\n    "https://example.com",\n    api_key="YOUR_API_KEY",\n    visibility="private",\n    tags=["automation"]\n)\n\n# 2. Retrieve report\nif res and "uuid" in res:\n    report = get_scan_report(res["uuid"], api_key="YOUR_API_KEY")\n    print(f"Malicious verdict: {report.get(\'verdicts\', {}).get(\'overall\', {}).get(\'malicious\')}")',
                    'python-code'
                  )
                }
                className="text-xs flex items-center gap-1.5 text-gray-600 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-md font-medium cursor-pointer"
              >
                {copiedSection === 'python-code' ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                {copiedSection === 'python-code' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-600">
              Import <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-800">urlscan_submit</code> directly in your security scripts:
            </p>
            <div className="bg-[#0D1117] rounded-xl p-4 text-[12px] font-mono text-gray-300 shadow-inner overflow-x-auto border border-gray-800">
              <p className="text-purple-400">from <span className="text-yellow-300">urlscan_submit</span> import <span className="text-blue-300">submit_to_urlscan, get_scan_report</span></p>
              <br />
              <p className="text-gray-500"># Submit URL with backoff & error handling</p>
              <p className="text-gray-300">res = submit_to_urlscan(</p>
              <p className="text-gray-300 pl-4"><span className="text-green-300">"https://example.com"</span>,</p>
              <p className="text-gray-300 pl-4">api_key=<span className="text-green-300">"YOUR_KEY"</span>,</p>
              <p className="text-gray-300 pl-4">visibility=<span className="text-green-300">"private"</span>,</p>
              <p className="text-gray-300 pl-4">tags=[<span className="text-green-300">"automation"</span>]</p>
              <p className="text-gray-300">)</p>
            </div>
          </div>
        </div>

        {/* Right Column: Parameters */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <h2 className="text-base font-bold mb-3 text-gray-900">📋 Parameters & CLI Flags</h2>
            <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-xs bg-white">
        {/* Right Column: Workflows, Parameters & Troubleshooting */}
        <div className="lg:col-span-7 space-y-8">
          {/* Security Workflow Playbooks */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
                  <FileText size={18} className="text-blue-600" />
                  <span>Workflow Playbooks & Recipes</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">Common operational commands for security analysts</p>
              </div>

              {/* Playbook Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl text-xs font-medium">
                <button
                  onClick={() => setActivePlaybook('recon')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activePlaybook === 'recon' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Recon
                </button>
                <button
                  onClick={() => setActivePlaybook('phishing')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activePlaybook === 'phishing' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Phishing
                </button>
                <button
                  onClick={() => setActivePlaybook('stealth')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activePlaybook === 'stealth' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Stealth
                </button>
                <button
                  onClick={() => setActivePlaybook('automation')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    activePlaybook === 'automation' ? 'bg-white text-blue-600 shadow-2xs font-bold' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Exports
                </button>
              </div>
            </div>

            {/* Playbook Content */}
            {activePlaybook === 'recon' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-blue-900 font-bold">1. Full Attack Surface Reconnaissance</strong>
                    <button
                      onClick={() => handleCopy('urlscan-submit -d target.com -p both -s both -xxx -j full_recon.json', 'pb-recon')}
                      className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      {copiedSection === 'pb-recon' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedSection === 'pb-recon' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Combines HTTP/HTTPS, root/www, and +140 common infrastructure subdomains (<code className="font-mono bg-blue-100/70 text-blue-900 px-1 rounded">auth</code>, <code className="font-mono bg-blue-100/70 text-blue-900 px-1 rounded">sso</code>, <code className="font-mono bg-blue-100/70 text-blue-900 px-1 rounded">grafana</code>, <code className="font-mono bg-blue-100/70 text-blue-900 px-1 rounded">k8s</code>, <code className="font-mono bg-blue-100/70 text-blue-900 px-1 rounded">db</code>) and dumps raw telemetry to JSON.
                  </p>
                  <pre className="bg-[#0D1117] text-yellow-300 p-3 rounded-lg font-mono overflow-x-auto text-[11px]">
urlscan-submit -d target.com -p both -s both -xxx -j full_recon.json
                  </pre>
                </div>
              </div>
            )}

            {activePlaybook === 'phishing' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-purple-900 font-bold">2. Bulk Phishing Campaign Triage</strong>
                    <button
                      onClick={() => handleCopy('urlscan-submit -f suspicious_urls.txt -V unlisted --tags "phish-triage,campaign-12" -e report.csv -r -w 8', 'pb-phish')}
                      className="text-xs text-purple-700 hover:text-purple-900 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      {copiedSection === 'pb-phish' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedSection === 'pb-phish' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Submit suspected phishing links concurrently using 8 workers with unlisted visibility, wait for verdicts, and output a CSV summary with malicious scores and IP data.
                  </p>
                  <pre className="bg-[#0D1117] text-yellow-300 p-3 rounded-lg font-mono overflow-x-auto text-[11px]">
urlscan-submit -f suspicious_urls.txt -V unlisted --tags "phish-triage,campaign-12" -e report.csv -r -w 8
                  </pre>
                </div>
              </div>
            )}

            {activePlaybook === 'stealth' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-amber-900 font-bold">3. Evasion & Traffic Spoofing</strong>
                    <button
                      onClick={() => handleCopy('urlscan-submit -d sensitive-target.com --delay 2.5 --country de --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" --referer "https://google.com" -V private', 'pb-stealth')}
                      className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      {copiedSection === 'pb-stealth' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedSection === 'pb-stealth' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    Scans from a German exit node (<code className="font-mono bg-amber-100 text-amber-900 px-1 rounded">--country de</code>), spoofing Google referer headers and realistic Chrome browser User-Agent with a 2.5s pacing delay.
                  </p>
                  <pre className="bg-[#0D1117] text-yellow-300 p-3 rounded-lg font-mono overflow-x-auto text-[11px]">
urlscan-submit -d sensitive-target.com --delay 2.5 --country de \
  --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" \
  --referer "https://google.com" -V private
                  </pre>
                </div>
              </div>
            )}

            {activePlaybook === 'automation' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <strong className="text-emerald-900 font-bold">4. SIEM / SOAR Pipeline Ingestion</strong>
                    <button
                      onClick={() => handleCopy('urlscan-submit -f daily_domain_feed.txt -j daily_siem_feed.json -w 12 --tags "siem-cron" -V private', 'pb-auto')}
                      className="text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1 font-medium cursor-pointer"
                    >
                      {copiedSection === 'pb-auto' ? <Check size={12} /> : <Copy size={12} />}
                      {copiedSection === 'pb-auto' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-gray-600 leading-relaxed">
                    High-throughput batch submission for daily feed ingestion directly into Splunk, Elastic, or OpenSearch.
                  </p>
                  <pre className="bg-[#0D1117] text-yellow-300 p-3 rounded-lg font-mono overflow-x-auto text-[11px]">
urlscan-submit -f daily_domain_feed.txt -j daily_siem_feed.json -w 12 --tags "siem-cron" -V private
                  </pre>
                </div>
              </div>
            )}
          </div>

          {/* Full CLI Parameters & Options Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Sliders size={18} className="text-blue-600" />
              <span>Full CLI Parameters & Option Reference</span>
            </h2>
            <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-2xs">
              <table className="min-w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 font-semibold w-1/3">Argument</th>
                    <th className="px-4 py-3 font-semibold">Description</th>
                    <th className="px-4 py-3 font-semibold w-2/5">Flag & Syntax</th>
                    <th className="px-4 py-3 font-semibold">Purpose & Defaults</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                <tbody className="divide-y divide-gray-100 font-sans">
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-c, --config, -⚙</td>
                    <td className="px-4 py-2.5 text-gray-600">Path to JSON or YAML config file. Defaults to <code className="bg-gray-100 px-1 rounded">.urlscan-config.json</code>.</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">-d, --domain &lt;DOMAIN&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Single base target domain or IPv4 address (e.g. <code className="bg-gray-100 px-1 rounded">example.com</code>).</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-d, --domain, -🎯</td>
                    <td className="px-4 py-2.5 text-gray-600">A single base domain to scan.</td>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">-f, --file &lt;FILE&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Path to text file with domain list (one domain per line, ignores <code className="bg-gray-100 px-1 rounded">#</code> comments).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">--delay, -🐢</td>
                    <td className="px-4 py-2.5 text-gray-600">Intentional delay in seconds between thread dispatches (e.g. <code className="bg-gray-100 px-1 rounded">-🐢 1.5</code>).</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">-p, --protocols &lt;P&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Protocol generation: <code className="bg-gray-100 px-1 rounded font-mono">http</code>, <code className="bg-gray-100 px-1 rounded font-mono">https</code>, or <code className="bg-gray-100 px-1 rounded font-mono">both</code> (default: <code className="font-mono">https</code>).</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-e, --export-csv, -📊</td>
                    <td className="px-4 py-2.5 text-gray-600">Export summary results to a CSV file (e.g. <code className="bg-gray-100 px-1 rounded">results.csv</code>).</td>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">-s, --subdomains &lt;S&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Base prefix: <code className="bg-gray-100 px-1 rounded font-mono">root</code>, <code className="bg-gray-100 px-1 rounded font-mono">www</code>, or <code className="bg-gray-100 px-1 rounded font-mono">both</code> (default: <code className="font-mono">root</code>).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-f, --file, -📁</td>
                    <td className="px-4 py-2.5 text-gray-600">Path to a text file containing domains.</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">-x / -xx / -xxx</td>
                    <td className="px-4 py-2.5 text-gray-600">Cartesian exploration matrix: Basic (+20), Deep (+60), or Massive (+140) common subdomains.</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-j, --json-log, -📜</td>
                    <td className="px-4 py-2.5 text-gray-600">Export full raw API results to a JSON file.</td>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">--wordlist &lt;FILE&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Supply your own custom wordlist of subdomains to generate combinations against targets.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-p, --protocols, -🌐</td>
                    <td className="px-4 py-2.5 text-gray-600">Protocols: <code className="bg-gray-100 px-1 rounded">http</code>, <code className="bg-gray-100 px-1 rounded">https</code>, <code className="bg-gray-100 px-1 rounded">both</code>.</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">-w, --workers &lt;N&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Number of parallel worker threads in the ThreadPool (default: 1).</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-r, --report, -📝</td>
                    <td className="px-4 py-2.5 text-gray-600">Wait for scan to finish and print a summary report.</td>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">--delay &lt;SECONDS&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Intentional delay floor in seconds between worker dispatches to stay under rate limits.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-s, --subdomains, -🏢</td>
                    <td className="px-4 py-2.5 text-gray-600">Base subdomains applied: <code className="bg-gray-100 px-1 rounded">root</code>, <code className="bg-gray-100 px-1 rounded">www</code>, <code className="bg-gray-100 px-1 rounded">both</code>.</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">-V, --visibility &lt;V&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600"><code className="bg-gray-100 px-1 rounded font-mono">public</code> (feed), <code className="bg-gray-100 px-1 rounded font-mono">unlisted</code> (link-only), or <code className="bg-gray-100 px-1 rounded font-mono">private</code> (team-only).</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-V, --visibility, -👻</td>
                    <td className="px-4 py-2.5 text-gray-600">Scan visibility: <code className="bg-gray-100 px-1 rounded">public</code>, <code className="bg-gray-100 px-1 rounded">unlisted</code>, <code className="bg-gray-100 px-1 rounded">private</code>.</td>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">-e &lt;CSV&gt; / -j &lt;JSON&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Export formatted summary report to CSV or full raw response payload to JSON.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-w, --workers, -🚀</td>
                    <td className="px-4 py-2.5 text-gray-600">Number of concurrent background workers (e.g. <code className="bg-gray-100 px-1 rounded">-w 4</code>).</td>
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">--tags &lt;T1,T2&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">Comma-separated list of tags to tag submissions on urlscan.io (max 10).</td>
                  </tr>
                  <tr className="bg-gray-50/40">
                    <td className="px-4 py-2.5 font-mono font-semibold text-blue-600">-x / -xx / -xxx</td>
                    <td className="px-4 py-2.5 text-gray-600">Exploratory Cartesian matrix: Basic (+20), Deep (+60), Massive (+140).</td>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-2.5 font-mono font-bold text-blue-600">--country &lt;CC&gt;</td>
                    <td className="px-4 py-2.5 text-gray-600">2-letter ISO country code scanner gateway to scan from (<code className="font-mono">us</code>, <code className="font-mono">de</code>, <code className="font-mono">jp</code>, <code className="font-mono">nl</code>).</td>
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
          {/* Troubleshooting & FAQ Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-6 space-y-4">
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <HelpCircle size={18} className="text-emerald-600" />
              <span>Troubleshooting & FAQ</span>
            </h2>

            <div className="space-y-3 text-xs">
              {/* Rate Limits FAQ */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq('rate-limits')}
                  className="w-full p-3.5 bg-gray-50/70 hover:bg-gray-100 transition-colors flex items-center justify-between text-left font-bold text-gray-900 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle size={15} className="text-amber-500" />
                    <span>How does rate limiting (HTTP 429) work & how does the tool evade bans?</span>
                  </span>
                  {openFaq['rate-limits'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {openFaq['rate-limits'] && (
                  <div className="p-4 bg-white space-y-2 text-gray-600 border-t border-gray-200 leading-relaxed">
                    <p>
                      urlscan.io enforces submission quotas based on your account tier (e.g. Community free accounts allow 1 scan/second and 100/day).
                    </p>
                    <p>
                      When a 429 is encountered, <strong className="text-gray-900">urlscan-submit</strong> parses the <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[11px]">X-Rate-Limit-Reset-After</code> header provided by urlscan's gateway, automatically suspends the throttled worker thread for the exact remaining duration (+1s buffer), and resumes immediately when the bucket replenishes. If headers are absent, it uses deterministic 3s &rarr; 6s &rarr; 12s exponential backoff.
                    </p>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">2. Intelligent Concurrency</h3>
                <p className="leading-relaxed">
                  Network boundaries are IO-bound tasks. The tool utilizes thread pooling with worker dispatch queues and dynamic rate-limit management.
                </p>

              {/* Visibility FAQ */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq('visibility')}
                  className="w-full p-3.5 bg-gray-50/70 hover:bg-gray-100 transition-colors flex items-center justify-between text-left font-bold text-gray-900 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Globe size={15} className="text-blue-500" />
                    <span>What is the difference between Public, Unlisted, and Private scans?</span>
                  </span>
                  {openFaq['visibility'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {openFaq['visibility'] && (
                  <div className="p-4 bg-white space-y-2 text-gray-600 border-t border-gray-200 leading-relaxed">
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong className="text-gray-900 font-semibold">Public:</strong> Scan results, screenshots, and DOM telemetry are visible on urlscan.io's public search feed and indexed in threat feeds.</li>
                      <li><strong className="text-gray-900 font-semibold">Unlisted:</strong> Not indexed in the public search feed, but accessible by anyone with the direct UUID link.</li>
                      <li><strong className="text-gray-900 font-semibold">Private:</strong> Restricted strictly to your account/team on urlscan.io. Requires an active subscription or enterprise API key.</li>
                    </ul>
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">3. Native Rate Limit Evasion</h3>
                <p className="leading-relaxed">
                  Urlscan restricts submissions via the <code className="bg-gray-100 px-1 rounded font-mono">X-Rate-Limit-Reset-After</code> header alongside HTTP 429. The tool parses the reset window and suspends only the affected worker thread until the quota bucket recovers.
                </p>

              {/* API Key FAQ */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq('api-key')}
                  className="w-full p-3.5 bg-gray-50/70 hover:bg-gray-100 transition-colors flex items-center justify-between text-left font-bold text-gray-900 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Key size={15} className="text-amber-500" />
                    <span>Why am I getting "HTTP 401 Unauthorized" or "API key is not set"?</span>
                  </span>
                  {openFaq['api-key'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {openFaq['api-key'] && (
                  <div className="p-4 bg-white space-y-2 text-gray-600 border-t border-gray-200 leading-relaxed">
                    <p>
                      Ensure you have created an API key on <a href="https://urlscan.io/user/profile" target="_blank" rel="noreferrer" className="text-blue-600 underline">urlscan.io/user/profile</a> with submission permissions.
                    </p>
                    <p>
                      Set your key in your terminal session with:
                      <code className="block bg-gray-900 text-yellow-300 p-2 rounded mt-1 font-mono">export URLSCAN_API_KEY="your-uuid-key"</code>
                      Or create a file named <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">api_key.txt</code> in your working folder.
                    </p>
                  </div>
                )}
              </div>

              {/* Matrix FAQ */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq('matrix')}
                  className="w-full p-3.5 bg-gray-50/70 hover:bg-gray-100 transition-colors flex items-center justify-between text-left font-bold text-gray-900 cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Layers size={15} className="text-indigo-500" />
                    <span>How does Cartesian Scope Matrix generation work mathematically?</span>
                  </span>
                  {openFaq['matrix'] ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                {openFaq['matrix'] && (
                  <div className="p-4 bg-white space-y-2 text-gray-600 border-t border-gray-200 leading-relaxed">
                    <p>
                      When you submit a domain like <code className="font-mono bg-gray-100 px-1 rounded">target.com</code> with <code className="font-mono bg-gray-100 px-1 rounded">-p both -s both -x</code>:
                    </p>
                    <div className="p-2.5 bg-gray-50 rounded-lg font-mono text-[11px] text-gray-800 border border-gray-200">
                      Total URLs = [HTTP, HTTPS] (2) × [root, www, +20 exploratory subdomains] (22) × [1 base domain] = 44 total scan submissions.
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

