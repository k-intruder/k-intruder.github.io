"""Compute monthly KPIs for projects/parking-analysis/reports.json from the source xlsx.

Usage (from the repository root):
    python tools/parking_kpi.py "<9월 방문주차사용현황.xlsx>" [--exclude 2026-09-24:2026-09-27] [--slug 2026-09]

Two source formats are detected automatically:
  - monthly summary: 동 | 호 | 사용량 ("108 시간") | ...            (7·8월)
  - entry/exit log : 동 | 호 | 차량번호 | 입주민구분 | 입차일 | 출차일 | 시간  (9월~)
    Only 방문예약 rows count; durations are summed per 동·호.
    --exclude drops visits whose entry date falls in the range (e.g. a holiday special).

Prints the "kpi" JSON. With --slug it is written into reports.json directly.
Only aggregates leave this script; no household identifiers are stored.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path
import argparse
import json
import re
import statistics
import sys

import openpyxl

REPORTS = Path(__file__).resolve().parent.parent / "projects" / "parking-analysis" / "reports.json"
LIMIT = 80
# Upper bounds of the distribution bands in reports.json ("bands"); last band is > LIMIT.
BAND_EDGES = [10, 20, 40, 60, 80]
NEAR_EDGES = [(60, 70), (70, 80)]  # "80시간 근접": 60h 초과 ~ 80h 이하


def parse_minutes(text):
    text = str(text or "")
    days = re.search(r"(\d+)\s*일", text)
    hours = re.search(r"(\d+)\s*시간", text)
    minutes = re.search(r"(\d+)\s*분", text)
    return ((int(days.group(1)) * 1440 if days else 0) + (int(hours.group(1)) * 60 if hours else 0)
            + (int(minutes.group(1)) if minutes else 0))


def parse_range(text):
    start, end = (datetime.strptime(part, "%Y-%m-%d") for part in text.split(":"))
    return start, end + timedelta(days=1)


def household_hours(path, excludes):
    rows = list(openpyxl.load_workbook(path, read_only=True, data_only=True).active.iter_rows(values_only=True))
    header_index = next(i for i, row in enumerate(rows) if row and row[0] == "동")
    header = [str(cell or "").strip() for cell in rows[header_index]]
    body = rows[header_index + 1:]

    if "입차일" in header:
        col = {name: header.index(name) for name in ("동", "호", "입주민구분", "입차일", "시간")}
        totals = defaultdict(float)
        for row in body:
            if "방문예약" not in str(row[col["입주민구분"]] or ""):
                continue
            entry = datetime.strptime(str(row[col["입차일"]]), "%Y.%m.%d %H:%M")
            if any(start <= entry < end for start, end in excludes):
                continue
            totals[(row[col["동"]], row[col["호"]])] += parse_minutes(row[col["시간"]]) / 60
        return [hours for hours in totals.values() if hours > 0], "entry/exit log"

    usage = header.index("사용량")
    values = []
    for row in body:
        match = re.search(r"[\d.]+", str(row[usage] or ""))
        if row[0] and str(row[0]).endswith("동") and match:
            values.append(float(match.group()))
    return values, "monthly summary"


def kpis(hours):
    n = len(hours)
    over = [h for h in hours if h > LIMIT]
    bands, low = [], 0
    for edge in BAND_EDGES:
        bands.append(sum(1 for h in hours if low < h <= edge))
        low = edge
    bands.append(len(over))
    return {
        "households": n,
        "totalHours": round(sum(hours), 1),
        "mean": round(sum(hours) / n, 2),
        "median": round(statistics.median(hours), 2),
        "over80": len(over),
        "overRate": round(len(over) / n * 100, 2),
        "max": round(max(hours), 1),
        "bands": bands,
        "near80": [sum(1 for h in hours if lo < h <= hi) for lo, hi in NEAR_EDGES],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path)
    parser.add_argument("--exclude", action="append", default=[], help="YYYY-MM-DD:YYYY-MM-DD (inclusive)")
    parser.add_argument("--slug", help="write the result into this reports.json entry")
    args = parser.parse_args()

    hours, kind = household_hours(args.source, [parse_range(r) for r in args.exclude])
    result = kpis(hours)
    print(f"# {args.source.name} ({kind})", file=sys.stderr)
    print(json.dumps(result, ensure_ascii=False))

    if args.slug:
        manifest = json.loads(REPORTS.read_text(encoding="utf-8"))
        entry = next((r for r in manifest["reports"] if r["slug"] == args.slug), None)
        if entry is None:
            sys.exit(f"{args.slug} is not in reports.json; import the dashboard first.")
        entry["kpi"] = result
        REPORTS.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"# updated {args.slug} in reports.json", file=sys.stderr)


if __name__ == "__main__":
    main()
