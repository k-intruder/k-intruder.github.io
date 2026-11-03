"""Local, dependency-free web interface for Canopy tasking downloads."""

import argparse
import csv
import hashlib
import json
import secrets
import threading
import webbrowser
from collections import defaultdict
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import quote, urlparse

from canopy_download import CanopyClient, ITEM_URL, download_item, safe_name, search_task_items


STATIC = Path(__file__).with_name("static")


class WebState:
    def __init__(self, output_dir):
        self.output_dir = output_dir.resolve()
        self.lock = threading.RLock()
        self.token = None
        self.phase = "disconnected"
        self.error = ""
        self.assets = {}
        self.search_items = {}
        self.scanned_items = 0
        self.completed = 0
        self.total = 0

    def snapshot(self):
        with self.lock:
            return {
                "phase": self.phase,
                "error": self.error,
                "assets": [entry.copy() for entry in self.assets.values()],
                "scanned_items": self.scanned_items,
                "completed": self.completed,
                "total": self.total,
                "output_dir": str(self.output_dir),
            }

    def connect(self, token):
        if not isinstance(token, str) or not 1 <= len(token.strip()) <= 8192:
            raise ValueError("Canopy access token을 입력하세요.")
        with self.lock:
            if self.phase in ("scanning", "downloading"):
                raise ValueError("진행 중인 작업이 끝난 뒤 다시 시도하세요.")
            self.token = token.strip()
            self.phase = "scanning"
            self.error = ""
            self.assets = {}
            self.search_items = {}
            self.scanned_items = 0
            self.completed = 0
            self.total = 0
        threading.Thread(target=self._scan, daemon=True).start()

    def _scan(self):
        try:
            client = CanopyClient(self.token)
            for feature in search_task_items(client, None):
                item_id = str(feature["id"])
                task_id = str(feature["properties"]["umbra:task_id"])
                detail = client.json("GET", ITEM_URL + quote(item_id, safe=""))
                if detail.get("properties", {}).get("umbra:task_id") != task_id:
                    continue
                entries = {}
                for key, asset in detail.get("assets", {}).items():
                    asset_id = hashlib.sha256((item_id + "\0" + key).encode("utf-8")).hexdigest()[:24]
                    path = self.output_dir / safe_name(task_id) / safe_name(item_id) / safe_name(key)
                    entries[asset_id] = {
                        "id": asset_id,
                        "task_id": task_id,
                        "item_id": item_id,
                        "asset": key,
                        "product": asset.get("title") or asset.get("description") or "파일",
                        "datetime": detail.get("properties", {}).get("datetime", ""),
                        "status": "saved" if path.is_file() and path.stat().st_size > 0 else "available",
                        "path": str(path) if path.is_file() and path.stat().st_size > 0 else "",
                        "error": "",
                    }
                with self.lock:
                    self.scanned_items += 1
                    self.search_items[item_id] = feature
                    self.assets.update(entries)
            with self.lock:
                self.phase = "ready"
        except Exception as exc:
            with self.lock:
                self.phase = "error"
                self.error = str(exc)

    def start_download(self, selected_ids):
        with self.lock:
            if self.phase != "ready":
                raise ValueError("목록 조회가 끝난 뒤 다운로드를 시작하세요.")
            if selected_ids == "all":
                selected_ids = list(self.assets)
            if not isinstance(selected_ids, list) or not selected_ids:
                raise ValueError("다운로드할 파일을 선택하세요.")
            if any(not isinstance(asset_id, str) or asset_id not in self.assets for asset_id in selected_ids):
                raise ValueError("알 수 없는 파일 ID가 포함되어 있습니다.")
            selected_ids = list(dict.fromkeys(selected_ids))
            self.phase = "downloading"
            self.error = ""
            self.completed = 0
            self.total = len(selected_ids)
        threading.Thread(target=self._download, args=(selected_ids,), daemon=True).start()

    def _download(self, selected_ids):
        try:
            self._download_impl(selected_ids)
        except Exception as exc:
            with self.lock:
                self.phase = "error"
                self.error = str(exc)
        else:
            with self.lock:
                self.phase = "ready"

    def _download_impl(self, selected_ids):
        grouped = defaultdict(set)
        with self.lock:
            for asset_id in selected_ids:
                entry = self.assets[asset_id]
                grouped[entry["item_id"]].add(entry["asset"])
            features = {item_id: self.search_items[item_id] for item_id in grouped}
        client = CanopyClient(self.token)
        for item_id, keys in grouped.items():
            try:
                records = download_item(client, features[item_id], self.output_dir, asset_keys=keys)
                by_key = {record["asset"]: record for record in records}
            except Exception as exc:
                by_key = {key: {"status": "failed", "error": str(exc), "file": ""} for key in keys}
            with self.lock:
                for entry in self.assets.values():
                    if entry["item_id"] == item_id and entry["asset"] in keys:
                        result = by_key[entry["asset"]]
                        entry["status"] = "saved" if result["status"] in ("downloaded", "skipped") else "failed"
                        entry["path"] = result.get("file", "") if entry["status"] == "saved" else ""
                        entry["error"] = result.get("error", "")
                        self.completed += 1
        self._write_manifest()

    def _write_manifest(self):
        self.output_dir.mkdir(parents=True, exist_ok=True)
        with self.lock:
            rows = [entry.copy() for entry in self.assets.values()]
        with (self.output_dir / "manifest.csv").open("w", newline="", encoding="utf-8-sig") as file:
            writer = csv.DictWriter(file, fieldnames=["task_id", "item_id", "asset", "product", "datetime", "status", "path", "error"])
            writer.writeheader()
            for row in rows:
                writer.writerow({key: row.get(key, "") for key in writer.fieldnames})

    def saved_file(self, asset_id):
        with self.lock:
            entry = self.assets.get(asset_id)
            if not entry or entry["status"] != "saved":
                return None
            path = Path(entry["path"]).resolve()
        if not path.is_relative_to(self.output_dir) or not path.is_file():
            return None
        return path


