"""Download delivered assets for Canopy tasking STAC items (API v2)."""

import argparse
import csv
import getpass
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen


API_ROOT = "https://api.canopy.umbra.space"
SEARCH_URL = API_ROOT + "/v2/stac/search"
ITEM_URL = API_ROOT + "/v2/stac/collections/umbra-sar/items/"


def api_url(url):
    absolute = urljoin(API_ROOT, url)
    parsed = urlparse(absolute)
    if parsed.scheme != "https" or parsed.netloc != "api.canopy.umbra.space":
        raise ValueError("Canopy API 외부의 페이지 링크를 거부했습니다.")
    return absolute


class CanopyClient:
    def __init__(self, token):
        self.token = token

    def json(self, method, url, body=None):
        url = api_url(url)
        payload = json.dumps(body).encode("utf-8") if body is not None else None
        headers = {
            "Authorization": "Bearer " + self.token,
            "Accept": "application/geo+json, application/json",
        }
        if payload is not None:
            headers["Content-Type"] = "application/json"
        request = Request(url, data=payload, headers=headers, method=method)
        for attempt in range(3):
            try:
                with urlopen(request, timeout=60) as response:
                    return json.load(response)
            except HTTPError as exc:
                if exc.code == 401:
                    raise RuntimeError("Canopy 토큰이 만료되었거나 유효하지 않습니다 (HTTP 401).") from None
                if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                    raise RuntimeError(f"Canopy API 요청 실패 (HTTP {exc.code}).") from None
                retry_after = exc.headers.get("Retry-After", "")
                delay = min(30, int(retry_after)) if retry_after.isdigit() else 2 ** attempt
                time.sleep(delay)
            except URLError as exc:
                if attempt == 2:
                    raise RuntimeError("Canopy API 네트워크 연결에 실패했습니다.") from None
                time.sleep(2 ** attempt)


class SignedUrlExpired(RuntimeError):
    pass


def search_task_items(client, task_ids):
    """Follow STAC next links; return only items belonging to tasking IDs."""
    method, url, body = "POST", SEARCH_URL, {"collections": ["umbra-sar"], "limit": 100}
    seen_pages = set()
    seen_items = set()
    while True:
        url = api_url(url)
        page_key = (method, url, json.dumps(body, sort_keys=True))
        if page_key in seen_pages:
            raise RuntimeError("STAC 페이지 링크가 반복되어 검색을 중단했습니다.")
        seen_pages.add(page_key)
        page = client.json(method, url, body)
        if not isinstance(page.get("features"), list):
            raise RuntimeError("STAC 검색 응답에 features 목록이 없습니다.")
        for item in page["features"]:
            if not isinstance(item, dict):
                continue
            task_id = item.get("properties", {}).get("umbra:task_id")
            item_id = item.get("id")
            if task_id and item_id and (task_ids is None or task_id in task_ids) and item_id not in seen_items:
                seen_items.add(item_id)
                yield item
        next_link = next((link for link in page.get("links", []) if link.get("rel") == "next"), None)
        if not next_link:
            return
        url = api_url(next_link["href"])
        method = next_link.get("method", "GET").upper()
        if method not in ("GET", "POST"):
            raise ValueError("지원하지 않는 STAC 페이지 링크 방식입니다.")
        if method == "POST":
            next_body = next_link.get("body", body)
            if next_link.get("merge"):
                next_body = {**(body or {}), **next_body}
            body = next_body
        else:
            body = None


def safe_name(value):
    value = str(value)
    cleaned = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", value).strip(" .")
    cleaned = cleaned[:150] or "unnamed"
    digest = hashlib.sha256(value.encode("utf-8")).hexdigest()[:8]
    return digest + "_" + cleaned


def signed_url(asset):
    url = asset.get("alternate", {}).get("s3_signed", {}).get("href")
    if not isinstance(url, str) or urlparse(url).scheme != "https":
        raise ValueError("서명된 HTTPS 다운로드 URL이 없습니다.")
    return url


def stream_asset(url, target):
    """Use the signed URL without sending the Canopy bearer token."""
    part = target.with_name(target.name + ".part")
    try:
        request = Request(url, method="GET")
        with urlopen(request, timeout=120) as response, part.open("wb") as output:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                output.write(chunk)
            expected = response.headers.get("Content-Length") if hasattr(response, "headers") else None
        if expected is not None and part.stat().st_size != int(expected):
            raise RuntimeError("수신한 파일 크기가 Content-Length와 다릅니다.")
        os.replace(part, target)
    except HTTPError as exc:
        if exc.code == 403:
            raise SignedUrlExpired("서명 URL이 만료되었거나 접근할 수 없습니다.") from None
        raise RuntimeError(f"파일 다운로드 실패 (HTTP {exc.code}).") from None
    except URLError:
        raise RuntimeError("파일 다운로드 네트워크 연결에 실패했습니다.") from None
    finally:
        part.unlink(missing_ok=True)


