"""Import a parking dashboard HTML into projects/parking-analysis/.

Usage (from the repository root):
    python tools/add_parking_report.py <source.html> <slug> --title "2026년 10월" [--type monthly|special] [--period "..."]

What it does
  1. Anonymizes embedded JSON data arrays (`NAME=[{...}, ...]`):
       - objects with a "unit" (호수) get a random id; unit/label become "익명 NNN"
       - identifying keys (floor, car, plate, ...) are removed
     The whole repo is public, so this must happen before the file is committed,
     no matter what the project's visibility is.
  2. Replaces an inlined plotly.js bundle with the matching CDN script (~4.8MB -> ~50KB).
  3. Injects the visibility guard and a navigation bar back to the project.
  4. Refuses to write if anything that looks like a 동·호수 or plate number remains
     (override with --allow-leaks after checking manually).
  5. Adds/updates the entry in reports.json (existing "kpi" values are kept).
"""
from html import escape
from pathlib import Path
import argparse
import json
import random
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
PROJECT = ROOT / "projects" / "parking-analysis"
PROJECT_ID = "parking-analysis"
SENSITIVE_KEYS = {"floor", "car", "carNo", "car_no", "plate", "phone", "tel", "name", "owner", "contact"}

ARRAY_START = re.compile(r"\b[A-Za-z_$][\w$]*\s*=\s*(?=\[\s*\{)")
INLINE_PLOTLY = re.compile(r"<script>\s*/\*\*\s*\*\s*plotly\.js v([\d.]+).*?</script>", re.S)
LEAK_PATTERNS = {
    "동·호수": re.compile(r"\d{3}\s*동\s*\d{3,4}\s*호"),
    "호수 값": re.compile(r"\"\d{3,4}호\""),
    "차량번호": re.compile(r"\d{2,3}\s?[가-힣]\s?\d{4}"),
}

NAV = """
<nav class="report-nav" style="position:sticky;top:0;z-index:9999;display:flex;gap:10px;align-items:center;flex-wrap:wrap;
  padding:10px 16px;background:#0f172a;color:#e2e8f0;font:600 13px/1.4 system-ui,'Malgun Gothic',sans-serif">
  <a href="../../../" style="color:#94a3b8;text-decoration:none">Portfolio</a><span aria-hidden="true">/</span>
  <a href="../" style="color:#5eead4;text-decoration:none">방문차량 주차 분석</a><span aria-hidden="true">/</span>
  <span>{title}</span>
</nav>
"""


def anonymize_records(records, stats):
    has_unit = any(isinstance(r, dict) and "unit" in r for r in records)
    ids = list(range(1, len(records) + 1))
    random.shuffle(ids)
    for record, new_id in zip(records, ids):
        if not isinstance(record, dict):
            continue
        for key in SENSITIVE_KEYS & record.keys():
            del record[key]
            stats["removed_keys"] += 1
        if has_unit:
            anon = f"익명 {new_id:03d}"
            if "id" in record:
                record["id"] = new_id
            record["unit"] = anon
            if "label" in record:
                record["label"] = f"{record.get('building', '')} {anon}".strip()
            stats["anonymized"] += 1
    if has_unit:
        # Original order follows unit numbers; re-sort so position reveals nothing.
        records.sort(key=lambda r: (str(r.get("building", "")), r.get("id", 0)) if isinstance(r, dict) else ("", 0))
    return records


def anonymize_arrays(html, stats):
    decoder = json.JSONDecoder()
    out, pos = [], 0
    for match in ARRAY_START.finditer(html):
        start = match.end()
        if start < pos:
            continue
        try:
            value, end = decoder.raw_decode(html, start)
        except json.JSONDecodeError:
            continue
        if not (isinstance(value, list) and value and all(isinstance(v, dict) for v in value)):
            continue
        out.append(html[pos:start])
        out.append(json.dumps(anonymize_records(value, stats), ensure_ascii=False, separators=(", ", ": ")))
        pos = end
        stats["arrays"] += 1
    out.append(html[pos:])
    return "".join(out)


def find_leaks(html):
    leaks = []
    for label, pattern in LEAK_PATTERNS.items():
        for m in pattern.finditer(html):
            leaks.append(f"{label}: {html[max(0, m.start() - 30):m.end() + 30]!r}")
    return leaks


def update_manifest(slug, title, kind, period, filename):
    manifest_path = PROJECT / "reports.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    entry = next((r for r in manifest["reports"] if r["slug"] == slug), None)
    if entry is None:
        entry = {"slug": slug, "kpi": None}
        manifest["reports"].append(entry)
    entry.update({"title": title, "type": kind, "file": f"reports/{filename}"})
    if period:
        entry["period"] = period
    manifest["reports"].sort(key=lambda r: r["slug"])
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return entry


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path)
    parser.add_argument("slug", help="e.g. 2026-10 or 2026-chuseok")
    parser.add_argument("--title", required=True)
    parser.add_argument("--type", dest="kind", choices=["monthly", "special"], default="monthly")
    parser.add_argument("--period")
    parser.add_argument("--allow-leaks", action="store_true")
    args = parser.parse_args()

    html = args.source.read_text(encoding="utf-8")
    stats = {"arrays": 0, "anonymized": 0, "removed_keys": 0}

    html = anonymize_arrays(html, stats)
    html, plotly_count = INLINE_PLOTLY.subn(
        lambda m: f'<script src="https://cdn.plot.ly/plotly-{m.group(1)}.min.js"></script>', html)

    guard = f'\n<script src="../../../assets/auth.js" data-guard="{PROJECT_ID}"></script>'
    nav = NAV.replace("{title}", escape(args.title))
    html = re.sub(r"<head[^>]*>", lambda m: m.group(0) + guard, html, count=1)
    html = re.sub(r"<body[^>]*>", lambda m: m.group(0) + nav, html, count=1)

    leaks = find_leaks(html)
    if leaks and not args.allow_leaks:
        print("Possible identifying data remains; nothing written:", *leaks[:20], sep="\n  ")
        sys.exit(1)

    filename = f"{args.slug}.html"
    target = PROJECT / "reports" / filename
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(html, encoding="utf-8")
    entry = update_manifest(args.slug, args.title, args.kind, args.period, filename)

    print(f"Wrote {target.relative_to(ROOT)} ({target.stat().st_size / 1024:.0f} KB)")
    print(f"  data arrays: {stats['arrays']}, anonymized records: {stats['anonymized']}, "
          f"removed fields: {stats['removed_keys']}, inline plotly replaced: {plotly_count}")
    if args.kind == "monthly" and not entry.get("kpi"):
        print(f"  reports.json: fill in \"kpi\" for {args.slug} so the trend charts include it.")


if __name__ == "__main__":
    main()
