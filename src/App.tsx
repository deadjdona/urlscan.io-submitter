import React, { useState } from 'react';
import { Terminal, Activity, BarChart3, BookOpen, ExternalLink } from 'lucide-react';
import LiveScanner from './components/LiveScanner';
import DatasetExplorer from './components/DatasetExplorer';
import DocsView from './components/DocsView';

type AppTab = 'scanner' | 'dataset' | 'docs';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('scanner');

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-800 selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navbar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo / Brand */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-xl shadow-xs">
                <Terminal size={22} strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-gray-900 tracking-tight">urlscan-submitter</h1>
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-200">
                    v1.2.0
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 hidden sm:block">
                  Automated Reconnaissance & Rate-Limit Resilient Scanner
                </p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button
                onClick={() => setActiveTab('scanner')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'scanner'
                    ? 'bg-white text-blue-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Activity size={14} />
                <span>Live Scanner</span>
              </button>

              <button
                onClick={() => setActiveTab('dataset')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'dataset'
                    ? 'bg-white text-indigo-600 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BarChart3 size={14} />
                <span>Dataset Tools</span>
              </button>

              <button
                onClick={() => setActiveTab('docs')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'docs'
                    ? 'bg-white text-gray-900 shadow-xs'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <BookOpen size={14} />
                <span>Documentation</span>
              </button>
            </nav>

            {/* External Links */}
            <div className="hidden lg:flex items-center gap-3 text-xs">
              <a
                href="https://urlscan.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-blue-600 transition-colors flex items-center gap-1"
              >
                <span>urlscan.io</span>
                <ExternalLink size={12} />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'scanner' && <LiveScanner />}
        {activeTab === 'dataset' && <DatasetExplorer />}
        {activeTab === 'docs' && <DocsView />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 mt-12 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>urlscan-submitter &amp; pages.dev reconnaissance dataset toolkit</span>
          <span className="text-gray-400">MIT License &bull; Designed for thread safety and rate-limit evasion</span>
        </div>
      </footer>
    </div>
  );
}
