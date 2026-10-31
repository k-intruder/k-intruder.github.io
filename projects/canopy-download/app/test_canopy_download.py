import tempfile
import unittest
from pathlib import Path
from urllib.error import HTTPError
from unittest.mock import patch

import canopy_download as download


class SearchTests(unittest.TestCase):
    def test_paginates_and_keeps_only_task_items(self):
        pages = [
            {
                "features": [
                    {"id": "item-1", "properties": {"umbra:task_id": "task-1"}},
                    {"id": "archive", "properties": {}},
                ],
                "links": [
                    {
                        "rel": "next",
                        "href": "/v2/stac/search",
                        "method": "POST",
                        "body": {"collections": ["umbra-sar"], "limit": 100, "token": "next"},
                    }
                ],
            },
            {"features": [{"id": "item-2", "properties": {"umbra:task_id": "task-2"}}], "links": []},
        ]
        calls = []

        class FakeClient:
            def json(self, method, url, body=None):
                calls.append((method, url, body))
                return pages.pop(0)

        items = list(download.search_task_items(FakeClient(), {"task-1"}))
        self.assertEqual([item["id"] for item in items], ["item-1"])
        self.assertEqual(calls[1][2]["token"], "next")

    def test_rejects_external_pagination_link(self):
        class FakeClient:
            def json(self, method, url, body=None):
                return {"features": [], "links": [{"rel": "next", "href": "https://evil.example/"}]}

        with self.assertRaises(ValueError):
            list(download.search_task_items(FakeClient(), None))


class DownloadTests(unittest.TestCase):
    def test_downloads_only_selected_asset(self):
        item = {
            "id": "item-1",
            "properties": {"umbra:task_id": "task-1"},
            "assets": {
                "one.tif": {"alternate": {"s3_signed": {"href": "https://s3.example/one"}}},
                "two.json": {"alternate": {"s3_signed": {"href": "https://s3.example/two"}}},
            },
        }

        class FakeClient:
            def json(self, method, url, body=None):
                return item

        class FakeResponse:
            headers = {"Content-Length": "1"}

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def read(self, size):
                result, self.data = self.data, b""
                return result

            data = b"x"

        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            with patch.object(download, "urlopen", return_value=FakeResponse()):
                records = download.download_item(FakeClient(), item, Path(directory), asset_keys={"one.tif"})
        self.assertEqual([record["asset"] for record in records], ["one.tif"])

    def test_signed_url_download_is_atomic_and_skips_on_rerun(self):
        item = {
            "id": "item-1",
            "properties": {"umbra:task_id": "task-1"},
            "assets": {"image.tif": {"alternate": {"s3_signed": {"href": "https://s3.example/image"}}}},
        }

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def read(self, size):
                result, self.data = self.data, b""
                return result

            data = b"image bytes"

        class FakeClient:
            def json(self, method, url, body=None):
                return item

        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            with patch.object(download, "urlopen", return_value=FakeResponse()) as get:
                result = download.download_item(FakeClient(), item, Path(directory))
                self.assertEqual(result[0]["status"], "downloaded", result)
                self.assertEqual(len(list(Path(directory).rglob("*.tif"))), 1)
                self.assertEqual(download.download_item(FakeClient(), item, Path(directory))[0]["status"], "skipped")
                self.assertEqual(get.call_count, 1)

    def test_refreshes_expired_signed_url_without_bearer_header(self):
        def make_item(url):
            return {
                "id": "item-1",
                "properties": {"umbra:task_id": "task-1"},
                "assets": {"image.tif": {"alternate": {"s3_signed": {"href": url}}}},
            }

        class FakeClient:
            calls = 0

            def json(self, method, url, body=None):
                self.calls += 1
                return make_item("https://s3.example/new" if self.calls > 1 else "https://s3.example/old")

        class FakeResponse:
            headers = {"Content-Length": "2"}

            def __enter__(self):
                return self

            def __exit__(self, *args):
                pass

            def read(self, size):
                result, self.data = self.data, b""
                return result

            data = b"ok"

        calls = []

        def fake_get(request, timeout):
            calls.append(request)
            if len(calls) == 1:
                raise HTTPError(request.full_url, 403, "expired", {}, None)
            return FakeResponse()

        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            with patch.object(download, "urlopen", side_effect=fake_get):
                result = download.download_item(FakeClient(), make_item("https://s3.example/old"), Path(directory))
        self.assertEqual(result[0]["status"], "downloaded", result)
        self.assertEqual([request.full_url for request in calls], ["https://s3.example/old", "https://s3.example/new"])
        self.assertTrue(all("Authorization" not in request.headers for request in calls))


if __name__ == "__main__":
    unittest.main()