def download_item(client, search_item, output_dir, asset_keys=None):
    task_id = str(search_item["properties"]["umbra:task_id"])
    item_id = str(search_item["id"])
    item_url = ITEM_URL + quote(item_id, safe="")
    item = client.json("GET", item_url)
    if item.get("properties", {}).get("umbra:task_id") != task_id:
        raise RuntimeError("STAC 항목의 Task ID가 검색 결과와 다릅니다.")
    assets = item.get("assets", {})
    if not isinstance(assets, dict) or not assets:
        raise RuntimeError("STAC 항목에 다운로드할 산출물이 없습니다.")
    if asset_keys is not None:
        missing = asset_keys - assets.keys()
        if missing:
            raise RuntimeError("선택한 산출물이 STAC 항목에 없습니다.")
        assets = {key: asset for key, asset in assets.items() if key in asset_keys}
    folder = output_dir / safe_name(task_id) / safe_name(item_id)
    folder.mkdir(parents=True, exist_ok=True)
    records = []
    for key, asset in assets.items():
        target = folder / safe_name(key)
        record = {"task_id": task_id, "item_id": item_id, "asset": key, "file": str(target), "status": ""}
        if target.is_file() and target.stat().st_size > 0:
            record["status"] = "skipped"
        else:
            try:
                try:
                    stream_asset(signed_url(asset), target)
                except SignedUrlExpired:
                    refreshed = client.json("GET", item_url)
                    fresh_asset = refreshed.get("assets", {}).get(key, {})
                    stream_asset(signed_url(fresh_asset), target)
                record["status"] = "downloaded"
            except Exception as exc:
                record["status"] = "failed"
                record["error"] = str(exc)
        records.append(record)
    return records


def main(argv=None):
    parser = argparse.ArgumentParser(description="Canopy 태스킹 산출물 일괄 다운로드")
    parser.add_argument("--output", type=Path, default=Path("downloads"), help="저장 폴더 (기본: downloads)")
    parser.add_argument("--task-id", action="append", default=[], help="특정 Task ID만 선택 (반복 가능)")
    parser.add_argument("--task-id-file", type=Path, help="Task ID를 한 줄에 하나씩 적은 텍스트 파일")
    args = parser.parse_args(argv)
    token = os.environ.get("CANOPY_ACCESS_TOKEN", "").strip()
    if not token and sys.stdin.isatty():
        token = getpass.getpass("Canopy access token: ").strip()
    if not token:
        parser.error("실행 시 Canopy 토큰을 입력하거나 CANOPY_ACCESS_TOKEN 환경 변수를 설정하세요.")
    task_ids = set(args.task_id)
    if args.task_id_file:
        task_ids.update(line.strip() for line in args.task_id_file.read_text(encoding="utf-8").splitlines() if line.strip())
    selected = task_ids if task_ids else None
    client = CanopyClient(token)
    records = []
    item_count = 0
    search_failed = False
    try:
        for item in search_task_items(client, selected):
            item_count += 1
            print(f"항목 {item_count}: Task {item['properties']['umbra:task_id']} / STAC {item['id']}", flush=True)
            try:
                records.extend(download_item(client, item, args.output))
            except Exception as exc:
                records.append({"task_id": item["properties"]["umbra:task_id"], "item_id": item["id"], "asset": "", "file": "", "status": "failed", "error": str(exc)})
    except Exception as exc:
        print(f"검색 중단: {exc}", file=sys.stderr)
        search_failed = True
    args.output.mkdir(parents=True, exist_ok=True)
    report = args.output / "manifest.csv"
    with report.open("w", newline="", encoding="utf-8-sig") as output:
        writer = csv.DictWriter(output, fieldnames=["task_id", "item_id", "asset", "file", "status", "error"])
        writer.writeheader()
        writer.writerows(records)
    counts = {status: sum(record["status"] == status for record in records) for status in ("downloaded", "skipped", "failed")}
    print(f"STAC 항목 {item_count}건, 파일 다운로드 {counts['downloaded']}건, 기존 파일 {counts['skipped']}건, 실패 {counts['failed']}건")
    print(f"결과 목록: {report.resolve()}")
    return 1 if search_failed or counts["failed"] else 0


if __name__ == "__main__":
    sys.exit(main())