def handler_for(state, session_id, csrf_token):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format, *args):
            pass

        def _security_headers(self):
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header("X-Frame-Options", "DENY")
            self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")

        def _valid_host(self):
            port = self.server.server_port
            return self.headers.get("Host", "").lower() in (f"127.0.0.1:{port}", f"localhost:{port}")

        def _session_ok(self):
            cookie = self.headers.get("Cookie", "")
            return any(part.strip() == "canopy_session=" + session_id for part in cookie.split(";"))

        def _json(self, status, payload):
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            self.send_response(status)
            self._security_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if not self._valid_host():
                return self._json(HTTPStatus.BAD_REQUEST, {"error": "잘못된 Host입니다."})
            route = urlparse(self.path).path
            if route in ("/", "/app.js", "/style.css"):
                filename = "index.html" if route == "/" else route[1:]
                body = (STATIC / filename).read_bytes()
                if route == "/":
                    body = body.replace(b"__CSRF_TOKEN__", csrf_token.encode("ascii"))
                content_type = "text/html; charset=utf-8" if route == "/" else "text/javascript; charset=utf-8" if route.endswith(".js") else "text/css; charset=utf-8"
                self.send_response(HTTPStatus.OK)
                self._security_headers()
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", str(len(body)))
                if route == "/":
                    self.send_header("Set-Cookie", f"canopy_session={session_id}; HttpOnly; SameSite=Strict; Path=/")
                self.end_headers()
                return self.wfile.write(body)
            if not self._session_ok():
                return self._json(HTTPStatus.FORBIDDEN, {"error": "세션을 확인할 수 없습니다."})
            if route == "/api/state":
                return self._json(HTTPStatus.OK, state.snapshot())
            if route.startswith("/api/file/"):
                asset_id = route.removeprefix("/api/file/")
                path = state.saved_file(asset_id)
                if path is None:
                    return self._json(HTTPStatus.NOT_FOUND, {"error": "저장된 파일을 찾을 수 없습니다."})
                self.send_response(HTTPStatus.OK)
                self._security_headers()
                self.send_header("Content-Type", "application/octet-stream")
                self.send_header("Content-Disposition", "attachment; filename*=UTF-8''" + quote(path.name))
                self.send_header("Content-Length", str(path.stat().st_size))
                self.end_headers()
                try:
                    with path.open("rb") as file:
                        while chunk := file.read(1024 * 1024):
                            self.wfile.write(chunk)
                except (BrokenPipeError, ConnectionResetError):
                    pass
                return
            return self._json(HTTPStatus.NOT_FOUND, {"error": "페이지를 찾을 수 없습니다."})

        def do_POST(self):
            if not self._valid_host() or not self._session_ok():
                return self._json(HTTPStatus.FORBIDDEN, {"error": "접근을 거부했습니다."})
            origin = self.headers.get("Origin")
            allowed_origins = (f"http://127.0.0.1:{self.server.server_port}", f"http://localhost:{self.server.server_port}")
            if origin and origin not in allowed_origins:
                return self._json(HTTPStatus.FORBIDDEN, {"error": "다른 사이트의 요청을 거부했습니다."})
            if self.headers.get("X-CSRF-Token") != csrf_token:
                return self._json(HTTPStatus.FORBIDDEN, {"error": "요청 확인 토큰이 없습니다."})
            if self.headers.get("Content-Type", "").split(";")[0].strip() != "application/json":
                return self._json(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, {"error": "JSON 요청만 허용합니다."})
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 65536:
                    raise ValueError("요청 크기가 잘못되었습니다.")
                data = json.loads(self.rfile.read(length))
                if not isinstance(data, dict):
                    raise ValueError("요청 형식이 잘못되었습니다.")
                if self.path == "/api/connect":
                    state.connect(data.get("token"))
                elif self.path == "/api/download":
                    state.start_download(data.get("ids"))
                else:
                    return self._json(HTTPStatus.NOT_FOUND, {"error": "요청을 찾을 수 없습니다."})
            except (ValueError, TypeError) as exc:
                return self._json(HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return self._json(HTTPStatus.ACCEPTED, {"ok": True})

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Canopy 로컬 웹 다운로드 화면")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument("--output", type=Path, default=Path("downloads"))
    parser.add_argument("--no-browser", action="store_true")
    args = parser.parse_args()
    state = WebState(args.output)
    session_id = secrets.token_urlsafe(32)
    csrf_token = secrets.token_urlsafe(32)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(state, session_id, csrf_token))
    url = f"http://127.0.0.1:{server.server_port}/"
    print("Canopy 다운로드 화면:", url, flush=True)
    print("저장 폴더:", state.output_dir, flush=True)
    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
