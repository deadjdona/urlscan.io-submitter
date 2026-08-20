# 🔍 urlscan-submitter

![Python 3.7+](https://img.shields.io/badge/python-3.7+-blue.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Build Status](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-47%25-yellow.svg)
![urlscan.io API](https://img.shields.io/badge/API-urlscan.io-blueviolet)

A high-performance, zero-dependency Python command-line tool to automate malware analysis and reconnaissance using the urlscan.io API. 

## ✨ Features

- **Smart Rate Limiting** 🚦: Intelligently parses urlscan's `X-Rate-Limit-Reset-After` headers to gracefully backoff without getting banned.
- **Multi-threaded Parallel Processing** ⚡: Utilize thread pooling to submit massive lists concurrently with `-w` (workers).
- **Matrix Generation (Exploratory)** 🗺️: Automatically enumerate over 20 (`-x`), 60+ (`-xx`), or 140+ (`-xxx`) common recon subdomains (e.g., `mail`, `admin`, `api`, `auth`, `grafana`, `sso`).
- **Custom Wordlists (`--wordlist, -📖`)** 📝: Provide your own custom wordlist of subdomains via a `.txt` file instead of using the built-in generated lists.
- **Stealth Timing (`--delay, -🐢`)** ⏱️: Add a manual float delay in seconds between threaded dispatches to stagger requests and blend in.
- **Data Exporting** 💾: Dump raw JSON API reports or formatted CSV summaries (`-j`, `-e`).
- **User Info Validation** 🔐: Verifies authentication at runtime to prevent invalid token usage.

## 🛠️ Installation

We recommend using a Python virtual environment to keep dependencies isolated:

```bash
# 1. Clone the repository
git clone https://github.com/deadjdona/urlscan-submitter.git
cd urlscan-submitter

# 2. Create and activate a virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# 3. Install the package
pip install .

# Alternatively, if you are developing on the project:
make install-dev
```

This will install the `urlscan-submit` command into your active environment.

## ⚙️ Setup

You can provide your configuration (and API key) in several ways:

1. **Configuration File** (Recommended for advanced users):
   Create a file named `.urlscan-config.json` or `.urlscan-config.yaml` in your working directory or home directory.
   
   *Example JSON:*
   ```json
   {
       "api_key": "YOUR_API_KEY_HERE",
       "visibility": "private",
       "protocols": "both",
       "subdomains": "root",
       "explore": false
   }
   ```

2. **Environment Variable**: `export URLSCAN_API_KEY="your-api-key-here"`

3. **Simple File**: Create a file named `api_key.txt` in your current working directory just containing the API key string.

## 🚀 Usage

After installation, you can run the tool from anywhere using the `urlscan-submit` command.

### 🎯 Basic Single Domain
```bash
urlscan-submit -d example.com
```

### 🌪️ High-Speed Bulk Scanning
Submit a massive list of domains concurrently using 10 background workers:
```bash
urlscan-submit -f massive_list.txt -w 10
```

### 🤿 Deep Reconnaissance
Scan a target across HTTP/HTTPS, root and www, plus over 140+ common subdomains (`mail`, `admin`, `auth`, `gitlab`, `sso`, etc.), and dump the raw API response to JSON for SIEM ingestion. Because of `-p both` and `-s both`, this will result in generating exhaustive combinations like `http://target.com`, `https://www.target.com`, `http://auth.target.com`, and `https://sso.target.com`:
```bash
urlscan-submit -d target.com -j output.json -p both -s both -xxx
```

### 🧰 The Kitchen Sink
Read from a file, use a specific API key file, generate HTTP/HTTPS variants, set visibility to private, wait for the scan to finish (`-r`), use a custom wordlist, add a 1.5s delay, and export both a CSV summary and JSON log:
```bash
urlscan-submit -e summary.csv -f domains.txt -j logs.json -k custom_key.txt -p both -r -V private --delay 1.5 --wordlist custom_subdomains.txt
```

### 🧠 Advanced API Parameters & Smart Auto-Tagging
Bypass automated restrictions or spoof traffic properties by supplying custom API values:
```bash
urlscan-submit -d target.com --tags "phishing,campaign123" --user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/100.0.0.0 Safari/537.36" --referer "https://google.com" --country de
```
*Note: In addition to any custom tags you pass via `--tags`, the script features a Smart Auto-Tagging engine. It automatically appends contextual metadata tags to your scans based on how you launched them (e.g. `list-my_domains`, `recon-deep`, `custom-wordlist`). This helps you easily organize and query large campaigns within urlscan.io.*

## ⚙️ How It Works (Architecture & Workflow)

The tool acts as a high-performance, resilient interface between your local infrastructure and the urlscan.io cloud backend. The core workflow is designed around these three pillars:

### 1. Cartesian Matrix Generation
Instead of writing complex bash loops to handle `http/https` combinations or `www` permutations, `urlscan-submit` dynamically generates a multidimensional target list.
For example, supplying `-d target.com -p both -s both -xx` produces a matrix:
*(HTTP, HTTPS) × (Root, www) × (60+ Subdomains)*
This guarantees that you cover the full attack surface without writing external wrapper scripts.

### 2. Intelligent Concurrency
Network boundaries are IO-bound tasks. To execute massive domain lists rapidly, the tool hooks into Python's native `concurrent.futures.ThreadPoolExecutor`. 
You control the thread pool depth using `--workers` (`-w`). To ensure visual clarity during async execution, the resulting thread `Futures` are wrapped in a thread-safe `tqdm` progress bar. 

### 3. Native Rate Limit Evasion & Backoff
Urlscan restricts submissions via the `X-Rate-Limit-Reset-After` header alongside standard HTTP 429 errors.
The script handles this gracefully by parsing the mathematical reset window provided by the load balancer and suspending *only* the affected worker thread until the bucket expires (with a 1s padding), allowing other un-throttled threads to continue their dispatch queue. In case the header is stripped, the script falls back to a deterministic 3s -> 6s -> 12s exponential backoff.

## 🧪 Testing

You can run the included unit tests using Python's built-in `unittest` module from the root of the project:

```bash
python -m unittest discover tests/
```

Or, if you prefer using `pytest` (installable via `pip install ".[dev]"`):
```bash
pytest tests/
```
