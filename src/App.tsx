import React, { useState } from 'react';
import { Terminal, Copy, Check, Shield, Zap, Activity } from 'lucide-react';

export default function App() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 font-sans text-gray-800 selection:bg-blue-100 selection:text-blue-900">
      <div className="max-w-6xl w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sm:p-10 transition-all hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-gray-100 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 text-blue-700 rounded-xl shadow-inner">
              <Terminal size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 tracking-tight">urlscan-submitter</h1>
              <p className="text-sm text-gray-500 font-medium mt-1">High-performance bulk submission & reconnaissance</p>
            </div>
          </div>
          <div className="flex gap-2">
             <span className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold uppercase tracking-wider border border-green-200">v1.2.0</span>
             <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-200">Python 3.7+</span>
          </div>
        </div>
        
        <p className="mb-6 text-gray-600 leading-relaxed text-lg max-w-4xl">
          This workspace contains a Python CLI tool for automating <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-800 font-mono text-sm border border-gray-200">urlscan.io</code> domain submissions. You can download the source files from the left sidebar to use locally on your machine.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <Shield className="text-indigo-500 shrink-0 mt-0.5" size={20} />
            <div>
              <strong className="block text-gray-900 text-sm mb-1">Smart Rate Limiting</strong>
              <span className="text-sm text-gray-600 leading-snug block">Auto-pauses accurately based on <code className="bg-gray-200 px-1 rounded text-xs">X-Rate-Limit</code> headers.</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <Zap className="text-amber-500 shrink-0 mt-0.5" size={20} />
            <div>
              <strong className="block text-gray-900 text-sm mb-1">Multi-threaded</strong>
              <span className="text-sm text-gray-600 leading-snug block">Process bulk domains concurrently with <code className="bg-gray-200 px-1 rounded text-xs">-w</code> flag.</span>
            </div>
          </div>
          <div className="flex items-start gap-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
            <Activity className="text-emerald-500 shrink-0 mt-0.5" size={20} />
            <div>
              <strong className="block text-gray-900 text-sm mb-1">Matrix Generation</strong>
              <span className="text-sm text-gray-600 leading-snug block">Auto-expand scopes using 140+ common recon subdomains.</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Left Column: Installation & Examples */}
          <div className="lg:col-span-5 space-y-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">🛠️ Installation</h2>
                <button 
                  onClick={() => handleCopy('git clone https://github.com/yourusername/urlscan-submitter.git\ncd urlscan-submitter\npython -m venv venv\nsource venv/bin/activate\npip install .\nexport URLSCAN_API_KEY="your-api-key"', 'install')}
                  className="text-xs flex items-center gap-1.5 text-gray-500 hover:text-gray-900 transition-colors bg-gray-100 hover:bg-gray-200 px-2.5 py-1.5 rounded-md"
                >
                  {copiedSection === 'install' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                  {copiedSection === 'install' ? 'Copied' : 'Copy All'}
                </button>
              </div>
              <div className="bg-[#0D1117] rounded-xl p-5 text-[13px] font-mono text-gray-300 shadow-inner space-y-5 overflow-x-auto border border-gray-800">
                <div>
                  <p className="text-gray-500 mb-1"># 1. Clone repository and setup virtual env</p>
                  <p className="mb-1"><span className="text-blue-400">git</span> clone https://github.com/yourusername/urlscan-submitter.git</p>
                  <p className="mb-1"><span className="text-blue-400">cd</span> urlscan-submitter</p>
                  <p className="mb-1"><span className="text-blue-400">python</span> -m venv venv</p>
                  <p><span className="text-blue-400">source</span> venv/bin/activate</p>
                </div>
                
                <div>
                  <p className="text-gray-500 mb-1"># 2. Install the tool globally in your env</p>
                  <p><span className="text-blue-400">pip</span> install .</p>
                </div>
                
                <div>
                  <p className="text-gray-500 mb-1"># 3. Configure your urlscan.io API key</p>
                  <p className="mb-1"><span className="text-blue-400">export</span> URLSCAN_API_KEY="your-api-key"</p>
                  <p className="text-gray-500 text-xs"># OR create a config file:</p>
                  <p><span className="text-blue-400">echo</span> <span className="text-green-300">'{'{"api_key": "YOUR_KEY", "explore": true}'}'</span> &gt; .urlscan-config.json</p>
                </div>
              </div>
            </div>
            
            <div className="mt-8">
              <h2 className="text-lg font-semibold mb-3 text-gray-900">🚀 Examples</h2>
              <div className="bg-[#0D1117] rounded-xl p-5 text-[13px] font-mono text-gray-300 shadow-inner space-y-5 overflow-x-auto border border-gray-800">
                <div>
                  <p className="text-gray-500 mb-1.5"># Basic single domain scan</p>
                  <p><span className="text-yellow-300">urlscan-submit</span> -d example.com</p>
                </div>
                
                <div>
                  <p className="text-gray-500 mb-1.5"># High-speed bulk scanning (10 workers)</p>
                  <p><span className="text-yellow-300">urlscan-submit</span> -f massive_list.txt -w 10</p>
                </div>
                
                <div>
                  <p className="text-gray-500 mb-1.5"># Deep reconnaissance with JSON output</p>
                  <p className="mb-1.5"><span className="text-gray-500 text-xs"># Scans http/https, root/www, and 140+ subdomains</span></p>
                  <p><span className="text-yellow-300">urlscan-submit</span> -d target.com -j output.json -p both -s both -xxx</p>
                </div>
  
                <div>
                  <p className="text-gray-500 mb-1.5"># Private bulk scan + summary + export</p>
                  <p className="mb-1.5"><span className="text-yellow-300">urlscan-submit</span> -e summary.csv \</p>
                  <p className="mb-1.5 pl-4">-f domains.txt -j logs.json \</p>
                  <p className="pl-4">-p both -r -V private</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Parameters */}
          <div className="lg:col-span-7">
            <h2 className="text-lg font-semibold mb-3 text-gray-900">📋 Parameters List</h2>
            <div className="border border-gray-200 rounded-xl overflow-x-auto shadow-sm bg-white">
              <table className="min-w-full text-sm text-left whitespace-nowrap lg:whitespace-normal">
                <thead className="bg-gray-50 text-gray-700 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 border-b font-medium w-1/3">Argument</th>
                    <th className="px-4 py-3 border-b font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-c, --config, -⚙</td>
                    <td className="px-4 py-3 text-gray-600">Path to JSON or YAML config file. Defaults to <code className="text-xs bg-gray-100 px-1 rounded">.urlscan-config.json</code> in the current or home directory.</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-d, --domain, -🎯</td>
                    <td className="px-4 py-3 text-gray-600">A single base domain to scan.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">--delay, -🐢</td>
                    <td className="px-4 py-3 text-gray-600">Intentional delay in seconds between thread dispatches (e.g., <code className="text-xs bg-gray-100 px-1 rounded">-🐢 1.5</code>).</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-e, --export-csv, -📊</td>
                    <td className="px-4 py-3 text-gray-600">Export summary results to a CSV file (e.g. <code className="text-xs bg-gray-100 px-1 rounded">results.csv</code>).</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-f, --file, -📁</td>
                    <td className="px-4 py-3 text-gray-600">Path to a text file containing domains.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-j, --json-log, -📜</td>
                    <td className="px-4 py-3 text-gray-600">Export full raw API results to a JSON file (e.g. <code className="text-xs bg-gray-100 px-1 rounded">results.json</code>).</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-k, --api-key-file, -🔑</td>
                    <td className="px-4 py-3 text-gray-600">Path to API key file. Defaults to <code className="text-xs font-semibold">api_key.txt</code> in current dir.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-p, --protocols, -🌐</td>
                    <td className="px-4 py-3 text-gray-600">Protocols applied to all subdomains: <code className="text-xs bg-gray-100 px-1 rounded">http</code>, <code className="text-xs bg-gray-100 px-1 rounded">https</code>, <code className="text-xs bg-gray-100 px-1 rounded">both</code>. Defaults to <code className="text-xs font-semibold">https</code>.</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-r, --report, -📝</td>
                    <td className="px-4 py-3 text-gray-600">Wait for scan to finish and print a summary report.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-s, --subdomains, -🏢</td>
                    <td className="px-4 py-3 text-gray-600">Base subdomains applied: <code className="text-xs bg-gray-100 px-1 rounded">root</code>, <code className="text-xs bg-gray-100 px-1 rounded">www</code>, <code className="text-xs bg-gray-100 px-1 rounded">both</code>. Defaults to <code className="text-xs font-semibold">root</code>.</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-v, --verbose, -🔊</td>
                    <td className="px-4 py-3 text-gray-600">Enable verbose HTTP request debugging.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-V, --visibility, -👻</td>
                    <td className="px-4 py-3 text-gray-600">Scan visibility: <code className="text-xs bg-gray-100 px-1 rounded">public</code>, <code className="text-xs bg-gray-100 px-1 rounded">unlisted</code>, <code className="text-xs bg-gray-100 px-1 rounded">private</code>. Defaults to <code className="text-xs font-semibold">public</code>.</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-w, --workers, -🚀</td>
                    <td className="px-4 py-3 text-gray-600">Number of concurrent background workers to use (e.g., <code className="text-xs bg-gray-100 px-1 rounded">-w 4</code>). Defaults to 1 (sequential).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">--wordlist, -📖</td>
                    <td className="px-4 py-3 text-gray-600">Path to a custom wordlist file to generate subdomains (overrides built-in lists).</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-x, --explore, -🔍</td>
                    <td className="px-4 py-3 text-gray-600">Submit an additional list of 20+ common exploratory subdomains (e.g., <code className="text-xs bg-gray-100 px-1 rounded">mail</code>, <code className="text-xs bg-gray-100 px-1 rounded">ftp</code>).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-xx, --deep-explore, -🤿</td>
                    <td className="px-4 py-3 text-gray-600">Massive scope list of 60+ subdomains (e.g., <code className="text-xs bg-gray-100 px-1 rounded">auth</code>, <code className="text-xs bg-gray-100 px-1 rounded">api</code>, <code className="text-xs bg-gray-100 px-1 rounded">beta</code>, <code className="text-xs bg-gray-100 px-1 rounded">jenkins</code>).</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">-xxx, --massive-explore, -🌌</td>
                    <td className="px-4 py-3 text-gray-600">Exhaustive scope list of 140+ subdomains (e.g., <code className="text-xs bg-gray-100 px-1 rounded">sso</code>, <code className="text-xs bg-gray-100 px-1 rounded">grafana</code>, <code className="text-xs bg-gray-100 px-1 rounded">redis</code>, <code className="text-xs bg-gray-100 px-1 rounded">vpn</code>).</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">--tags, -🏷</td>
                    <td className="px-4 py-3 text-gray-600">Comma-separated list of tags to apply to the scan (max 10 tags).</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">--user-agent, -🤖</td>
                    <td className="px-4 py-3 text-gray-600">Override the default User-Agent header for the scan.</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">--referer, -🔗</td>
                    <td className="px-4 py-3 text-gray-600">Override the HTTP Referer header for the scan.</td>
                  </tr>
                  <tr className="bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-blue-600 whitespace-nowrap">--country, -🌍</td>
                    <td className="px-4 py-3 text-gray-600">2-letter ISO country code to scan from (e.g., <code className="text-xs bg-gray-100 px-1 rounded">us</code>, <code className="text-xs bg-gray-100 px-1 rounded">de</code>).</td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <div className="mt-10">
              <h2 className="text-lg font-semibold mb-3 text-gray-900">⚙️ How It Works (Architecture)</h2>
              <div className="space-y-6 text-sm text-gray-600 bg-gray-50 p-6 rounded-xl border border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">1. Cartesian Matrix Generation</h3>
                  <p className="leading-relaxed">Instead of writing complex bash loops to handle <code className="bg-gray-200 px-1 rounded">http/https</code> combinations or <code className="bg-gray-200 px-1 rounded">www</code> permutations, the tool dynamically generates a multidimensional target list. For example, supplying <code className="bg-gray-200 px-1 rounded">-d target.com -p both -s both -xx</code> produces a matrix of <strong>(HTTP, HTTPS) × (Root, www) × (60+ Subdomains)</strong>, guaranteeing exhaustive coverage without external wrapper scripts.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">2. Intelligent Concurrency</h3>
                  <p className="leading-relaxed">Network boundaries are IO-bound tasks. To execute massive domain lists rapidly, the tool hooks into Python's native <code className="bg-gray-200 px-1 rounded">concurrent.futures.ThreadPoolExecutor</code>. You control the thread pool depth using <code className="bg-gray-200 px-1 rounded">--workers</code>. To ensure visual clarity during async execution, the resulting thread Futures are wrapped in a thread-safe <code className="bg-gray-200 px-1 rounded">tqdm</code> progress bar.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">3. Native Rate Limit Evasion</h3>
                  <p className="leading-relaxed">Urlscan restricts submissions via the <code className="bg-gray-200 px-1 rounded">X-Rate-Limit-Reset-After</code> header alongside standard HTTP 429 errors. The script handles this gracefully by parsing the mathematical reset window provided by the load balancer and suspending <em>only</em> the affected worker thread until the bucket expires (with a 1s padding).</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
