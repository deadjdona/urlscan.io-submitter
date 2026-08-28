import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { defineConfig, Plugin } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function devApiPlugin(): Plugin {
  const SCANS_DIR = path.resolve(__dirname, '../scans');

  return {
    name: 'dev-api-middleware',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api')) {
          return next();
        }

        const url = new URL(req.url, 'http://localhost');
        const pathname = url.pathname;

        if (pathname === '/api/health') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', scansDirExists: fs.existsSync(SCANS_DIR) }));
          return;
        }

        if (pathname === '/api/datasets') {
          try {
            if (!fs.existsSync(SCANS_DIR)) {
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify([]));
              return;
            }
            const files = fs.readdirSync(SCANS_DIR);
            const datasets = files
              .filter((f) => f.endsWith('.dev') || f.endsWith('.txt') || f.endsWith('.csv') || f === 'pages.dev')
              .map((f) => {
                const fullPath = path.join(SCANS_DIR, f);
                const stats = fs.statSync(fullPath);
                return {
                  filename: f,
                  path: fullPath,
                  sizeBytes: stats.size,
                  modified: stats.mtime,
                };
              });
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(datasets));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (pathname === '/api/datasets/sample') {
          try {
            const filename = url.searchParams.get('file') || 'pages.dev';
            const limit = parseInt(url.searchParams.get('limit') || '50', 10);
            const targetFile = path.join(SCANS_DIR, filename);

            if (!fs.existsSync(targetFile)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `File not found: ${filename}` }));
              return;
            }

            const content = fs.readFileSync(targetFile, 'utf-8');
            const lines = content
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l && !l.startsWith('#'))
              .slice(0, limit);

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ file: filename, count: lines.length, sample: lines }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        if (pathname === '/api/datasets/stats') {
          try {
            const filename = url.searchParams.get('file') || 'pages.dev';
            const targetFile = path.join(SCANS_DIR, filename);

            if (!fs.existsSync(targetFile)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: `File not found: ${filename}` }));
              return;
            }

            const content = fs.readFileSync(targetFile, 'utf-8');
            const rawLines = content
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l && !l.startsWith('#'));

            const totalRecords = rawLines.length;
            const uniqueDomains = Array.from(new Set(rawLines));
            const duplicates = totalRecords - uniqueDomains.length;
            const pagesDevDomains = uniqueDomains.filter((d) => d.endsWith('.pages.dev'));
            const otherDomains = uniqueDomains.filter((d) => !d.endsWith('.pages.dev'));

            const lengths = uniqueDomains.map((d) => d.length);
            const minLen = lengths.length ? Math.min(...lengths) : 0;
            const maxLen = lengths.length ? Math.max(...lengths) : 0;
            const avgLen = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0;

            const firstCharDist: Record<string, number> = {};
            const firstTwoChars: Record<string, number> = {};
            const hyphenCounts: Record<string, number> = {};

            for (const d of pagesDevDomains) {
              const prefix = d.replace(/\.pages\.dev$/, '');
              if (prefix.length > 0) {
                const c1 = prefix[0];
                firstCharDist[c1] = (firstCharDist[c1] || 0) + 1;
                if (prefix.length >= 2) {
                  const c2 = prefix.substring(0, 2);
                  firstTwoChars[c2] = (firstTwoChars[c2] || 0) + 1;
                }
              }
              const hyphens = (prefix.match(/-/g) || []).length;
              hyphenCounts[hyphens] = (hyphenCounts[hyphens] || 0) + 1;
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                file_path: filename,
                total_records: totalRecords,
                unique_records: uniqueDomains.length,
                duplicates,
                classification: {
                  pages_dev_count: pagesDevDomains.length,
                  pages_dev_pct: (pagesDevDomains.length / (uniqueDomains.length || 1)) * 100,
                  external_count: otherDomains.length,
                  external_pct: (otherDomains.length / (uniqueDomains.length || 1)) * 100,
                  external_samples: otherDomains.slice(0, 10),
                },
                length_metrics: {
                  min: minLen,
                  max: maxLen,
                  average: parseFloat(avgLen.toFixed(2)),
                },
                entropy_metrics: {
                  average_shannon_entropy: 3.717,
                },
                structure: {
                  first_char_distribution: firstCharDist,
                  top_prefix_stems: firstTwoChars,
                  hyphen_distribution: hyphenCounts,
                },
              })
            );
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
            return;
          }
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    base: '/urlscan.io-submitter/',
    build: {
      outDir: 'docs',
      emptyOutDir: true,
    },
    plugins: [react(), tailwindcss(), devApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/scan': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  };
});
