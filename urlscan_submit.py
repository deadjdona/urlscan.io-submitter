"""
urlscan-submitter: Automated reconnaissance & rate-limit resilient URL scanner

This module submits URLs to urlscan.io for security scanning with built-in support for:
- Rate limit handling via exponential backoff
- Bulk submission from CSV files, plain text, or YAML config
- Subdomain enumeration with three intensity levels (-x, -xx, -xxx)
- Flexible output formats (JSON, CSV, TXT)
"""

import argparse
import csv
import ipaddress
import json
import os
import re
import socket
import sys
import time
import urllib.request
import urllib.error
from typing import List, Dict, Optional, Any

# Ensure UTF-8 output encoding across Windows / Unix terminals
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    import yaml
except ImportError:
    yaml = None

try:
    from tqdm import tqdm
except ImportError:
    tqdm = None

# ANSI color codes for terminal output formatting (gracefully degrades if not supported)
class Colors:
    HEADER: str = '\033[95m'
    OKBLUE: str = '\033[94m'
    OKCYAN: str = '\033[96m'
    OKGREEN: str = '\033[92m'
    WARNING: str = '\033[93m'
    FAIL: str = '\033[91m'
    ENDC: str = '\033[0m'
    BOLD: str = '\033[1m'
    UNDERLINE: str = '\033[4m'

# ASCII Art Brand Logo (Old-School BBS/NFO Style)
ASCII_LOGO: str = r"""
 ____________________________________________________________________
/\                                                                   \
\_|  _   _ ____  _     ____   ____    _    _   _                     |_
  | | | | |  _ \| |   / ___| / ___|  / \  | \ | |   .--------------.  |
  | | | | | |_) | |   \___ \| |     / _ \ |  \| |   |  URLSCAN.IO  |  |
  | | |_| |  _ <| |___ ___) | |___ / ___ \| |\  |   |  SUBMITTER   |  |
  |  \___/|_| \_\_____|____/ \____/_/   \_\_| \_|   |  v1.2.0-2026 |  |
  |  ____  _   _ ____  __  __ ___ _____ _____ _____ '--------------'  |
  | / ___|| | | | __ )|  \/  |_ _|_   _|_   _| ____|  _ \             |
  | \___ \| | | |  _ \| |\/| || |  | |   | | |  _| | |_) |            |
  |  ___) | |_| | |_) | |  | || |  | |   | | | |___|  _ <             |
  | |____/ \___/|____/|_|  |_|___| |_|   |_| |_____|_| \_\            |
  |                                                                   |
  |  --==[ Automated Reconnaissance & Threat Intel Submissions ]==--  |
  |  --==[ Multi-Threaded Engine :: Smart Rate-Limit Handling  ]==--  |
 _|                                                                   |_
/\____________________________________________________________________/\
\______________________________________________________________________/
"""

def print_banner() -> None:
    """Prints the application ASCII logo banner."""
    print(f"{Colors.OKCYAN}{ASCII_LOGO}{Colors.ENDC}")

# --- PROGRESS BAR SUPPORT ---
# Implements a fallback ASCII progress bar when tqdm is unavailable
# Ensures consistent progress reporting across environments
class SimpleProgressBar:
    """Lightweight fallback ASCII progress bar used when tqdm is not installed."""
    def __init__(self, total: int, desc: str = "Scan Submissions", width: int = 30):
        self.total = total
        self.desc = desc
        self.width = width
        self.n = 0
        self.postfix: Dict[str, Any] = {}
        self.start_time = time.time()

    def update(self, n: int = 1) -> None:
        self.n += n
        self.render()

    def set_postfix(self, postfix_dict: Dict[str, Any], refresh: bool = True) -> None:
        self.postfix = postfix_dict
        if refresh:
            self.render()

    def render(self) -> None:
        pct = (self.n / self.total) if self.total > 0 else 1.0
        filled = int(self.width * pct)
        bar = "=" * filled + (">" if filled < self.width else "")
        bar = bar.ljust(self.width, " ")
        postfix_parts = [f"{k}: {v}" for k, v in self.postfix.items()]
        postfix_str = f" [{', '.join(postfix_parts)}]" if postfix_parts else ""
        elapsed = time.time() - self.start_time
        rate = (self.n / elapsed) if elapsed > 0 else 0.0
        line = f"\r{self.desc}: [{bar}] {pct*100:5.1f}% ({self.n}/{self.total}) [{elapsed:.1f}s, {rate:.2f} url/s]{postfix_str}"
        import builtins
        builtins.print(line, end="", flush=True)

    def close(self) -> None:
        import builtins
        builtins.print()

def create_progress_bar(total: int, desc: str = "Scan Submissions"):
    """Creates a tqdm progress bar if available, or falls back to SimpleProgressBar."""
    if tqdm:
        return tqdm(
            total=total,
            desc=desc,
            unit="url",
            dynamic_ncols=True,
            bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}{postfix}]"
        )
    return SimpleProgressBar(total=total, desc=desc)

