import unittest
from unittest.mock import patch, mock_open
import sys
import os

# Insert the parent directory into sys.path to allow importing urlscan_submit
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import urlscan_submit
from urlscan_submit import is_valid_domain, load_config

class TestUrlscanSubmit(unittest.TestCase):

    def test_is_valid_domain_valid(self):
        valid_domains = [
            "example.com",
            "sub.example.com",
            "my-domain.co.uk",
            "1.1.1.1",
            "example.org"
        ]
        for domain in valid_domains:
            with self.subTest(domain=domain):
                self.assertTrue(is_valid_domain(domain))

    def test_is_valid_domain_invalid(self):
        invalid_domains = [
            "http://example.com",
            "example.com/path",
            "-example.com",
            "example-.com",
            "invalid_domain",
            "example..com",
            ""
        ]
        for domain in invalid_domains:
            with self.subTest(domain=domain):
                self.assertFalse(is_valid_domain(domain))

    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='{"api_key": "test_json_key", "visibility": "private"}')
    def test_load_config_json(self, mock_file, mock_exists):
        # Mock os.path.exists to only return True for a specific JSON file path
        mock_exists.side_effect = lambda path: path.endswith('.json')
        
        config = load_config(".urlscan-config.json")
        
        self.assertEqual(config.get("api_key"), "test_json_key")
        self.assertEqual(config.get("visibility"), "private")
        mock_file.assert_called_once_with(".urlscan-config.json", "r")

    @unittest.skipIf(urlscan_submit.yaml is None, "PyYAML is not installed")
    @patch('os.path.exists')
    @patch('builtins.open', new_callable=mock_open, read_data='api_key: test_yaml_key\nvisibility: public')
    def test_load_config_yaml(self, mock_file, mock_exists):
        # Mock os.path.exists to only return True for a specific YAML file path
        mock_exists.side_effect = lambda path: path.endswith('.yaml')
        
        config = load_config(".urlscan-config.yaml")
        
        self.assertEqual(config.get("api_key"), "test_yaml_key")
        self.assertEqual(config.get("visibility"), "public")
        mock_file.assert_called_once_with(".urlscan-config.yaml", "r")

    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_success(self, mock_urlopen):
        # Mock a successful JSON response
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = b'{"uuid": "test-uuid-1234", "message": "Submission successful"}'
        
        result = urlscan_submit.submit_to_urlscan("https://example.com", "fake_key")
        self.assertIsNotNone(result)
        self.assertEqual(result.get("uuid"), "test-uuid-1234")

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_rate_limit(self, mock_urlopen, mock_sleep):
        # Mock a 429 response on the first try, then a 200 on the second
        import urllib.error
        
        # Create a mock 429 HTTPError
        mock_429 = urllib.error.HTTPError(
            "https://urlscan.io/api/v1/scan/", 429, "Too Many Requests", 
            {"X-Rate-Limit-Reset-After": "5"}, None
        )
        mock_429.read = lambda: b'{"message": "Rate limited"}'
        
        # Create a mock 200 Success
        class Mock200:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            status = 200
            def read(self): return b'{"uuid": "test-uuid-5678"}'
        
        mock_urlopen.side_effect = [mock_429, Mock200()]
        
        result = urlscan_submit.submit_to_urlscan("https://example.com", "fake_key")
        
        self.assertIsNotNone(result)
        self.assertEqual(result.get("uuid"), "test-uuid-5678")
        # Check that we slept for int(X-Rate-Limit-Reset-After) + 1 = 6 seconds
        mock_sleep.assert_called_once_with(6)

    @patch('urllib.request.urlopen')
    def test_get_user_info_success(self, mock_urlopen):
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = b'{"username": "testuser"}'

        result = urlscan_submit.get_user_info("fake_key")
        self.assertIsNotNone(result)
        self.assertEqual(result.get("username"), "testuser")

    @patch('urllib.request.urlopen')
    def test_get_user_info_unauthorized(self, mock_urlopen):
        import urllib.error
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://urlscan.io/user/username", 401, "Unauthorized", {}, None
        )
        
        result = urlscan_submit.get_user_info("fake_key")
        self.assertIsNone(result)

    @patch('urllib.request.Request')
    @patch('urllib.request.urlopen')
    def test_submit_to_urlscan_advanced_parameters(self, mock_urlopen, mock_request):
        import json
        
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = b'{"uuid": "adv-123"}'
        
        urlscan_submit.submit_to_urlscan(
            "https://example.com", 
            "fake_key",
            tags=["phishing", "test"],
            customagent="CustomBot/1.0",
            referer="https://google.com",
            country="de"
        )
        
        # Get the arguments passed to urllib.request.Request
        args, kwargs = mock_request.call_args
        
        # Parse the JSON payload passed to 'data'
        payload = json.loads(kwargs.get('data').decode('utf-8'))
        
        self.assertEqual(payload.get('tags'), ["phishing", "test"])
        self.assertEqual(payload.get('customagent'), "CustomBot/1.0")
        self.assertEqual(payload.get('referer'), "https://google.com")
        self.assertEqual(payload.get('country'), "de")

    @patch('builtins.open', new_callable=mock_open)
    @patch('csv.writer')
    def test_export_to_csv(self, mock_csv, mock_file):
        reports = [
            {"page": {"url": "https://test.com", "domain": "test.com", "server": "nginx"}, "verdicts": {"malicious": True, "score": 100}, "uuid": "u1"},
            {"page": {"url": "https://test2.com", "domain": "test2.com", "server": "apache"}, "verdicts": {"malicious": False, "score": 0}, "uuid": "u2"}
        ]
        
        urlscan_submit.export_to_csv(reports, "test_output.csv")
        
        mock_file.assert_called_once_with("test_output.csv", mode='w', newline='', encoding='utf-8')
        # It writes header + 2 rows = 3 calls to writerow
        self.assertEqual(mock_csv.return_value.writerow.call_count, 3)
        
        # Verify the data passed to the second call to writerow (first data row)
        written_row = mock_csv.return_value.writerow.mock_calls[1][1][0]
        self.assertEqual(written_row[0], "")  # task.url is empty because report didn't have 'task'
        self.assertEqual(written_row[1], "test.com")
        self.assertEqual(written_row[5], "")  # overall.malicious is empty


    @patch('builtins.open', new_callable=mock_open)
    @patch('json.dump')
    def test_export_to_json(self, mock_json_dump, mock_file):
        reports = [{"uuid": "u1"}, {"uuid": "u2"}]
        urlscan_submit.export_to_json(reports, "test_output.json")
        
        mock_file.assert_called_once_with("test_output.json", mode='w', encoding='utf-8')
        mock_json_dump.assert_called_once_with(reports, mock_file(), indent=4)

    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_get_scan_report_success(self, mock_urlopen, mock_sleep):
        mock_response = mock_urlopen.return_value.__enter__.return_value
        mock_response.status = 200
        mock_response.read.return_value = b'{"task": {"url": "https://example.com"}}'
        
        result = urlscan_submit.get_scan_report("fake_uuid", "fake_key")
        
        self.assertIsNotNone(result)
        self.assertEqual(result.get("task", {}).get("url"), "https://example.com")
        # Ensure it sleeps for 10 seconds initially
        mock_sleep.assert_called_once_with(10)

    @patch('time.time')
    @patch('time.sleep')
    @patch('urllib.request.urlopen')
    def test_get_scan_report_timeout(self, mock_urlopen, mock_sleep, mock_time):
        import urllib.error
        
        # Make time.time() advance by 100 seconds to simulate a timeout immediately after first loop
        mock_time.side_effect = [0, 100, 200]
        
        # Simulate 404 Not Found (scan not ready)
        mock_urlopen.side_effect = urllib.error.HTTPError(
            "https://urlscan.io/api/v1/result/fake_uuid/", 404, "Not Found", {}, None
        )
        
        result = urlscan_submit.get_scan_report("fake_uuid", "fake_key")
        
        self.assertIsNone(result)

if __name__ == '__main__':
    unittest.main()
