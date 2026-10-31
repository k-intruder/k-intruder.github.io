import tempfile
import threading
import unittest
from http.cookiejar import CookieJar
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import HTTPCookieProcessor, Request, build_opener
from unittest.mock import patch

import web_app


class WebStateTests(unittest.TestCase):
    def test_local_http_requires_session_and_csrf(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            state = web_app.WebState(Path(directory))
            server = ThreadingHTTPServer(("127.0.0.1", 0), web_app.handler_for(state, "session-test", "csrf-test"))
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            base = f"http://127.0.0.1:{server.server_port}"
            try:
                opener = build_opener(HTTPCookieProcessor(CookieJar()))
                with opener.open(base + "/") as response:
                    self.assertIn(b"csrf-test", response.read())
                with opener.open(base + "/api/state") as response:
                    self.assertIn(b"disconnected", response.read())
                saved = Path(directory) / "sample.bin"
                saved.write_bytes(b"example")
                state.assets["asset-1"] = {"status": "saved", "path": str(saved)}
                with opener.open(base + "/api/file/asset-1") as response:
                    self.assertEqual(response.read(), b"example")
                    self.assertIn("attachment", response.headers["Content-Disposition"])
                request = Request(base + "/api/connect", data=b'{"token":"test"}', headers={"Content-Type": "application/json"})
                with self.assertRaises(HTTPError) as error:
                    opener.open(request)
                self.assertEqual(error.exception.code, 403)
                request = Request(base + "/api/connect", data=b'{"token":""}', headers={"Content-Type": "application/json", "X-CSRF-Token": "csrf-test"})
                with self.assertRaises(HTTPError) as error:
                    opener.open(request)
                self.assertEqual(error.exception.code, 400)
            finally:
                server.shutdown()
                server.server_close()

    def test_scan_lists_assets_without_signed_urls_and_downloads_one(self):
        feature = {"id": "item-1", "properties": {"umbra:task_id": "task-1", "datetime": "2026-01-01T00:00:00Z"}}
        detail = {
            **feature,
            "assets": {
                "one.tif": {"title": "GEC", "alternate": {"s3_signed": {"href": "https://secret.example/one"}}},
                "two.json": {"title": "Metadata", "alternate": {"s3_signed": {"href": "https://secret.example/two"}}},
            },
        }

        class FakeClient:
            def __init__(self, token):
                self.token = token

            def json(self, method, url, body=None):
                if url.endswith("/search"):
                    return {"features": [feature], "links": []}
                return detail

        chosen = []

        def fake_download(client, item, folder, asset_keys=None):
            chosen.extend(asset_keys)
            return [{"asset": key, "file": str(folder / key), "status": "downloaded"} for key in asset_keys]

        with tempfile.TemporaryDirectory(dir=Path(__file__).parent) as directory:
            state = web_app.WebState(Path(directory))
            state.token = "test-token"
            with patch.object(web_app, "CanopyClient", FakeClient):
                state._scan()
                snapshot = state.snapshot()
                self.assertEqual(len(snapshot["assets"]), 2)
                self.assertNotIn("secret.example", str(snapshot))
                selected_id = next(asset["id"] for asset in snapshot["assets"] if asset["asset"] == "one.tif")
                with patch.object(web_app, "download_item", side_effect=fake_download):
                    state._download([selected_id])
            self.assertEqual(chosen, ["one.tif"])
            self.assertEqual(state.snapshot()["completed"], 1)


if __name__ == "__main__":
    unittest.main()