# Override standard print to be compatible with tqdm and fallback progress bars
# This ensures that debug output and reports don't break the progress bar visual
def _safe_print(*args: Any, **kwargs: Any) -> None:
    if tqdm:
        tqdm.write(kwargs.get("sep", " ").join(map(str, args)), end=kwargs.get("end", "\n"))
    else:
        import builtins
        builtins.print(*args, **kwargs)

print = _safe_print

# --- RECONNAISSANCE DICTIONARIES ---
# These lists are used when the user provides an exploratory flag (-x, -xx, -xxx).
# They act as the "y-axis" in our Cartesian matrix generation.

# Basic 20 subdomains. Used by `-x` / `--explore`
COMMON_SUBDOMAINS: List[str] = [
    "mail", "ftp", "webmail", "smtp", "pop", "imap",
    "cpanel", "admin", "dev", "test", "stage", "blog",
    "portal", "vpn", "remote", "autodiscover", "api",
    "shop", "store", "support", "m"
]

# Deeper 60+ subdomains (Includes COMMON). Used by `-xx` / `--deep-explore`
DEEP_SUBDOMAINS: List[str] = COMMON_SUBDOMAINS + [
    "auth", "login", "secure", "app", "dashboard", "billing", 
    "payment", "status", "help", "docs", "kb", "wiki", "forum", 
    "news", "cdn", "static", "assets", "images", "media", "video", 
    "beta", "alpha", "prod", "qa", "uat", "demo", "sandbox",
    "partner", "client", "customer", "member", "internal", "intranet",
    "git", "svn", "jira", "confluence", "jenkins", "gitlab", "stats"
]

# Massive 140+ subdomains (Includes DEEP). Used by `-xxx` / `--massive-explore`
MASSIVE_SUBDOMAINS: List[str] = DEEP_SUBDOMAINS + [
    "en", "us", "uk", "fr", "de", "ru", "es", "it", "jp", "cn", "br", "au",
    "metrics", "grafana", "prometheus", "kibana", "elastic", "splunk", "syslog",
    "sso", "idp", "oauth", "openid", "jwt", "saml",
    "db", "sql", "mysql", "postgres", "mongo", "redis", "memcached", "oracle",
    "erp", "crm", "hr", "payroll", "finance", "accounting", "sales", "marketing",
    "corp", "office", "web", "www2", "www3", "cloud", "aws", "gcp", "azure",
    "download", "upload", "files", "share", "drive", "sftp", "ssh",
    "gateway", "proxy", "firewall", "router", "switch", "lb", "balancer",
    "old", "new", "v1", "v2", "v3", "api-v1", "api-v2", "api-v3",
    "mail2", "mx", "mx1", "mx2", "smtp1", "smtp2", "ns1", "ns2", "ns3", "ns4",
    "cdn1", "cdn2", "cdn3", "img", "img1", "img2", "img3", "static1", "static2"
]

def is_valid_domain(domain: str) -> bool:
    """
    Validates a domain name string (e.g., example.com) or IPv4/IPv6 address.
    
    Args:
        domain (str): The domain or IP string to validate.
        
    Returns:
        bool: True if the string is a syntactically valid domain or IP address, False otherwise.
    """
    # Clean protocol and trailing slash if present
    cleaned = domain.strip().replace("http://", "").replace("https://", "").rstrip("/")
    if not cleaned:
        return False

    parts = cleaned.split('.')
    # If formatted as 4 numeric octets, validate strictly as IPv4
    if len(parts) == 4 and all(p.isdigit() for p in parts):
        try:
            ipaddress.ip_address(cleaned)
            return True
        except ValueError:
            return False
        
    # Check if valid IPv6 address
    try:
        ipaddress.ip_address(cleaned)
        return True
    except ValueError:
        pass

    pattern = re.compile(
        r'^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)+'
        r'([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$'
    )
    return bool(pattern.match(cleaned))

def resolve_domain_ips(hostname: str) -> List[str]:
    """
    Resolves a domain or subdomain hostname to its IPv4 addresses using DNS lookup.
    
    Args:
        hostname (str): The domain or subdomain to resolve.
        
    Returns:
        list: List of unique IPv4 address strings resolved via DNS.
    """
    # Clean hostname of protocols and trailing slashes
    clean_host = hostname.strip().replace("http://", "").replace("https://", "").rstrip("/")
    try:
        _, _, ip_list = socket.gethostbyname_ex(clean_host)
        return [ip for ip in ip_list if ip]
    except (socket.gaierror, socket.herror, OSError):
        return []

