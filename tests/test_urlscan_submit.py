import unittest
from unittest.mock import patch, mock_open, MagicMock
import sys
import os
import io
import json
import socket
import urllib.error

# Insert parent directory into sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import urlscan_submit
from urlscan_submit import (
    is_valid_domain, 
    resolve_domain_ips,
    extract_hostname,
    can_resolve_dns,
    extract_tld,
    extract_apex_domain,
    generate_tags_for_url,
    extract_linked_domains,
    ASCII_LOGO,
    print_banner,
    load_config, 
    get_user_info, 
    get_scan_report, 
    submit_to_urlscan, 
    print_summary, 
    export_to_csv, 
    export_to_json, 
    SimpleProgressBar, 
    create_progress_bar, 
    _safe_print,
    main
)

class TestUrlscanSubmit(unittest.TestCase):

    # ==========================================
    # Domain Validation Tests
    # ==========================================

    def test_is_valid_domain_valid(self):
        valid_domains = [
            "example.com",
            "sub.example.com",
            "my-domain.co.uk",
            "1.1.1.1",
            "123.21.33.22",
            "http://123.21.33.22/",
            "https://example.com/",
            "2001:db8::1",
            "example.org"
        ]
        for domain in valid_domains:
            with self.subTest(domain=domain):
                self.assertTrue(is_valid_domain(domain))

    def test_is_valid_domain_invalid(self):
        invalid_domains = [
            "example.com/path",
            "-example.com",
            "example-.com",
            "invalid_domain",
            "example..com",
            "",
            "http://",
            "999.999.999.999"
        ]
        for domain in invalid_domains:
            with self.subTest(domain=domain):
                self.assertFalse(is_valid_domain(domain))

    def test_resolve_domain_ips_success(self):
        with patch('socket.gethostbyname_ex', return_value=('example.com', [], ['123.21.33.22', '123.21.33.23'])):
            ips = resolve_domain_ips("example.com")
            self.assertEqual(ips, ['123.21.33.22', '123.21.33.23'])

    def test_resolve_domain_ips_error(self):
        import socket
        with patch('socket.gethostbyname_ex', side_effect=socket.gaierror("Name or service not known")):
            ips = resolve_domain_ips("invalid-nonexistent-sub.com")
    def test_extract_tld_and_apex(self):
        self.assertEqual(extract_tld("example.com"), "com")
        self.assertEqual(extract_tld("sub.example.org"), "org")
        self.assertEqual(extract_tld("https://portal.service.io/"), "io")
        self.assertIsNone(extract_tld("123.21.33.22"))
        self.assertIsNone(extract_tld("localhost"))

        self.assertEqual(extract_apex_domain("example.com"), "example.com")
        self.assertEqual(extract_apex_domain("api.sub.example.org"), "example.org")
        self.assertIsNone(extract_apex_domain("123.21.33.22"))

    def test_generate_tags_for_url_domain(self):
        tags = generate_tags_for_url(
            url="https://api.example.com",
            user_tags=["custom-tag", "phish-hunt"],
            explore_mode="explore",
            source_file="targets.txt"
        )
        # Verify 5+ tags generated
        self.assertGreaterEqual(len(tags), 5)
        # Check specific tag components
        self.assertIn("custom-tag", tags)
        self.assertIn("phish-hunt", tags)
        self.assertIn("🔒-https", tags)
        self.assertIn("🏷️-com", tags)
        self.assertIn("🎯-example.com", tags)
        self.assertIn("🏢-sub-api", tags)
        self.assertIn("📁-targets", tags)
        self.assertIn("🔍-explore", tags)
        self.assertIn("🤖-urlscan-submit", tags)

    def test_generate_tags_for_url_ip_resolved(self):
        tags = generate_tags_for_url(
            url="http://123.21.33.22/",
            parent_domain="sub.company.org",
            is_resolved_ip=True,
            explore_mode="massive"
        )
        self.assertGreaterEqual(len(tags), 5)
        self.assertIn("🔓-http", tags)
        self.assertIn("📌-ip", tags)
        self.assertIn("🌐-ipv4", tags)
        self.assertIn("🔎-resolved-ip", tags)
        self.assertIn("🏷️-org", tags)
        self.assertIn("🎯-company.org", tags)
        self.assertIn("🌌-massive-recon", tags)
        self.assertIn("🤖-urlscan-submit", tags)

    def test_generate_tags_for_url_direct_ip(self):
        tags = generate_tags_for_url(
            url="https://123.21.33.22/",
            parent_domain=None,
            is_resolved_ip=False,
            explore_mode="deep"
        )
        self.assertGreaterEqual(len(tags), 5)
        self.assertIn("🔒-https", tags)
        self.assertIn("📌-ip", tags)
        self.assertIn("🌐-ipv4", tags)
        self.assertIn("🎯-direct-ip", tags)
        self.assertIn("🤿-deep-recon", tags)
        self.assertIn("🤖-urlscan-submit", tags)

    def test_generate_tags_for_url_apex_and_wordlist(self):
        tags = generate_tags_for_url(
            url="https://example.com",
            explore_mode="wordlist"
        )
        self.assertGreaterEqual(len(tags), 5)
        self.assertIn("🏷️-com", tags)
        self.assertIn("🎯-example.com", tags)
        self.assertIn("🎯-apex-domain", tags)
        self.assertIn("📖-wordlist", tags)

    def test_print_banner(self):
        self.assertIn("urlscan", ASCII_LOGO.lower())
        with patch('sys.stdout', new_callable=io.StringIO) as mock_stdout:
            print_banner()
            output = mock_stdout.getvalue()
            self.assertIn("urlscan.io", output.lower())

    def test_safe_print(self):
        # With tqdm available
        mock_tqdm = MagicMock()
        with patch.object(urlscan_submit, 'tqdm', mock_tqdm):
            _safe_print("test message 1", "test message 2")
            mock_tqdm.write.assert_called_once_with("test message 1 test message 2", end="\n")

        # Without tqdm
        with patch.object(urlscan_submit, 'tqdm', None):
            with patch('builtins.print') as mock_builtin_print:
                _safe_print("fallback message")
                mock_builtin_print.assert_called_once_with("fallback message")

    def test_simple_progress_bar_render_and_update(self):
        pbar = SimpleProgressBar(total=10, desc="Test Progress", width=20)
        self.assertEqual(pbar.total, 10)
        self.assertEqual(pbar.n, 0)
        
        # Test update and set_postfix
        pbar.set_postfix({"ok": 1, "err": 0}, refresh=False)
        pbar.update(2)
        self.assertEqual(pbar.n, 2)
        self.assertEqual(pbar.postfix.get("ok"), 1)
        pbar.close()

    def test_simple_progress_bar_edge_cases(self):
        # Zero total
        pbar_zero = SimpleProgressBar(total=0, desc="Zero Total", width=10)
        pbar_zero.set_postfix({"key": "val"}, refresh=True)
        pbar_zero.render()
        pbar_zero.close()

        # Overflow n > total
        pbar_overflow = SimpleProgressBar(total=5, desc="Overflow", width=10)
        pbar_overflow.update(10)
        pbar_overflow.close()

    def test_create_progress_bar(self):
        # With tqdm
        mock_tqdm_cls = MagicMock()
        with patch.object(urlscan_submit, 'tqdm', mock_tqdm_cls):
            pbar = create_progress_bar(total=5, desc="Test")
            mock_tqdm_cls.assert_called_once()

        # Without tqdm
        with patch.object(urlscan_submit, 'tqdm', None):
            pbar_fallback = create_progress_bar(total=5, desc="Fallback")
            self.assertIsInstance(pbar_fallback, SimpleProgressBar)

    # ==========================================
    # Config Loading Tests
    # ==========================================

    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='{"api_key": "test_json_key", "visibility": "private"}')
    def test_load_config_json(self, mock_file, mock_exists):
        mock_exists.side_effect = lambda path: path.endswith('.json')
        config = load_config(".urlscan-config.json")
        self.assertEqual(config.get("api_key"), "test_json_key")
        self.assertEqual(config.get("visibility"), "private")
        mock_file.assert_called_once_with(".urlscan-config.json", "r")

    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='api_key: test_yaml_key\nvisibility: public')
    def test_load_config_yaml_with_yaml_module(self, mock_file, mock_exists):
        mock_exists.side_effect = lambda path: path.endswith('.yaml')
        config = load_config(".urlscan-config.yaml")
        if urlscan_submit.yaml:
            self.assertEqual(config.get("api_key"), "test_yaml_key")
            self.assertEqual(config.get("visibility"), "public")
        mock_file.assert_called_once_with(".urlscan-config.yaml", "r")

    @patch('os.path.exists', return_value=True)
    @patch('builtins.open', new_callable=mock_open, read_data='api_key: test_yaml_key')
    def test_load_config_yaml_without_yaml_module(self, mock_file, mock_exists):
        with patch.object(urlscan_submit, 'yaml', None):
            config = load_config(".urlscan-config.yaml")
            self.assertEqual(config, {})

    @patch('os.path.exists', return_value=True)
    @patch('builtins.open', side_effect=Exception("Read error"))
    def test_load_config_read_exception(self, mock_file, mock_exists):
        config = load_config("broken_config.json")
        self.assertEqual(config, {})

    @patch('os.path.exists', return_value=False)
    def test_load_config_file_not_found(self, mock_exists):
        config = load_config()
        self.assertEqual(config, {})

    # ==========================================
    # User Info API Tests
    # ==========================================

    @patch('urllib.request.urlopen')
    def test_get_user_info_success(self, mock_urlopen):
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = b'{"username": "testuser"}'

        result = get_user_info("fake_key")
        self.assertIsNotNone(result)
        self.assertEqual(result.get("username"), "testuser")

    @patch('urllib.request.urlopen')
    def test_get_user_info_unauthorized(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://urlscan.io/user/username", 401, "Unauthorized", {}, None
        )
        result = get_user_info("fake_key")
        self.assertIsNone(result)

    @patch('urllib.request.urlopen')
    def test_get_user_info_server_error(self, mock_urlopen):
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://urlscan.io/user/username", 500, "Internal Server Error", {}, None
        )
        result = get_user_info("fake_key")
        self.assertIsNone(result)

    @patch('urllib.request.urlopen')
    def test_get_user_info_generic_exception(self, mock_urlopen):
        mock_urlopen.side_effect = Exception("Connection aborted")
        result = get_user_info("fake_key")
        self.assertIsNone(result)

    # ==========================================
    # Scan Submission API Tests
    # ==========================================

    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_success(self, mock_urlopen):
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = b'{"uuid": "test-uuid-1234", "message": "Submission successful"}'
        
        result = submit_to_urlscan("https://example.com", "fake_key", verbose=True)
        self.assertIsNotNone(result)
        self.assertEqual(result.get("uuid"), "test-uuid-1234")

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_rate_limit_with_header(self, mock_urlopen, mock_sleep):
        mock_429 = urllib.error.HTTPError(
            "https://urlscan.io/api/v1/scan/", 429, "Too Many Requests", 
            {"X-Rate-Limit-Reset-After": "5"}, None
        )
        mock_429.read = lambda: b'{"message": "Rate limited"}'
        
        class Mock200:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            status = 200
            def read(self): return b'{"uuid": "test-uuid-5678"}'
        
        mock_urlopen.side_effect = [mock_429, Mock200()]
        result = submit_to_urlscan("https://example.com", "fake_key")
        
        self.assertIsNotNone(result)
        self.assertEqual(result.get("uuid"), "test-uuid-5678")
        mock_sleep.assert_called_once_with(6)

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_rate_limit_without_header(self, mock_urlopen, mock_sleep):
        mock_429 = urllib.error.HTTPError(
            "https://urlscan.io/api/v1/scan/", 429, "Too Many Requests", {}, None
        )
        mock_429.read = lambda: b'{"message": "Rate limited"}'
        
        class Mock200:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            status = 200
            def read(self): return b'{"uuid": "test-uuid-9999"}'
        
        mock_urlopen.side_effect = [mock_429, Mock200()]
        result = submit_to_urlscan("https://example.com", "fake_key")
        self.assertIsNotNone(result)
        mock_sleep.assert_called_once_with(3)

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_transient_server_error(self, mock_urlopen, mock_sleep):
        mock_503 = urllib.error.HTTPError(
            "https://urlscan.io/api/v1/scan/", 503, "Service Unavailable", {}, None
        )
        mock_503.read = lambda: b'{"message": "Gateway Timeout"}'
        
        class Mock200:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            status = 200
            def read(self): return b'{"uuid": "test-uuid-transient"}'
        
        mock_urlopen.side_effect = [mock_503, Mock200()]
        result = submit_to_urlscan("https://example.com", "fake_key")
        self.assertIsNotNone(result)
        self.assertEqual(result.get("uuid"), "test-uuid-transient")
        mock_sleep.assert_called_once_with(3)

    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_client_errors(self, mock_urlopen):
        # 400 Bad Request with verbose=True
        mock_400 = urllib.error.HTTPError("https://urlscan.io/api/v1/scan/", 400, "Bad Request", {}, None)
        mock_400.read = lambda: b'{"message": "Invalid URL"}'
        mock_urlopen.side_effect = mock_400
        self.assertIsNone(submit_to_urlscan("https://example.com", "fake_key", verbose=True))

        # 401 Unauthorized
        mock_401 = urllib.error.HTTPError("https://urlscan.io/api/v1/scan/", 401, "Unauthorized", {}, None)
        mock_401.read = lambda: b'{"message": "Invalid API key"}'
        mock_urlopen.side_effect = mock_401
        self.assertIsNone(submit_to_urlscan("https://example.com", "fake_key"))

        # 403 Forbidden
        mock_403 = urllib.error.HTTPError("https://urlscan.io/api/v1/scan/", 403, "Forbidden", {}, None)
        mock_403.read = lambda: b'{"message": "Forbidden"}'
        mock_urlopen.side_effect = mock_403
        self.assertIsNone(submit_to_urlscan("https://example.com", "fake_key"))

        # Other HTTP error (e.g., 405) with verbose output and non-JSON body
        mock_405 = urllib.error.HTTPError("https://urlscan.io/api/v1/scan/", 405, "Method Not Allowed", {}, None)
        mock_405.read = MagicMock(side_effect=Exception("Read failure"))
        mock_urlopen.side_effect = mock_405
        self.assertIsNone(submit_to_urlscan("https://example.com", "fake_key", verbose=True))

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_url_error_and_max_retries(self, mock_urlopen, mock_sleep):
        mock_urlopen.side_effect = urllib.error.URLError("DNS lookup failure")
        result = submit_to_urlscan("https://example.com", "fake_key", max_retries=2)
        self.assertIsNone(result)
        self.assertEqual(mock_sleep.call_count, 2)

    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_json_decode_and_unexpected_errors(self, mock_urlopen):
        # JSONDecodeError
        class MockInvalidJsonResp:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            status = 200
            def read(self): return b'INVALID_JSON{<'
        
        mock_urlopen.return_value = MockInvalidJsonResp()
        mock_urlopen.side_effect = None
        self.assertIsNone(submit_to_urlscan("https://example.com", "fake_key"))

        # Generic unexpected exception
        mock_urlopen.side_effect = RuntimeError("Fatal hardware failure")
        self.assertIsNone(submit_to_urlscan("https://example.com", "fake_key"))

    @patch('urllib.request.Request')
    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_advanced_parameters(self, mock_urlopen, mock_request):
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = b'{"uuid": "adv-123"}'
        
        submit_to_urlscan(
            "https://example.com", 
            "fake_key",
            tags=["phishing", "test"],
            customagent="CustomBot/1.0",
            referer="https://google.com",
            country="de"
        )
        
        args, kwargs = mock_request.call_args
        payload = json.loads(kwargs.get('data').decode('utf-8'))
        
        self.assertEqual(payload.get('tags'), ["phishing", "test"])
        self.assertEqual(payload.get('customagent'), "CustomBot/1.0")
        self.assertEqual(payload.get('referer'), "https://google.com")
        self.assertEqual(payload.get('country'), "de")

    # ==========================================
    # Scan Report Fetching Tests
    # ==========================================

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_get_scan_report_success(self, mock_urlopen, mock_sleep):
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = b'{"task": {"url": "https://example.com"}}'
        
        result = get_scan_report("fake_uuid", "fake_key")
        self.assertIsNotNone(result)
        self.assertEqual(result.get("task", {}).get("url"), "https://example.com")
        mock_sleep.assert_called_with(10)

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_get_scan_report_polling_404_then_success(self, mock_urlopen, mock_sleep):
        mock_404 = urllib.error.HTTPError("https://urlscan.io/api/v1/result/fake_uuid/", 404, "Not Found", {}, None)
        class MockSuccess:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            status = 200
            def read(self): return b'{"task": {"url": "https://done.com"}}'
        
        mock_urlopen.side_effect = [mock_404, MockSuccess()]
        result = get_scan_report("fake_uuid", "fake_key")
        self.assertIsNotNone(result)
        self.assertEqual(result.get("task", {}).get("url"), "https://done.com")

    @patch('time.time')
    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_get_scan_report_timeout(self, mock_urlopen, mock_sleep, mock_time):
        mock_time.side_effect = [0, 100, 200]
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://urlscan.io/api/v1/result/fake_uuid/", 404, "Not Found", {}, None
        )
        result = get_scan_report("fake_uuid", "fake_key")
        self.assertIsNone(result)

    @patch('time.time')
    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_get_scan_report_polling_rate_limit_and_retries(self, mock_urlopen, mock_sleep, mock_time):
        mock_time.side_effect = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
        
        mock_429_header = urllib.error.HTTPError("url", 429, "Rate limit", {"X-Rate-Limit-Reset-After": "3"}, None)
        mock_429_no_header = urllib.error.HTTPError("url", 429, "Rate limit", {}, None)
        mock_500 = urllib.error.HTTPError("url", 500, "Server Error", {}, None)
        mock_url_err = urllib.error.URLError("Network down")
        
        class MockSuccess:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            status = 200
            def read(self): return b'{"task": {"url": "https://done.com"}}'

        mock_urlopen.side_effect = [mock_429_header, mock_429_no_header, mock_500, mock_url_err, MockSuccess()]
        result = get_scan_report("fake_uuid", "fake_key")
        self.assertIsNotNone(result)
        self.assertEqual(result.get("task", {}).get("url"), "https://done.com")

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_get_scan_report_terminal_errors(self, mock_urlopen, mock_sleep):
        # HTTP 403 Fatal error
        mock_urlopen.side_effect = urllib.error.HTTPError("url", 403, "Forbidden", {}, None)
        self.assertIsNone(get_scan_report("fake_uuid", "fake_key"))

        # Generic unexpected exception
        mock_urlopen.side_effect = Exception("SSL Error")
        self.assertIsNone(get_scan_report("fake_uuid", "fake_key"))

    # ==========================================
    # Summary & Export Helpers Tests
    # ==========================================

    def test_print_summary(self):
        # Empty / None
        print_summary(None)

        # Full report with categories
        full_report = {
            "task": {"url": "https://test.com"},
            "page": {"domain": "test.com", "ip": "1.2.3.4", "country": "US", "server": "nginx"},
            "verdicts": {"overall": {"malicious": True, "score": 100, "categories": ["phishing", "malware"]}}
        }
        print_summary(full_report)

        # Report without categories or fields
        minimal_report = {"verdicts": {"overall": {}}}
        print_summary(minimal_report)

    @patch('builtins.open', new_callable=mock_open)
    @patch('csv.writer')
    def test_export_to_csv(self, mock_csv, mock_file):
        reports = [
            {
                "task": {"url": "https://test.com", "uuid": "u1"},
                "page": {"domain": "test.com", "ip": "1.1.1.1", "country": "US", "server": "nginx"},
                "verdicts": {"overall": {"malicious": True, "score": 100, "categories": ["phishing"]}}
            },
            {
                "page": {"domain": "test2.com", "server": "apache"},
                "verdicts": {"overall": {"malicious": False, "score": 0}}
            }
        ]
        
        export_to_csv(reports, "test_output.csv")
        mock_file.assert_called_once_with("test_output.csv", mode='w', newline='', encoding='utf-8')
        self.assertEqual(mock_csv.return_value.writerow.call_count, 3)

    @patch('builtins.open', side_effect=IOError("Disk write error"))
    def test_export_to_csv_error(self, mock_file):
        export_to_csv([{}], "invalid.csv")

    @patch('builtins.open', new_callable=mock_open)
    @patch('json.dump')
    def test_export_to_json(self, mock_json_dump, mock_file):
        reports = [{"uuid": "u1"}, {"uuid": "u2"}]
        export_to_json(reports, "test_output.json")
        mock_file.assert_called_once_with("test_output.json", mode='w', encoding='utf-8')
        mock_json_dump.assert_called_once_with(reports, mock_file(), indent=4)

    @patch('builtins.open', side_effect=IOError("Disk write error"))
    def test_export_to_json_error(self, mock_file):
        export_to_json([{}], "invalid.json")

    # ==========================================
    # CLI Execution (main) Tests
    # ==========================================

    @patch('sys.argv', ['urlscan_submit.py', '-d', 'example.com'])
    @patch('urlscan_submit.load_config', return_value={})
    @patch('os.path.exists', return_value=False)
    @patch.dict(os.environ, {}, clear=True)
    def test_main_no_api_key(self, mock_exists, mock_load_config):
        with patch('urlscan_submit.print') as mock_print:
            main()
            mock_print.assert_any_call("Error: API key is not set.")

    @patch('sys.argv', ['urlscan_submit.py', '-d', 'example.com', '-k', 'key.txt'])
    @patch('builtins.open', side_effect=Exception("Cannot read key file"))
    def test_main_api_key_file_read_error(self, mock_open_file):
        with patch('urlscan_submit.print') as mock_print:
            main()
            mock_print.assert_any_call("Error reading API key from file 'key.txt': Cannot read key file")

    @patch('sys.argv', ['urlscan_submit.py', '-d', 'example.com'])
    @patch('urlscan_submit.load_config', return_value={})
    @patch('os.path.exists', return_value=True)
    @patch('builtins.open', side_effect=Exception("Permission denied"))
    @patch.dict(os.environ, {}, clear=True)
    def test_main_local_api_key_txt_read_error(self, mock_open_file, mock_exists, mock_load_config):
        with patch('urlscan_submit.print') as mock_print:
            main()
            mock_print.assert_any_call("Warning: Failed to read local 'api_key.txt': Permission denied")

    @patch('sys.argv', ['urlscan_submit.py', '-d', 'example.com'])
    @patch('urlscan_submit.load_config', return_value={})
    @patch('os.path.exists', return_value=True)
    @patch('builtins.open', mock_open(read_data='local_txt_key'))
    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value=None)
    @patch('time.sleep')
    @patch.dict(os.environ, {}, clear=True)
    def test_main_local_api_key_txt_success_and_failure_metric(
        self, mock_sleep, mock_submit, mock_user_info, mock_exists, mock_load_config
    ):
        with patch('urlscan_submit.print'):
            main()
        self.assertTrue(mock_submit.called)

    @patch('sys.argv', ['urlscan_submit.py', '-d', 'invalid_domain_format!', '-k', 'key.txt'])
    @patch('builtins.open', new_callable=mock_open, read_data='api_key_123')
    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    def test_main_invalid_single_domain(self, mock_user_info, mock_file):
        with patch('urlscan_submit.print') as mock_print:
            main()
            mock_print.assert_any_call("Error: 'invalid_domain_format!' is not a valid domain format.")

    @patch('sys.argv', ['urlscan_submit.py', '-f', 'domains.txt'])
    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    def test_main_file_read_exceptions(self, mock_user_info):
        with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
            # FileNotFoundError
            with patch('builtins.open', side_effect=FileNotFoundError()):
                with patch('urlscan_submit.print') as mock_print:
                    main()
                    mock_print.assert_any_call("Error: The file 'domains.txt' was not found. Please verify the path.")

            # PermissionError
            with patch('builtins.open', side_effect=PermissionError()):
                with patch('urlscan_submit.print') as mock_print:
                    main()
                    mock_print.assert_any_call("Error: Permission denied. Unable to read the file 'domains.txt'.")

            # Generic Exception
            with patch('builtins.open', side_effect=Exception("Corrupt file")):
                with patch('urlscan_submit.print') as mock_print:
                    main()
                    mock_print.assert_any_call("Error reading file domains.txt: Corrupt file")

    @patch('sys.argv', ['urlscan_submit.py', '-f', 'empty.txt', '-k', 'key.txt'])
    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    def test_main_file_no_valid_domains(self, mock_user_info):
        def file_opener(path, *args, **kwargs):
            if path == 'key.txt':
                return io.StringIO('key123')
            elif path == 'empty.txt':
                return io.StringIO("# Comment only\n\n-invalid-\n")
            return io.StringIO('')

        with patch('builtins.open', side_effect=file_opener):
            with patch('urlscan_submit.print') as mock_print:
                main()
                mock_print.assert_any_call("Error: No valid domains found in 'empty.txt'.")

    @patch('sys.argv', ['urlscan_submit.py', '-d', 'example.com', '--wordlist', 'words.txt', '-k', 'key.txt'])
    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    def test_main_wordlist_read_error(self, mock_user_info):
        def side_effect(path, *args, **kwargs):
            if path == 'key.txt':
                return io.StringIO('key123')
            elif path == 'words.txt':
                raise IOError("Wordlist unreadable")
            return io.StringIO('')
        
        with patch('builtins.open', side_effect=side_effect):
            with patch('urlscan_submit.print') as mock_print:
                main()
                mock_print.assert_any_call("Error reading wordlist words.txt: Wordlist unreadable")

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan')
    @patch('urlscan_submit.get_scan_report')
    @patch('urlscan_submit.export_to_csv')
    @patch('urlscan_submit.export_to_json')
    @patch('time.sleep')
    def test_main_full_successful_execution_matrix(
        self, mock_sleep, mock_export_json, mock_export_csv, mock_get_report, mock_submit, mock_user_info
    ):
        mock_submit.return_value = {"uuid": "uuid-1"}
        mock_get_report.return_value = {"task": {"uuid": "uuid-1", "url": "https://example.com"}}

        cli_args = [
            'urlscan_submit.py',
            '-d', 'example.com',
            '-k', 'key.txt',
            '-p', 'both',
            '-s', 'both',
            '-xxx',
            '--tags', 'custom-tag,sec-ops',
            '--user-agent', 'CustomUA',
            '--referer', 'https://ref.com',
            '--country', 'US',
            '-r',
            '-e', 'summary.csv',
            '-j', 'logs.json',
            '-w', '2',
            '--delay', '0.1'
        ]

        with patch('sys.argv', cli_args):
            with patch('builtins.open', mock_open(read_data='valid_key_123')):
                with patch('urlscan_submit.print'):
                    main()

        self.assertTrue(mock_submit.called)
        self.assertTrue(mock_get_report.called)
        self.assertTrue(mock_export_csv.called)
        self.assertTrue(mock_export_json.called)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-wordlist"})
    @patch('time.sleep')
    def test_main_custom_wordlist_and_modes(self, mock_sleep, mock_submit, mock_user_info):
        def file_opener(path, *args, **kwargs):
            if path == 'key.txt':
                return io.StringIO('key123')
            elif path == 'custom_words.txt':
                return io.StringIO("# Header\nadmin\napi\n# Footer\n")
            elif path == 'domain_list.txt':
                return io.StringIO("test.org\nvalid.com\n")
            return io.StringIO('')

        # Test with -f domain list, --wordlist, and -xx
        cli_args = [
            'urlscan_submit.py',
            '-f', 'domain_list.txt',
            '-k', 'key.txt',
            '--wordlist', 'custom_words.txt',
            '-p', 'http',
            '-s', 'www',
            '-xx'
        ]

        with patch('sys.argv', cli_args):
            with patch('builtins.open', side_effect=file_opener):
                with patch('os.path.exists', return_value=True):
                    with patch('urlscan_submit.print'):
                        main()

        self.assertTrue(mock_submit.called)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-xx"})
    @patch('time.sleep')
    def test_main_deep_explore_xx(self, mock_sleep, mock_submit, mock_user_info):
        cli_args = [
            'urlscan_submit.py',
            '-d', 'recon.com',
            '-xx'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'env_api_key'}):
                with patch('urlscan_submit.print'):
                    main()

        self.assertTrue(mock_submit.called)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-explore"})
    @patch('time.sleep')
    def test_main_explore_and_env_api_key(self, mock_sleep, mock_submit, mock_user_info):
        cli_args = [
            'urlscan_submit.py',
            '-d', 'recon.com',
            '-x'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'env_api_key'}):
                with patch('urlscan_submit.load_config', return_value={"explore": True}):
                    with patch('urlscan_submit.print'):
                        main()

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-ip"})
    @patch('time.sleep')
    def test_main_direct_ip_submission(self, mock_sleep, mock_submit, mock_user_info):
        cli_args = [
            'urlscan_submit.py',
            '-d', '123.21.33.22',
            '-p', 'both'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'env_api_key'}):
                with patch('urlscan_submit.print'):
                    main()

        self.assertEqual(mock_submit.call_count, 2)
        submitted_urls = [call[0][0] for call in mock_submit.call_args_list]
        self.assertIn("http://123.21.33.22/", submitted_urls)
        self.assertIn("https://123.21.33.22/", submitted_urls)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-resolve-ip"})
    @patch('urlscan_submit.resolve_domain_ips', return_value=['123.21.33.22'])
    @patch('time.sleep')
    def test_main_resolve_ips_flag(self, mock_sleep, mock_resolve_ips, mock_submit, mock_user_info):
        cli_args = [
            'urlscan_submit.py',
            '-d', 'example.com',
            '-p', 'both',
            '-s', 'root',
            '-I'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'env_api_key'}):
                with patch('urlscan_submit.print'):
                    main()

        mock_resolve_ips.assert_called_with('example.com')
        submitted_urls = [call[0][0] for call in mock_submit.call_args_list]
        self.assertIn("http://example.com", submitted_urls)
        self.assertIn("https://example.com", submitted_urls)
        self.assertIn("http://123.21.33.22/", submitted_urls)
        self.assertIn("https://123.21.33.22/", submitted_urls)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-resolve-cfg"})
    @patch('urlscan_submit.resolve_domain_ips', return_value=['123.21.33.22'])
    @patch('time.sleep')
    def test_main_resolve_ips_config(self, mock_sleep, mock_resolve_ips, mock_submit, mock_user_info):
        cli_args = [
            'urlscan_submit.py',
            '-d', 'example.com',
            '-p', 'https',
            '-s', 'root'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'env_api_key'}):
                with patch('urlscan_submit.load_config', return_value={"resolve_ips": True}):
                    with patch('urlscan_submit.print'):
                        main()

        submitted_urls = [call[0][0] for call in mock_submit.call_args_list]
        self.assertIn("https://example.com", submitted_urls)
        self.assertIn("https://123.21.33.22/", submitted_urls)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-emoji-flags"})
    @patch('urlscan_submit.resolve_domain_ips', return_value=['1.2.3.4'])
    @patch('time.sleep')
    def test_main_with_emoji_flags(self, mock_sleep, mock_resolve_ips, mock_submit, mock_user_info):
        cli_args = [
            'urlscan_submit.py',
            '-🎯', 'example.com',
            '-🌐', 'both',
            '-🏢', 'both',
            '-🔍',
            '-🔎',
            '-🚀', '2'
        ]
        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
                with patch('urlscan_submit.load_config', return_value={}):
                    with patch('urlscan_submit.print'):
                        main()

        submitted_urls = [call[0][0] for call in mock_submit.call_args_list]
        self.assertIn("https://example.com", submitted_urls)
        self.assertIn("http://example.com", submitted_urls)
        self.assertIn("https://www.example.com", submitted_urls)
        self.assertIn("http://1.2.3.4/", submitted_urls)

    def test_extract_linked_domains_all_sources(self):
        sample_report = {
            "data": {
                "links": [
                    {"href": "https://linked-one.org/login", "text": "Login"},
                    {"href": "http://123.21.33.22/admin"},
                    "https://direct-string-link.com/home",
                    {"href": ""}  # empty
                ],
                "requests": [
                    {
                        "request": {"documentURL": "https://req-doc.net/script.js"},
                        "response": {"response": {"url": "https://res-url.io/api"}}
                    }
                ]
            },
            "lists": {
                "domains": ["contacted-domain.biz", "example.com"],
                "urls": ["https://url-in-list.com/index.html"]
            }
        }
        discovered = extract_linked_domains(sample_report)
        self.assertIn("linked-one.org", discovered)
        self.assertIn("123.21.33.22", discovered)
        self.assertIn("direct-string-link.com", discovered)
        self.assertIn("req-doc.net", discovered)
        self.assertIn("res-url.io", discovered)
        self.assertIn("contacted-domain.biz", discovered)
        self.assertIn("example.com", discovered)
        self.assertIn("url-in-list.com", discovered)

    def test_extract_linked_domains_empty_and_invalid(self):
        self.assertEqual(extract_linked_domains(None), [])
        self.assertEqual(extract_linked_domains({}), [])
        self.assertEqual(extract_linked_domains({"data": None, "lists": None}), [])

    def test_generate_tags_for_url_recursion(self):
        tags = generate_tags_for_url(
            url="https://phishing-partner.biz",
            recursion_depth=2
        )
        self.assertIn("🕸️-depth-2", tags)
        self.assertIn("🕸️-recursive", tags)
        self.assertIn("🔒-https", tags)
        self.assertIn("🏷️-biz", tags)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan')
    @patch('urlscan_submit.get_scan_report')
    @patch('time.sleep')
    def test_main_recursive_scan_execution(self, mock_sleep, mock_report, mock_submit, mock_user_info):
        # Mock submit returning UUIDs
        mock_submit.side_effect = [
            {"uuid": "uuid-level0"},
            {"uuid": "uuid-level1-a"}
        ]
        # Mock scan report discovering a new linked domain
        mock_report.return_value = {
            "data": {
                "links": [
                    {"href": "https://discovered-partner.com/portal"}
                ]
            },
            "lists": {
                "domains": ["discovered-partner.com"]
            }
        }

        cli_args = [
            'urlscan_submit.py',
            '-d', 'rootdomain.com',
            '-p', 'https',
            '-s', 'root',
            '-R', '1',
            '--max-links', '5'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
                with patch('urlscan_submit.load_config', return_value={}):
                    with patch('urlscan_submit.print'):
                        main()

        submitted_urls = [call[0][0] for call in mock_submit.call_args_list]
        self.assertIn("https://rootdomain.com", submitted_urls)
        self.assertIn("https://discovered-partner.com", submitted_urls)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-0"})
    @patch('urlscan_submit.get_scan_report', return_value={})
    @patch('time.sleep')
    def test_main_recursive_scan_no_new_links(self, mock_sleep, mock_report, mock_submit, mock_user_info):
        cli_args = [
            'urlscan_submit.py',
            '-d', 'empty-links.com',
            '-R', '2'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
                with patch('urlscan_submit.load_config', return_value={}):
                    with patch('urlscan_submit.print'):
                        main()

        self.assertEqual(mock_submit.call_count, 1)

    def test_extract_hostname(self):
        self.assertEqual(extract_hostname("https://client.gov.ru/path?query=1"), "client.gov.ru")
        self.assertEqual(extract_hostname("http://123.21.33.22:8080/"), "123.21.33.22")
        self.assertEqual(extract_hostname("EXAMPLE.COM"), "example.com")

    def test_can_resolve_dns(self):
        # IP addresses always resolve to True
        self.assertTrue(can_resolve_dns("123.21.33.22"))
        
        # Mocked socket
        with patch('socket.gethostbyname', return_value="93.184.216.34"):
            self.assertTrue(can_resolve_dns("example.com"))

        with patch('socket.gethostbyname', side_effect=socket.gaierror("not found")):
            self.assertFalse(can_resolve_dns("nonexistent-domain-xyz123.com"))

    def test_submit_to_urlscan_records_dns_error(self):
        unresolvable = set()
        mock_response = MagicMock()
        mock_response.read.return_value = json.dumps({
            "message": "DNS Error - Could not resolve domain",
            "status": 400
        }).encode("utf-8")

        mock_http_error = urllib.error.HTTPError(
            url="https://urlscan.io/api/v1/scan",
            code=400,
            msg="Bad Request",
            hdrs={},
            fp=mock_response
        )

        with patch('urllib.request.urlopen', side_effect=mock_http_error):
            res = submit_to_urlscan(
                url="http://client.gov.ru",
                api_key="test_key",
                unresolvable_hosts=unresolvable
            )
            self.assertIsNone(res)
            self.assertIn("client.gov.ru", unresolvable)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan')
    @patch('time.sleep')
    def test_main_skips_https_when_http_fails_dns(self, mock_sleep, mock_submit, mock_user_info):
        # When http://client.gov.ru is submitted, simulate submit_to_urlscan recording it as unresolvable
        def mock_submit_impl(url, *args, **kwargs):
            unresolvable = kwargs.get("unresolvable_hosts")
            if url == "http://client.gov.ru":
                if unresolvable is not None:
                    unresolvable.add("client.gov.ru")
                return None
            return {"uuid": "uuid-other"}

        mock_submit.side_effect = mock_submit_impl

        cli_args = [
            'urlscan_submit.py',
            '-d', 'client.gov.ru',
            '-p', 'both',  # generates http://client.gov.ru and https://client.gov.ru
            '-s', 'root'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
                with patch('urlscan_submit.load_config', return_value={}):
                    with patch('urlscan_submit.print'):
                        main()

        # http://client.gov.ru is submitted once; https://client.gov.ru is skipped before submission!
        self.assertEqual(mock_submit.call_count, 1)
        submitted_urls = [call[0][0] for call in mock_submit.call_args_list]
        self.assertEqual(submitted_urls, ["http://client.gov.ru"])

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.can_resolve_dns', return_value=False)
    @patch('urlscan_submit.submit_to_urlscan')
    @patch('time.sleep')
    def test_main_dns_precheck_flag(self, mock_sleep, mock_submit, mock_can_resolve, mock_user_info):
        cli_args = [
            'urlscan_submit.py',
            '-d', 'unresolvable-domain.com',
            '-D'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
                with patch('urlscan_submit.load_config', return_value={}):
                    with patch('urlscan_submit.print'):
                        main()

        # Skips submitting entirely because DNS precheck failed
        self.assertEqual(mock_submit.call_count, 0)

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-full-combo"})
    @patch('urlscan_submit.get_scan_report', return_value={"data": {}, "lists": {"domains": ["linked.org"]}})
    @patch('urlscan_submit.resolve_domain_ips', return_value=['1.1.1.1'])
    @patch('urlscan_submit.can_resolve_dns', return_value=True)
    @patch('urlscan_submit.export_to_csv')
    @patch('urlscan_submit.export_to_json')
    @patch('time.sleep')
    def test_main_all_parameters_combination_full(
        self, mock_sleep, mock_export_json, mock_export_csv,
        mock_can_resolve, mock_resolve_ips, mock_get_report, mock_submit, mock_user_info
    ):
        cli_args = [
            'urlscan_submit.py',
            '-d', 'megacorp.com',
            '-p', 'both',
            '-s', 'both',
            '-xxx',
            '-I',
            '-D',
            '-w', '4',
            '--delay', '0.01',
            '-t', 'incident-404,pentest',
            '-V', 'private',
            '--country', 'us',
            '-ua', 'CustomThreatBot/2.0',
            '--referer', 'https://internal.sec.team',
            '-r',
            '-e', 'full_matrix.csv',
            '-j', 'full_matrix.json',
            '-R', '1',
            '--max-links', '2',
            '-v'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
                with patch('urlscan_submit.load_config', return_value={}):
                    with patch('urlscan_submit.print'):
                        main()

        self.assertTrue(mock_submit.called)
        self.assertTrue(mock_get_report.called)
        self.assertTrue(mock_export_csv.called)
        self.assertTrue(mock_export_json.called)

        # Check call arguments for submit_to_urlscan
        submit_args = mock_submit.call_args_list[0][0]
        submit_kwargs = mock_submit.call_args_list[0][1]
        self.assertEqual(submit_args[2], "private")
        self.assertEqual(submit_kwargs.get("country"), "us")
        self.assertEqual(submit_kwargs.get("customagent"), "CustomThreatBot/2.0")
        self.assertEqual(submit_kwargs.get("referer"), "https://internal.sec.team")
        self.assertTrue(submit_kwargs.get("verbose"))
        self.assertIn("incident-404", submit_kwargs.get("tags", []))
        self.assertIn("pentest", submit_kwargs.get("tags", []))

    @patch('urlscan_submit.get_user_info', return_value={"username": "testuser"})
    @patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-emoji-combo"})
    @patch('urlscan_submit.get_scan_report', return_value={"data": {}, "lists": {"domains": []}})
    @patch('urlscan_submit.resolve_domain_ips', return_value=['8.8.8.8'])
    @patch('urlscan_submit.can_resolve_dns', return_value=True)
    @patch('urlscan_submit.export_to_csv')
    @patch('urlscan_submit.export_to_json')
    @patch('time.sleep')
    def test_main_all_emoji_flags_combination(
        self, mock_sleep, mock_export_json, mock_export_csv,
        mock_can_resolve, mock_resolve_ips, mock_get_report, mock_submit, mock_user_info
    ):
        cli_args = [
            'urlscan_submit.py',
            '-🎯', 'targetcorp.io',
            '-🌐', 'both',
            '-🏢', 'both',
            '-🔍',
            '-🔎',
            '-🧪',
            '-🚀', '2',
            '-🐢', '0.01',
            '-🏷', 'triage,ops',
            '-👻', 'unlisted',
            '-🌍', 'de',
            '-🤖', 'SecBot/1.0',
            '-🔗', 'https://threatintel.org',
            '-📝',
            '-📊', 'emoji_run.csv',
            '-📜', 'emoji_run.json',
            '-🕸', '1',
            '-📎', '3'
        ]

        with patch('sys.argv', cli_args):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
                with patch('urlscan_submit.load_config', return_value={}):
                    with patch('urlscan_submit.print'):
                        main()

        self.assertTrue(mock_submit.called)
        self.assertTrue(mock_export_csv.called)
        self.assertTrue(mock_export_json.called)

    def test_module_main_invocation(self):
        import runpy
        with patch('sys.argv', ['urlscan_submit.py', '-d', 'example.com']):
            with patch.dict(os.environ, {'URLSCAN_API_KEY': 'test_key'}):
                with patch('urlscan_submit.get_user_info', return_value={"username": "testuser"}):
                    with patch('urlscan_submit.submit_to_urlscan', return_value={"uuid": "uuid-runpy"}):
                        with patch('time.sleep'):
                            with patch('tqdm.tqdm.write'):
                                runpy.run_module('urlscan_submit', run_name='__main__')

if __name__ == '__main__':
    unittest.main()

