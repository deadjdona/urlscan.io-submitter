# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-08-28

### Added ✨
- **Smart Auto-Tagging Engine**: The script now automatically appends contextual API tags to urlscan submissions based on runtime parameters (e.g., parsing filename stems into tags like `list-phishing_domains`, or appending `recon-explore` / `recon-deep` depending on the scope flags used).
- Expose advanced API parameters allowing spoofing of HTTP traffic parameters and attribution logic: `--tags` (`-🏷`), `--user-agent` (`-🤖`), `--referer` (`-🔗`), and `--country` (`-🌍`).
- Added emoji synonyms/aliases for all CLI parameters (e.g. `-🎯` for `--domain`, `-🚀` for `--workers`).
- Added `--wordlist` (`-📖`) parameter to allow supplying custom text files of subdomains, overriding the built-in generated scope lists.
- Added `--delay` (`-🐢`) parameter to introduce manual float-based sleep delays between thread dispatches to prevent aggressive bursting and blend in.
- Added `-xxx` (`--massive-explore`, `-🌌`) flag to scan exhaustive-scope Cartesian permutations using 140+ subdomains (e.g., `sso`, `grafana`, `redis`, `vpn`).
- Added `-xx` (`--deep-explore`, `-🤿`) flag to scan massive-scope Cartesian permutations using 60+ common subdomains (e.g., `auth`, `api`, `beta`, `jenkins`).

## [1.1.0] - 2026-07-15

### Added ✨
- Multi-threading concurrency with the `-w` (`--workers`) argument via `ThreadPoolExecutor` for parallel bulk scans.
- Intelligent API rate-limiting handling by parsing urlscan.io `X-Rate-Limit-Reset-After` headers on HTTP 429 errors.
- Added `get_user_info` API endpoint call to automatically verify and output the user's authenticated `username` before dispatching scans.
- Added fully mocked network responses to the `unittest` suite (simulating HTTP 200s and HTTP 429s) without burning real API quotas.
- React-based frontend documentation and landing page.

### Changed 🔄
- Refactored CLI parameter names to support shorthand aliases (e.g., `-c`, `-p`, `-s`, `-x`, `-V`, `-r`, `-e`, `-j`, `-v`).
- Hardened script to securely fall back to standard `print` if `tqdm` (progress bar) is not installed during import.

## [1.0.0] - 2026-05-10

### Added ✨
- Initial Python CLI tool (`urlscan_submit.py`) for automating urlscan.io domain submissions.
- Support for single domain (`-d`) and bulk file (`-f`) submissions.
- Configuration file support (JSON and YAML).
- Parameter variations for protocols (HTTP/HTTPS) and subdomains (root/www).
- Exploratory parameter (`-x`) to automatically enumerate over 20 common subdomains (e.g., `mail`, `ftp`, `admin`).
- Exponential backoff mechanism to handle rate limits (429) and transient server/network errors (5xx, URLError).
- Result export formats: CSV (`-e`) and JSON (`-j`).
- Unit testing suite using Python's `unittest` framework.