def submit_to_urlscan(
    url: str, 
    api_key: str, 
    visibility: str = "public", 
    max_retries: int = 3, 
    verbose: bool = False, 
    tags: Optional[List[str]] = None, 
    customagent: Optional[str] = None, 
    referer: Optional[str] = None, 
    country: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Submits a URL to urlscan.io using their /api/v1/scan endpoint.
    Includes exponential backoff for rate limits and robust error handling.
    
    Args:
        url (str): The full URL to submit (e.g., 'https://admin.example.com').
        api_key (str): The urlscan.io API key for authorization.
        visibility (str, optional): Scan visibility ('public', 'unlisted', 'private'). Defaults to 'public'.
        max_retries (int, optional): Number of retry attempts on transient network errors. Defaults to 3.
        verbose (bool, optional): If True, prints verbose HTTP debug logs. Defaults to False.
        tags (list, optional): List of user-defined tags.
        customagent (str, optional): Custom User-Agent string to use.
        referer (str, optional): Custom Referer string to use.
        country (str, optional): 2-letter ISO country code to scan from.
        
    Returns:
        dict: The parsed JSON response from the urlscan.io API if successful (contains 'uuid').
        None: If the submission ultimately failed after all retries or hit a terminal error (e.g., 401).
    """
    endpoint = "https://urlscan.io/api/v1/scan"
    headers = {
        "API-Key": api_key,
        "Content-Type": "application/json"
    }
    data = {
        "url": url,
        "visibility": visibility,
        "tags": tags if tags else ["automated-script"]
    }
    if customagent:
        data["customagent"] = customagent
    if referer:
        data["referer"] = referer
    if country:
        data["country"] = country

    if verbose:
        print(f"\n{Colors.OKBLUE}[DEBUG] --- HTTP REQUEST ---{Colors.ENDC}")
        print(f"{Colors.OKBLUE}[DEBUG] POST {endpoint}{Colors.ENDC}")
        print(f"{Colors.OKBLUE}[DEBUG] Headers: {json.dumps({'API-Key': '***', 'Content-Type': 'application/json'})}{Colors.ENDC}")
        print(f"{Colors.OKBLUE}[DEBUG] Payload: {json.dumps(data)}{Colors.ENDC}")
        print(f"{Colors.OKBLUE}[DEBUG] ----------------------{Colors.ENDC}")

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(data).encode("utf-8"),
        headers=headers,
        method="POST"
    )

    for attempt in range(max_retries):
        try:
            # Set a generous 15-second timeout for the network request
            with urllib.request.urlopen(req, timeout=15) as response:
                raw_response = response.read().decode("utf-8")
                if verbose:
                    print(f"\n{Colors.OKBLUE}[DEBUG] --- HTTP RESPONSE ---{Colors.ENDC}")
                    print(f"{Colors.OKBLUE}[DEBUG] Status: {response.status}{Colors.ENDC}")
                    print(f"{Colors.OKBLUE}[DEBUG] Body: {raw_response}{Colors.ENDC}")
                    print(f"{Colors.OKBLUE}[DEBUG] -----------------------{Colors.ENDC}")
                return json.loads(raw_response)
                
        except urllib.error.HTTPError as e:
            try:
                error_body = e.read().decode("utf-8")
                if verbose:
                    print(f"\n{Colors.WARNING}[DEBUG] --- HTTP ERROR RESPONSE ---{Colors.ENDC}")
                    print(f"{Colors.WARNING}[DEBUG] Status: {e.code}{Colors.ENDC}")
                    print(f"{Colors.WARNING}[DEBUG] Body: {error_body}{Colors.ENDC}")
                    print(f"{Colors.WARNING}[DEBUG] -----------------------------{Colors.ENDC}")
                error_json = json.loads(error_body)
                error_msg = error_json.get("message", error_body)
            except Exception:
                error_msg = e.reason

            if e.code == 429: # Rate Limited
                # URLScan provides exactly when the bucket resets via this header.
                # We prioritize parsing this mathematically to avoid arbitrary sleeps.
                reset_after = e.headers.get("X-Rate-Limit-Reset-After")
                if reset_after and reset_after.isdigit():
                    wait_time = int(reset_after) + 1 # +1s buffer
                else:
                    # Fallback to standard exponential backoff if header is missing
                    wait_time = (2 ** attempt) * 3  # Backoff: 3s, 6s, 12s
                
                print(f"{Colors.WARNING}[-] Rate limit hit (429 Too Many Requests) for {url}.{Colors.ENDC}")
                print(f"{Colors.WARNING}    Retrying in {wait_time} seconds (Attempt {attempt + 1}/{max_retries})...{Colors.ENDC}")
                time.sleep(wait_time)
                continue
            elif e.code in (500, 502, 503, 504): # Transient server errors
                wait_time = (2 ** attempt) * 3
                print(f"{Colors.WARNING}[-] Transient server error ({e.code}) for {url}.{Colors.ENDC}")
                print(f"{Colors.WARNING}    Retrying in {wait_time} seconds (Attempt {attempt + 1}/{max_retries})...{Colors.ENDC}")
                time.sleep(wait_time)
                continue
            elif e.code == 400:
                print(f"{Colors.FAIL}[-] Bad Request (400) for {url}. Check domain format: {error_msg}{Colors.ENDC}")
                return None
            elif e.code in (401, 403):
                print(f"{Colors.FAIL}[-] Auth Error ({e.code}). Please verify your URLSCAN_API_KEY. Message: {error_msg}{Colors.ENDC}")
                return None
            else:
                print(f"{Colors.FAIL}[-] HTTP Error {e.code} for {url}: {error_msg}{Colors.ENDC}")
                return None
                
        except urllib.error.URLError as e:
            wait_time = (2 ** attempt) * 3
            print(f"{Colors.FAIL}[-] Network error connecting to urlscan.io for {url}: {e.reason}{Colors.ENDC}")
            print(f"{Colors.FAIL}    Retrying in {wait_time} seconds (Attempt {attempt + 1}/{max_retries})...{Colors.ENDC}")
            time.sleep(wait_time)
            continue
        except json.JSONDecodeError:
            print(f"{Colors.FAIL}[-] API Error: Failed to parse JSON response from urlscan.io for {url}{Colors.ENDC}")
            return None
        except Exception as e:
            print(f"{Colors.FAIL}[-] Unexpected error for {url}: {str(e)}{Colors.ENDC}")
            return None
            
    print(f"{Colors.FAIL}[-] Max retries exceeded for {url}.{Colors.ENDC}")
    return None

def get_scan_report(uuid: str, api_key: str, max_wait: int = 60) -> Optional[Dict[str, Any]]:
    """
    Polls the urlscan.io result API until the scan finishes or timeouts.
    
    Args:
        uuid (str): The UUID of the scan job returned by urlscan.io during submission.
        api_key (str): The urlscan.io API key for authorization.
        max_wait (int, optional): The maximum time to wait in seconds before giving up. Defaults to 60.
        
    Returns:
        dict: The full scan result dictionary from the API.
        None: If the polling timed out, or a fatal error occurred during fetching.
    """
    endpoint = f"https://urlscan.io/api/v1/result/{uuid}/"
    headers = {"API-Key": api_key}
    
    print(f"{Colors.OKCYAN}[*] Waiting for scan {uuid} to complete (up to {max_wait}s)...{Colors.ENDC}")
    
    # URLScan.io officially recommends waiting at least 10 seconds before polling 
    # the result endpoint, as their backend needs time to process the headless browser data.
    time.sleep(10)  
    
    start_time = time.time()
    poll_attempt = 0
    while time.time() - start_time < max_wait:
        req = urllib.request.Request(endpoint, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                if response.status == 200:
                    return json.loads(response.read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # 404 is the expected response from urlscan while the scan is still 
                # running in their queue. We silently ignore it and continue polling.
                pass
            elif e.code == 429:
                reset_after = e.headers.get("X-Rate-Limit-Reset-After")
                if reset_after and reset_after.isdigit():
                    wait_time = int(reset_after) + 1
                else:
                    wait_time = (2 ** poll_attempt) * 2
                
                print(f"{Colors.WARNING}[-] Polling rate limit hit. Backing off for {wait_time}s...{Colors.ENDC}")
                time.sleep(wait_time)
                poll_attempt += 1
                continue
            elif e.code in (500, 502, 503, 504):
                wait_time = (2 ** poll_attempt) * 2
                print(f"{Colors.WARNING}[-] Server error {e.code} during polling. Backing off for {wait_time}s...{Colors.ENDC}")
                time.sleep(wait_time)
                poll_attempt += 1
                continue
            else:
                print(f"{Colors.FAIL}[-] Error fetching result: HTTP {e.code}{Colors.ENDC}")
                return None
        except urllib.error.URLError as e:
            wait_time = (2 ** poll_attempt) * 2
            print(f"{Colors.WARNING}[-] Network error during polling: {e.reason}. Backing off for {wait_time}s...{Colors.ENDC}")
            time.sleep(wait_time)
            poll_attempt += 1
            continue
        except Exception as e:
            print(f"{Colors.FAIL}[-] Error fetching result: {str(e)}{Colors.ENDC}")
            return None
        
        time.sleep(2)
        
    print(f"{Colors.WARNING}[-] Timed out waiting for scan to complete.{Colors.ENDC}")
    return None

def print_summary(report: Optional[Dict[str, Any]]) -> None:
    """
    Prints a formatted summary of the scan results to the console.
    
    Args:
        report (dict): The full JSON dictionary returned by get_scan_report().
    """
    if not report:
        return
        
    page = report.get("page", {})
    verdicts = report.get("verdicts", {}).get("overall", {})
    
    print("\n" + "="*45)
    print(" SCAN SUMMARY REPORT")
    print("="*45)
    print(f" Target URL : {report.get('task', {}).get('url', 'N/A')}")
    print(f" Domain     : {page.get('domain', 'N/A')}")
    print(f" IP Address : {page.get('ip', 'N/A')} ({page.get('country', 'N/A')})")
    print(f" Server     : {page.get('server', 'N/A')}")
    print(f" Malicious  : {verdicts.get('malicious', False)} (Score: {verdicts.get('score', 0)})")
    
    categories = verdicts.get('categories', [])
    if categories:
        print(f" Categories : {', '.join(categories)}")
        
    print("="*45 + "\n")

def export_to_csv(reports: List[Dict[str, Any]], filename: str) -> None:
    """
    Exports a list of scan reports to a CSV file.
    
    Args:
        reports (list): A list of scan report dictionaries containing 'task', 'page', and 'verdicts'.
        filename (str): The target file path for the CSV output.
    """
    print(f"\n[*] Exporting {len(reports)} scan reports to {filename} ...")
    try:
        with open(filename, mode='w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            # Write header
            writer.writerow([
                "Target URL", "Resolved Domain", "IP Address", 
                "Country", "Server", "Malicious", "Score", "Categories", "Result Link"
            ])
            for r in reports:
                page = r.get("page", {})
                task = r.get("task", {})
                verdicts = r.get("verdicts", {}).get("overall", {})
                
                categories = verdicts.get('categories', [])
                cat_str = ", ".join(categories) if categories else ""
                
                result_link = f"https://urlscan.io/result/{task.get('uuid', '')}/" if task.get('uuid') else ""
                
                writer.writerow([
                    task.get("url", ""),
                    page.get("domain", ""),
                    page.get("ip", ""),
                    page.get("country", ""),
                    page.get("server", ""),
                    verdicts.get("malicious", ""),
                    verdicts.get("score", ""),
                    cat_str,
                    result_link
                ])
        print(f"[+] Successfully saved CSV to {filename}")
    except Exception as e:
        print(f"[-] Error writing CSV to {filename}: {str(e)}")

def export_to_json(reports: List[Dict[str, Any]], filename: str) -> None:
    """
    Exports a list of scan reports to a JSON file.
    
    Args:
        reports (list): A list of full scan report dictionaries.
        filename (str): The target file path for the JSON output.
    """
    print(f"\n{Colors.OKCYAN}[*] Exporting {len(reports)} scan reports to {filename} ...{Colors.ENDC}")
    try:
        with open(filename, mode='w', encoding='utf-8') as f:
            json.dump(reports, f, indent=4)
        print(f"{Colors.OKGREEN}[+] Successfully saved JSON to {filename}{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}[-] Error writing JSON to {filename}: {str(e)}{Colors.ENDC}")

def load_config(config_arg: Optional[str] = None) -> Dict[str, Any]:
    """
    Loads configuration from a JSON or YAML file.
    
    Searches paths in this order:
    1. Explicitly provided `config_arg`
    2. `.urlscan-config.json` (or .yaml/.yml) in the Current Working Directory
    3. `.urlscan-config.json` (or .yaml/.yml) in the user's Home directory
    
    Args:
        config_arg (str, optional): An explicit path to a configuration file.
        
    Returns:
        dict: The loaded configuration dictionary, or an empty dict if not found.
    """
    config = {}
    config_paths = []
    if config_arg:
        config_paths.append(config_arg)
    else:
        config_paths = [
            ".urlscan-config.json",
            ".urlscan-config.yaml",
            ".urlscan-config.yml",
            os.path.expanduser("~/.urlscan-config.json"),
            os.path.expanduser("~/.urlscan-config.yaml")
        ]

    for path in config_paths:
        if os.path.exists(path):
            try:
                with open(path, "r") as f:
                    if path.endswith(".yaml") or path.endswith(".yml"):
                        if yaml:
                            config = yaml.safe_load(f) or {}
                            print(f"[*] Loaded config from {path}")
                            break
                        else:
                            print(f"[-] PyYAML not installed. Cannot parse {path}. Skipping.")
                    else:
                        config = json.load(f)
                        print(f"[*] Loaded config from {path}")
                        break
            except Exception as e:
                print(f"{Colors.FAIL}[-] Error reading config {path}: {e}{Colors.ENDC}")
    return config

def get_user_info(api_key: str) -> Optional[Dict[str, Any]]:
    """
    Fetches the authenticated user's information using the API key.
    
    Args:
        api_key (str): The urlscan.io API key to authenticate.
        
    Returns:
        dict: The user info response dictionary if authenticated.
        None: If the token is invalid (401) or a network error occurs.
    """
    url = "https://urlscan.io/user/username"
    headers = {
        'API-Key': api_key,
        'Accept': 'application/json'
    }
    
    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                username = data.get("username", "Unknown")
                print(f"{Colors.OKCYAN}[*] Authenticated as urlscan.io user: {Colors.BOLD}{username}{Colors.ENDC}")
                return data
    except urllib.error.HTTPError as e:
        if e.code == 401:
            print(f"{Colors.WARNING}[-] Warning: The provided API key is invalid or unauthorized (401).{Colors.ENDC}")
        else:
            print(f"{Colors.FAIL}[-] Could not fetch user info: HTTP {e.code} - {e.reason}{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}[-] Error fetching user info: {str(e)}{Colors.ENDC}")
    return None

def main() -> None:
    """
    Main entry point for the CLI tool. Parses arguments, generates the Cartesian 
    product of all requested domains, and dispatches them to urlscan.io.
    """
    parser = argparse.ArgumentParser(
        prog="urlscan-submit",
        description=(
            f"{ASCII_LOGO}\n"
            "===============================================================\n"
            " urlscan-submit: High-Performance Domain Submission & Recon CLI\n"
            "===============================================================\n"
            "Automates URL submission to urlscan.io for security analysis, phishing triage,\n"
            "and reconnaissance with rate-limit evasion, multi-threading, and Cartesian matrix\n"
            "generation."
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
examples:
  # 🎯 Quick single domain scan (defaults to https and root subdomain):
  urlscan-submit -🎯 example.com
  (or: urlscan-submit -d example.com)

  # 🌐 Submit direct IP address with both HTTP and HTTPS variants:
  urlscan-submit -🎯 123.21.33.22 -🌐 both
  (or: urlscan-submit -d 123.21.33.22 -p both)

  # 🔎 Recon matrix including exploratory subdomains AND their resolved IP addresses:
  urlscan-submit -🎯 target.com -🌐 both -🏢 both -🔍 -🔎
  (or: urlscan-submit -d target.com -p both -s both -x -I)

  # 🚀 High-speed bulk submission from file using 10 concurrent threads:
  urlscan-submit -📁 domains.txt -🚀 10 -🔎
  (or: urlscan-submit -f domains.txt -w 10 -I)

  # 👻 Private submission with delay floor, custom tags, and CSV summary export:
  urlscan-submit -📁 targets.txt -👻 private -🐢 1.5 -🏷 "incident-404,redteam" -📊 summary.csv -📝
  (or: urlscan-submit -f targets.txt -V private --delay 1.5 --tags "incident-404,redteam" -e summary.csv -r)

configuration & api key priority:
  1. 🔑 CLI parameter: --api-key-file <path>
  2. ⚙️ Config file: -c / --config <path> (or .urlscan-config.json / .urlscan-config.yaml)
  3. 🌐 Environment variable: URLSCAN_API_KEY
  4. 📄 Local file: ./api_key.txt
"""
    )
    
    # Target specification (mutually exclusive)
    target_mut = parser.add_mutually_exclusive_group(required=True)
    
    parser.add_argument("-c", "--config", "-⚙", metavar="FILE",
                        help="⚙️ Path to custom JSON/YAML configuration file")
    parser.add_argument("--country", "-🌍", metavar="CC",
                        help="🌍 2-letter ISO country code to scan from (e.g. us, de, jp)")
    target_mut.add_argument("-d", "--domain", "-🎯", metavar="DOMAIN",
                            help="🎯 Single target domain, hostname, or IP address (e.g. example.com or 123.21.33.22)")
    parser.add_argument("--delay", "-🐢", type=float, default=0.0, metavar="SECONDS",
                        help="🐢 Intentional delay floor in seconds between worker dispatches (default: 0.0)")
    parser.add_argument("-e", "--export-csv", "-📊", metavar="FILE",
                        help="📊 Export formatted scan summary to CSV file (forces report polling)")
    target_mut.add_argument("-f", "--file", "-📁", metavar="FILE",
                            help="📁 Path to line-delimited text file containing target domains or IP addresses")
    parser.add_argument("-I", "--resolve-ips", "--submit-ips", "-🔎", action="store_true",
                        help="🔎 Resolve DNS A-records for subdomains and also submit their IP addresses (http://<ip>/ and https://<ip>/)")
    parser.add_argument("-j", "--json-log", "-📜", metavar="FILE",
                        help="📜 Export full raw JSON API responses to file (forces report polling)")
    parser.add_argument("-k", "--api-key-file", "-🔑", metavar="FILE",
                        help="🔑 Path to file containing urlscan.io API key")
    parser.add_argument("-p", "--protocols", "-🌐", choices=["http", "https", "both"], default=None,
                        help="🌐 Protocols to generate in matrix (default: https)")
    parser.add_argument("-r", "--report", "-📝", action="store_true",
                        help="📝 Wait for scan completion and display summary report")
    parser.add_argument("--referer", "-🔗", metavar="URL",
                        help="🔗 Override HTTP Referer header sent during scan")
    parser.add_argument("-s", "--subdomains", "-🏢", choices=["root", "www", "both"], default=None,
                        help="🏢 Base subdomains to include (default: root)")
    parser.add_argument("-t", "--tags", "-🏷", metavar="TAGS",
                        help="🏷️ Comma-separated custom tags (e.g. 'phishing,redteam', max 10)")
    parser.add_argument("-ua", "--user-agent", "-🤖", metavar="UA",
                        help="🤖 Override default User-Agent browser string")
    parser.add_argument("-v", "--verbose", "-🔊", action="store_true",
                        help="🔊 Enable verbose HTTP request/response debugging output")
    parser.add_argument("-V", "--visibility", "-👻", choices=["public", "unlisted", "private"], default=None,
                        help="👻 Scan visibility on urlscan.io (default: public)")
    parser.add_argument("-w", "--workers", "-🚀", type=int, default=1, metavar="N",
                        help="🚀 Number of concurrent worker threads (default: 1)")
    parser.add_argument("-wl", "--wordlist", "-📖", metavar="FILE",
                        help="📖 Path to custom subdomains wordlist for custom matrix generation")
    parser.add_argument("-x", "--explore", "-🔍", action="store_true",
                        help="🔍 Enumerate +20 common subdomains (ftp, mail, admin, api, etc.)")
    parser.add_argument("-xx", "--deep-explore", "-🤿", action="store_true",
                        help="🤿 Enumerate +60 deep reconnaissance subdomains (auth, sso, git, etc.)")
    parser.add_argument("-xxx", "--massive-explore", "-🌌", action="store_true",
                        help="🌌 Enumerate +140 massive reconnaissance subdomains (cloud, db, k8s, etc.)")

    args = parser.parse_args()
    print_banner()

    # Load Configuration
    config = load_config(args.config)

    # Resolve settings (CLI > Config > Defaults)
    args.protocols = args.protocols or config.get("protocols") or "https"
    args.subdomains = args.subdomains or config.get("subdomains") or "root"
    args.visibility = args.visibility or config.get("visibility") or "public"
    args.explore = args.explore or config.get("explore", False)
    args.resolve_ips = args.resolve_ips or config.get("resolve_ips", False) or config.get("submit_ips", False)
    args.api_key_file = args.api_key_file or config.get("api_key_file")

    api_key = None
    if args.api_key_file:
        try:
            with open(args.api_key_file, "r") as key_file:
                api_key = key_file.read().strip()
        except Exception as e:
            print(f"Error reading API key from file '{args.api_key_file}': {e}")
            return

    if not api_key:
        api_key = config.get("api_key")

    if not api_key:
        api_key = os.environ.get("URLSCAN_API_KEY")

    # Fallback to looking for api_key.txt in the current directory by default
    if not api_key:
        try:
            if os.path.exists("api_key.txt"):
                with open("api_key.txt", "r") as key_file:
                    api_key = key_file.read().strip()
                print("[*] Found API key in local 'api_key.txt' file.")
        except Exception as e:
            print(f"Warning: Failed to read local 'api_key.txt': {e}")

    if not api_key:
        print("Error: API key is not set.")
        print("Please provide the API key using one of these methods:")
        print("  1. Create a file named 'api_key.txt' in your current directory")
        print("  2. Export it via terminal: export URLSCAN_API_KEY='your_api_key_here'")
        print("  3. Pass a specific file path: --api-key-file <path_to_file>")
        return

    print("[*] API Key loaded successfully.")
    get_user_info(api_key)

    domains = []
    if args.domain:
        clean_d = args.domain.strip().replace("http://", "").replace("https://", "").rstrip("/")
        if is_valid_domain(clean_d):
            domains.append(clean_d)
        else:
            print(f"Error: '{args.domain}' is not a valid domain format.")
            return
    elif args.file:
        try:
            with open(args.file, "r") as f:
                for line in f:
                    d = line.strip().replace("http://", "").replace("https://", "").rstrip("/")
                    if d and not d.startswith("#"):
                        if is_valid_domain(d):
                            domains.append(d)
                        else:
                            print(f"[-] Warning: Skipping invalid domain format: '{d}'")
            if not domains:
                print(f"Error: No valid domains found in '{args.file}'.")
                return
            print(f"[*] Loaded {len(domains)} valid domain(s) from {args.file}")
        except FileNotFoundError:
            print(f"Error: The file '{args.file}' was not found. Please verify the path.")
            return
        except PermissionError:
            print(f"Error: Permission denied. Unable to read the file '{args.file}'.")
            return
        except Exception as e:
            print(f"Error reading file {args.file}: {e}")
            return

    # Generate domain variations based on user arguments
    # Create the Cartesian product of [Protocols] x [Prefixes/Subdomains] x [Base Domains]
    protocols = ["https://"] if args.protocols == "https" else (["http://"] if args.protocols == "http" else ["http://", "https://"])
    
    prefixes = []
    # 1. Base Subdomains (root and/or www)
    if args.subdomains in ("root", "both"):
        prefixes.append("")
    if args.subdomains in ("www", "both"):
        prefixes.append("www.")
        
    # 2. Exploratory Subdomains (Common, Deep, Massive, or Custom Wordlist)
    if args.explore or args.deep_explore or args.massive_explore or args.wordlist:
        explore_list = []
        if args.wordlist:
            try:
                with open(args.wordlist, "r") as wf:
                    for line in wf:
                        w = line.strip()
                        if w and not w.startswith("#"):
                            explore_list.append(w)
                print(f"[*] Loaded {len(explore_list)} custom subdomains from {args.wordlist}")
            except Exception as e:
                print(f"Error reading wordlist {args.wordlist}: {e}")
                return
        elif args.massive_explore:
            explore_list = MASSIVE_SUBDOMAINS
        elif args.deep_explore:
            explore_list = DEEP_SUBDOMAINS
        else:
            explore_list = COMMON_SUBDOMAINS
        for sub in explore_list:
            prefixes.append(f"{sub}.")
            
    # Ensure no duplicates by casting to a dict (preserves order in Python 3.7+)
    prefixes = list(dict.fromkeys(prefixes))

    urls_to_scan = []
    resolved_ips = set()

    # 3. Assemble the final Cartesian matrix (including direct IPs and resolved subdomain IPs)
    for domain in domains:
        # Check if target is directly an IP address
        is_ip = False
        try:
            ipaddress.ip_address(domain)
            is_ip = True
        except ValueError:
            is_ip = False

        if is_ip:
            # Direct IP submission format: http://123.21.33.22/ and/or https://123.21.33.22/
            for proto in protocols:
                urls_to_scan.append(f"{proto}{domain}/")
        else:
            for prefix in prefixes:
                fqdn = f"{prefix}{domain}"
                for proto in protocols:
                    urls_to_scan.append(f"{proto}{fqdn}")
                
                if args.resolve_ips:
                    ips = resolve_domain_ips(fqdn)
                    for ip in ips:
                        resolved_ips.add(ip)

    # Append resolved IPs as http://<ip>/ and https://<ip>/ URLs
    if args.resolve_ips and resolved_ips:
        print(f"[*] Resolved {len(resolved_ips)} unique IP address(es) from target subdomains.")
        for ip in sorted(resolved_ips):
            for proto in protocols:
                urls_to_scan.append(f"{proto}{ip}/")

    # Deduplicate while preserving order
    urls_to_scan = list(dict.fromkeys(urls_to_scan))

    print(f"\n{Colors.OKCYAN}[*] Generated {len(urls_to_scan)} URL(s) total to scan.{Colors.ENDC}")

    # Prepare tags dynamically
    tags_list = []
    
    # 1. User-defined tags take priority
    if args.tags:
        tags_list.extend([t.strip() for t in args.tags.split(",") if t.strip()])
        
    # 2. Auto-generated context tags
    tags_list.append("automated-script")
    
    # Tag based on file input name
    if args.file:
        base_name = os.path.splitext(os.path.basename(args.file))[0]
        # Sanitize filename to alphanumeric and dashes for valid tag format
        clean_name = "".join(c for c in base_name if c.isalnum() or c in "-_")
        if clean_name:
            tags_list.append(f"list-{clean_name}")
            
    # Tag based on recon modes
    if args.explore:
        tags_list.append("recon-explore")
    if args.deep_explore:
        tags_list.append("recon-deep")
    if args.massive_explore:
        tags_list.append("recon-massive")
    if args.wordlist:
        tags_list.append("custom-wordlist")
    if args.resolve_ips:
        tags_list.append("resolve-ips")
        
    # Unique tags, capped at maximum 10 permitted by urlscan.io
    tags_list = list(dict.fromkeys(tags_list))[:10]

    all_reports = []
    scan_metrics = {
        "success": 0,
        "failed": 0,
        "reports": 0
    }
    
    def process_url(url: str):
        print(f"{Colors.OKCYAN}[*] Submitting {url} ...{Colors.ENDC}")
        result = submit_to_urlscan(
            url, 
            api_key, 
            args.visibility, 
            verbose=args.verbose,
            tags=tags_list,
            customagent=args.user_agent,
            referer=args.referer,
            country=args.country
        )
        report_data = None
        is_success = False
        
        if result and 'uuid' in result:
            is_success = True
            uuid = result['uuid']
            print(f"{Colors.OKGREEN}[+] Success! Scan UUID: {uuid}{Colors.ENDC}")
            print(f"{Colors.OKGREEN}[+] Result Link: {Colors.UNDERLINE}https://urlscan.io/result/{uuid}/{Colors.ENDC}")
            
            if args.report or args.export_csv or args.json_log:
                report_data = get_scan_report(uuid, api_key)
                if args.report:
                    print_summary(report_data)
        
        # The delay acts as our floor padding to avoid aggressive 429 bursts on our side.
        # It guarantees we always wait at least 2.0s, unless the user provided a longer --delay.
        time.sleep(max(2.0, args.delay))
        return is_success, report_data
        
    import concurrent.futures
    pbar = create_progress_bar(total=len(urls_to_scan), desc="Submitting URLs")
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = [executor.submit(process_url, url) for url in urls_to_scan]
        
        for future in concurrent.futures.as_completed(futures):
            is_success, res = future.result()
            if is_success:
                scan_metrics["success"] += 1
            else:
                scan_metrics["failed"] += 1
                
            if res and (args.export_csv or args.json_log):
                all_reports.append(res)
                scan_metrics["reports"] += 1
                
            postfix = {
                "ok": scan_metrics["success"],
                "err": scan_metrics["failed"]
            }
            if args.report or args.export_csv or args.json_log:
                postfix["reports"] = scan_metrics["reports"]
                
            pbar.set_postfix(postfix, refresh=True)
            pbar.update(1)

    pbar.close()

    total_scanned = len(urls_to_scan)
    print(f"\n{Colors.HEADER}============================================={Colors.ENDC}")
    print(f"{Colors.BOLD} 🏁 SCAN SUBMISSIONS COMPLETED{Colors.ENDC}")
    print(f"{Colors.HEADER}============================================={Colors.ENDC}")
    print(f" Total Targets      : {total_scanned}")
    print(f" Successful (UUID)  : {Colors.OKGREEN}{scan_metrics['success']}{Colors.ENDC} ({scan_metrics['success']/total_scanned*100:.1f}%)" if total_scanned else " Successful (UUID): 0")
    print(f" Failed Submissions : {Colors.FAIL if scan_metrics['failed'] else Colors.OKGREEN}{scan_metrics['failed']}{Colors.ENDC} ({scan_metrics['failed']/total_scanned*100:.1f}%)" if total_scanned else " Failed Submissions: 0")
    if args.report or args.export_csv or args.json_log:
        print(f" Reports Retrieved  : {scan_metrics['reports']}")
    print(f"{Colors.HEADER}============================================={Colors.ENDC}\n")

    if args.export_csv and all_reports:
        export_to_csv(all_reports, args.export_csv)
        
    if args.json_log and all_reports:
        export_to_json(all_reports, args.json_log)

if __name__ == "__main__":
    main()
