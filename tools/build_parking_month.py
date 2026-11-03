"""Build a monthly parking dashboard from the raw entry/exit log and add it to the project.

Usage (from the repository root):
    python tools/build_parking_month.py "<10월 입출차기록.xlsx>" 2026-10 --title "2026년 10월"
    python tools/build_parking_month.py "<log.xlsx>" 2027-02 --title "2027년 2월" --exclude 2027-02-06:2027-02-09

Steps
  1. Aggregates 방문예약 rows per 동·호 the same way as tools/parking_kpi.py (hours > 0 kept).
  2. Writes a dashboard comparing every earlier monthly report in reports.json with this month.
     Households appear only as 동 + random 익명 number; no 호수 or 차량번호 is written.
  3. Runs the generated page through tools/add_parking_report.py (guard, nav, leak check)
     and stores the KPIs in reports.json via tools/parking_kpi.py.
"""
from collections import Counter, defaultdict
from datetime import date, datetime
from html import escape
from pathlib import Path
import argparse
import json
import random
import statistics
import subprocess
import sys
import tempfile

sys.path.insert(0, str(Path(__file__).resolve().parent))
import unit_vault  # noqa: E402

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
from parking_kpi import LIMIT, REPORTS, kpis, parse_minutes, parse_range  # noqa: E402

TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
# 입차 시각 구분 (시작 시 포함, 끝 시 미포함): 오전 06:00~11:59 · 오후 12:00~17:59 · 저녁 18:00~23:59 · 새벽 00:00~05:59
PERIODS = [("오전", 6, 12), ("오후", 12, 18), ("저녁", 18, 24), ("새벽", 0, 6)]


def period_range(start, end):
    return f"{start:02d}:00~{end - 1:02d}:59"


def period_of(hour):
    return next(name for name, start, end in PERIODS if start <= hour < end)
WEEKDAYS = "월화수목금토일"


def load_log(path, excludes):
    rows = list(openpyxl.load_workbook(path, read_only=True, data_only=True).active.iter_rows(values_only=True))
    header_index = next(i for i, row in enumerate(rows) if row and row[0] == "동")
    header = [str(cell or "").strip() for cell in rows[header_index]]
    if "입차일" not in header:
        sys.exit("입·출차 원자료(동 | 호 | 차량번호 | 입주민구분 | 입차일 | 출차일 | 시간) 형식이 아닙니다.")
    col = {name: header.index(name) for name in ("동", "호", "입주민구분", "입차일", "시간")}
    plate_col = header.index("차량번호") if "차량번호" in header else None
    entries = []

    households = defaultdict(lambda: {"minutes": 0, "visits": 0})
    daily = defaultdict(Counter)
    open_visits = excluded = 0
    for row in rows[header_index + 1:]:
        if not row or not row[col["입차일"]]:
            continue
        entry = datetime.strptime(str(row[col["입차일"]]), "%Y.%m.%d %H:%M")
        if any(start <= entry < end for start, end in excludes):
            excluded += 1
            continue
        reserved = "방문예약" in str(row[col["입주민구분"]] or "")
        daily[entry.date()]["reserved" if reserved else "walkin"] += 1
        entries.append({"time": entry, "reserved": reserved, "building": str(row[col["동"]]),
                        "unit": str(row[col["호"]]), "minutes": parse_minutes(row[col["시간"]]),
                        "plate": str(row[plate_col]) if plate_col is not None else None})
        if not reserved:
            continue
        if str(row[col["시간"]] or "").strip() in ("", "-"):
            open_visits += 1
        stats = households[(str(row[col["동"]]), str(row[col["호"]]))]
        stats["minutes"] += parse_minutes(row[col["시간"]])
        stats["visits"] += 1

    records = [{"building": f"{b}동", "hours": round(s["minutes"] / 60, 2), "visits": s["visits"]}
               | {"realUnit": unit}
               for (b, unit), s in households.items() if s["minutes"] > 0]
    return records, daily, {"open": open_visits, "excluded": excluded, "entries": entries}


def building_stats(records):
    groups = defaultdict(list)
    for r in records:
        groups[r["building"]].append(r["hours"])
    order = sorted(groups, key=lambda b: (len(b), b))
    return [{"building": b, "households": len(groups[b]),
             "mean": round(sum(groups[b]) / len(groups[b]), 2),
             "median": round(statistics.median(groups[b]), 2),
             "over80": sum(1 for h in groups[b] if h > LIMIT),
             "overRate": round(sum(1 for h in groups[b] if h > LIMIT) / len(groups[b]) * 100, 2)}
            for b in order]


def short_month(title):
    return title.replace(f"{title[:4]}년 ", "") if title[:4].isdigit() else title


def delta(cur, prev, unit="", digits=1, lower_is_good=True):
    if prev is None:
        return ""
    diff = cur - prev
    if abs(diff) < 10 ** -digits / 2:
        return "전월과 같음"
    arrow = "▲" if diff > 0 else "▼"
    good = (diff < 0) == lower_is_good
    return (f'<span class="{"good" if good else "bad"}">전월 대비 {arrow} '
            f'{abs(diff):,.{digits}f}{unit}</span>')


def focus_day_section(entries, day, number, reveal_units, cells=None):
    """Extra section for one unusual day: hourly pattern and vehicles per 동·호.

    reveal_units=False (public page) shows 동 + random 익명 번호 only.
    reveal_units=True is for the local, never-committed copy.
    """
    same = [e for e in entries if e["time"].date() == day]
    if not same:
        sys.exit(f"{day} 입차 기록이 없습니다.")
    wd = WEEKDAYS[day.weekday()]
    other_days = sorted({e["time"].date() for e in entries
                         if e["time"].weekday() == day.weekday() and e["time"].date() != day})
    hourly = Counter(e["time"].hour for e in same)
    other_hourly = Counter(e["time"].hour for e in entries if e["time"].date() in other_days)
    reserved = [e for e in same if e["reserved"]]
    periods = PERIODS
    pnames = [p[0] for p in periods]
    day_period = Counter(period_of(e["time"].hour) for e in same)
    other_period = Counter(period_of(e["time"].hour) for e in entries if e["time"].date() in other_days)
    n_other = len(other_days) or 1

    units = defaultdict(lambda: {"plates": set(), "entries": 0, "minutes": 0, "first": None, "period": Counter()})
    for e in reserved:
        u = units[(e["building"], e["unit"])]
        u["plates"].add(e["plate"] or f"#{u['entries']}")
        u["entries"] += 1
        u["minutes"] += e["minutes"]
        u["period"][period_of(e["time"].hour)] += 1
        u["first"] = min(u["first"], e["time"]) if u["first"] else e["time"]
    num = lambda v: int(v) if v.isdigit() else 0  # noqa: E731
    rows = [{"building": b, "unit": unit, "vehicles": len(u["plates"]), "entries": u["entries"],
             "hours": u["minutes"] / 60, "first": u["first"], "period": u["period"]}
            for (b, unit), u in units.items()]
    rows.sort(key=lambda r: (-r["vehicles"], -r["entries"], num(r["building"]), num(r["unit"])))
    if not reveal_units:
        ids = random.sample(range(1, len(rows) + 1), len(rows))
        for r, new_id in zip(rows, ids):
            if cells is not None:
                cells[f"익명 {new_id:02d}"] = f'{r["unit"]}호'
            r["unit"] = f"익명 {new_id:02d}"

    total_vehicles = sum(r["vehicles"] for r in rows)
    other_avg = sum(other_hourly.values()) / n_other if other_days else 0
    peak_hour = max(hourly, key=hourly.get)
    peak_period = max(pnames, key=lambda p: day_period[p])
    multi = [r for r in rows if r["vehicles"] >= 3]
    dist_labels = ["1대", "2대", "3대", "4대", "5대 이상"]
    dist = [sum(1 for r in rows if min(r["vehicles"], 5) == i + 1) for i in range(5)]
    durations = sorted(e["minutes"] for e in reserved if e["minutes"] > 0)
    median_min = statistics.median(durations) if durations else 0
    period_text = " · ".join(f"{n} {period_range(s, e)}" for n, s, e in periods)

    data = {"hours": list(range(24)), "day": [hourly.get(h, 0) for h in range(24)],
            "other": [round(other_hourly.get(h, 0) / n_other, 2) for h in range(24)],
            "dist": dist, "distLabels": dist_labels,
            "periods": pnames, "periodDay": [day_period[p] for p in pnames],
            "periodOther": [round(other_period[p] / n_other, 1) for p in pnames],
            "periodReserved": [sum(1 for e in reserved if period_of(e["time"].hour) == p) for p in pnames]}
    label = f"{day.month}/{day.day}({wd})"
    cards = [
        ("당일 입차", f"{len(same)}건", f"다른 {wd}요일 평균 {other_avg:.1f}건" + (f" · {len(same) / other_avg:.1f}배" if other_avg else "")),
        ("방문예약 입차", f"{len(reserved)}건", f"현장입차 {len(same) - len(reserved)}건"),
        ("방문 세대 · 차량", f"{len(rows)}세대 · {total_vehicles}대", "방문예약, 세대별 차량번호 기준"),
        ("가장 많은 시간대", f"{peak_period} {day_period[peak_period]}건",
         f"{peak_hour}시대 {hourly[peak_hour]}건 ({hourly[peak_hour] / len(same) * 100:.0f}%)"),
        ("3대 이상 방문 세대", f"{len(multi)}세대", f"{sum(r['vehicles'] for r in multi)}대 방문"),
        ("체류시간 중앙값", f"{int(median_min // 60)}시간 {int(median_min % 60)}분", "방문예약 1건 기준"),
    ]
    card_html = "".join(f'<div class="kpi"><div class="l">{escape(l)}</div><div class="v">{escape(v)}</div>'
                        f'<div class="s">{escape(t)}</div></div>' for l, v, t in cards)
    period_cells = lambda c: "".join(f"<td>{c[p] or ''}</td>" for p in pnames)  # noqa: E731
    unit_attr = lambda r: "" if reveal_units else ' data-unit="' + escape(r["unit"]) + '"'  # noqa: E731
    table = "".join(
        f'<tr><td>{escape(r["building"])}동</td><td{unit_attr(r)}>{escape(r["unit"] + "호" if r["unit"].isdigit() else r["unit"])}</td>'
        f'<td><b>{r["vehicles"]}대</b></td><td>{r["entries"]}건</td>{period_cells(r["period"])}'
        f'<td>{r["first"]:%H:%M}</td><td>{r["hours"]:.1f}시간</td></tr>'
        for r in rows)
    total_period = Counter()
    for r in rows:
        total_period.update(r["period"])
    unit_head = "호수" if reveal_units else '<span data-reveal-text="호수">세대</span>'
    privacy = ("<b>내부용:</b> 동·호수가 그대로 표시된 자료입니다. 공개 저장소나 단체방에 올리지 마세요."
               if reveal_units else "기본은 무작위 익명 번호로 표시합니다. 상단 <b>호수 · 표시</b>를 고르고 소유자 비밀번호를 입력하면 실제 호수가 보입니다.")
    period_rows = "".join(
        f"<tr><td><b>{p}</b> ({period_range(s, e)})</td><td>{day_period[p]}건</td><td>{data['periodReserved'][i]}건</td>"
        f"<td>{other_period[p] / n_other:.1f}건</td>"
        f"<td>{(day_period[p] / (other_period[p] / n_other)) if other_period[p] else 0:.1f}배</td>"
        f"<td>{sum(1 for r in rows if r['period'][p])}세대</td></tr>"
        for i, (p, s, e) in enumerate(periods))

    html = f"""
<div class="section special-day"><h2>{number}. {escape(label)} 이례 방문 별도 분석</h2>
<p>{escape(label)}은 입차 {len(same)}건으로 이달 가장 많았고, {peak_period} 시간대(특히 {peak_hour}시대)에 입차가 몰렸습니다. 당일 방문예약 차량을 시간대와 세대별로 따로 정리합니다.</p>
<div class="kpis">{card_html}</div>
<div class="grid">
<div class="card wide"><h3>시간대별 입차: {escape(label)} vs 다른 {wd}요일 평균</h3>
<div class="hint">비교 대상 {len(other_days)}일 ({", ".join(f"{d.month}/{d.day}" for d in other_days)}) · 시간대 구분: {period_text}</div>
<div id="dayHourChart" class="chart"></div></div>
<div class="card"><h3>오전 · 오후 · 저녁 · 새벽 입차</h3><div id="dayPeriodChart" class="chart short"></div></div>
<div class="card"><h3>세대별 방문 차량 대수 분포</h3><div id="dayDistChart" class="chart short"></div></div>
<div class="card wide"><h3>시간대 요약</h3>
<table><thead><tr><th>시간대</th><th>당일 입차</th><th>방문예약</th><th>다른 {wd}요일 평균</th><th>평시 대비</th><th>방문 세대</th></tr></thead><tbody>{period_rows}</tbody></table></div>
</div>
<div class="card wide" style="margin-top:16px"><h3>{escape(label)} 동·{unit_head}별 방문 차량</h3>
<div class="notice" style="margin:8px 0 12px">{privacy}</div>
<div class="controls sort-controls"><label>정렬 <select id="daySort">
<option value="2:desc">방문 차량 많은 순</option><option value="0:asc">동·호수 순</option><option value="3:desc">입차 건수 많은 순</option>
{"".join(f'<option value="{4 + i}:desc">{p} 입차 많은 순</option>' for i, p in enumerate(pnames))}
<option value="{4 + len(pnames)}:asc">첫 입차 빠른 순</option><option value="{5 + len(pnames)}:desc">체류시간 긴 순</option></select></label>
<span class="hint">표 제목을 눌러도 정렬됩니다 (한 번 더 누르면 반대 순서).</span></div>
<div class="tablewrap" style="max-height:none"><table id="dayTable" class="sortable"><thead><tr><th>동</th><th>{unit_head}</th><th>방문 차량</th><th>입차 건수</th>{"".join(f"<th>{p}</th>" for p in pnames)}<th>첫 입차</th><th>체류시간 합계</th></tr></thead>
<tbody>{table}</tbody><tfoot><tr><th colspan="2">합계 {len(rows)}세대</th><th>{total_vehicles}대</th><th>{len(reserved)}건</th>{"".join(f"<th>{total_period[p]}</th>" for p in pnames)}<th colspan="2"></th></tr></tfoot></table></div>
<div class="hint" style="margin-top:8px">방문 차량은 같은 세대로 입차한 서로 다른 차량번호 수, 입차 건수와 시간대 칸은 재입차를 포함한 입차 기록 수입니다. 시간대는 입차 시각 기준({period_text})입니다. 현장입차 {len(same) - len(reserved)}건은 세대 정보가 없어 표에서 제외했습니다.</div>
</div></div>
"""
    js = f"""
const DAY={json.dumps(data, ensure_ascii=False)};
const PCOL={{'오전':'#f6c86b','오후':amber,'저녁':navy,'새벽':'#475569'}};
Plotly.newPlot('dayHourChart',[
 {{x:DAY.hours,y:DAY.day,type:'bar',name:'{label}',marker:{{color:DAY.hours.map(h=>PCOL[h<6?'새벽':h<12?'오전':h<18?'오후':'저녁'])}},hovertemplate:'%{{x}}시 %{{y}}건<extra></extra>'}},
 {{x:DAY.hours,y:DAY.other,type:'scatter',mode:'lines+markers',name:'다른 {wd}요일 평균',line:{{color:orange,width:2}},hovertemplate:'%{{x}}시 평균 %{{y:.1f}}건<extra></extra>'}}
],{{...base,margin:{{l:50,r:15,t:45,b:45}},xaxis:{{title:'입차 시각',dtick:1,ticksuffix:'시',range:[-0.5,23.5]}},yaxis:yax('입차 건수'),legend:{{orientation:'h',y:1.2,x:1,xanchor:'right'}},
 shapes:[6,12,18].map(h=>({{type:'line',x0:h-0.5,x1:h-0.5,yref:'paper',y0:0,y1:1,line:{{color:'#cbd5e1',dash:'dot'}}}})),
 annotations:[['새벽',2.5],['오전',8.5],['오후',14.5],['저녁',20.5]].map(([t,x])=>({{x,y:1,yref:'paper',text:t,showarrow:false,yanchor:'bottom',font:{{color:'#64748b'}}}}))}},cfg);
Plotly.newPlot('dayPeriodChart',[
 {{x:DAY.periods,y:DAY.periodDay,type:'bar',name:'{label}',marker:{{color:DAY.periods.map(p=>PCOL[p])}},text:DAY.periodDay.map(v=>v+'건'),textposition:'outside',cliponaxis:false}},
 {{x:DAY.periods,y:DAY.periodOther,type:'bar',name:'다른 {wd}요일 평균',marker:{{color:'#cbd5e1'}},text:DAY.periodOther.map(v=>v+'건'),textposition:'outside',cliponaxis:false}}
],{{...base,barmode:'group',margin:{{l:50,r:15,t:30,b:40}},yaxis:yax('입차 건수'),legend:{{orientation:'h',y:1.16}}}},cfg);
Plotly.newPlot('dayDistChart',[{{x:DAY.distLabels,y:DAY.dist,type:'bar',marker:{{color:DAY.dist.map((_,i)=>i>=2?orange:'#a9bfe0')}},
 text:DAY.dist.map(v=>v+'세대'),textposition:'outside',cliponaxis:false,hovertemplate:'%{{x}} %{{y}}세대<extra></extra>'}}],
 {{...base,margin:{{l:50,r:15,t:25,b:40}},yaxis:yax('세대수')}},cfg);
"""
    return html, js + SORT_JS


SORT_JS = r"""
(function(){
  const table=document.getElementById('dayTable'); if(!table) return;
  const body=table.tBodies[0], heads=[...table.tHead.rows[0].cells], select=document.getElementById('daySort');
  [...body.rows].forEach((tr,i)=>tr.dataset.order=i);
  const num=(t)=>{t=(t||'').trim(); const m=t.match(/^(\d{1,2}):(\d{2})$/); if(m) return +m[1]*60+ +m[2];
    const n=t.replace(/[^\d.]/g,''); return n?parseFloat(n):0;};
  const key=(tr,col)=>{const c=tr.cells, b=num(c[0].textContent), u=num(c[1].textContent);
    return col===0?[b,u]:col===1?[u,b]:[num(c[col].textContent)];};
  let state={col:2,dir:'desc'};
  function sort(col,dir){
    state={col,dir}; const sign=dir==='asc'?1:-1;
    const rows=[...body.rows].sort((a,b)=>{const ka=key(a,col), kb=key(b,col);
      for(let i=0;i<ka.length;i++){ if(ka[i]!==kb[i]) return (ka[i]-kb[i])*sign; }
      return a.dataset.order-b.dataset.order;});
    rows.forEach(r=>body.append(r));
    heads.forEach((h,i)=>{h.dataset.sort=i===col?dir:''; h.setAttribute('aria-sort',i===col?(dir==='asc'?'ascending':'descending'):'none');});
    const v=col+':'+dir; if(select) select.value=[...select.options].some(o=>o.value===v)?v:'';
  }
  heads.forEach((h,i)=>{h.tabIndex=0; h.addEventListener('click',()=>sort(i,state.col===i&&state.dir==='desc'?'asc':state.col===i?'desc':(i<2||i===heads.length-2?'asc':'desc')));
    h.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();h.click();}});});
  if(select) select.addEventListener('change',()=>{if(!select.value) return; const [c,d]=select.value.split(':'); sort(+c,d);});
  document.addEventListener('unitmask:change',()=>sort(state.col,state.dir));
  sort(2,'desc');
})();
"""


def render(title, basis, months, current, buildings, focus, daily, extra, bands, special=("", "")):
    cur, prev = current, (months[-2]["kpi"] if len(months) > 1 else None)
    k, label = cur["kpi"], short_month(title)
    month_names = [short_month(m["title"]) for m in months]
    near_total = sum(k["near80"])
    days = sorted(daily)
    weekday = defaultdict(list)
    for d in days:
        weekday[d.weekday()].append(daily[d]["reserved"] + daily[d]["walkin"])
    total_entries = sum(daily[d]["reserved"] + daily[d]["walkin"] for d in days)
    reserved_entries = sum(daily[d]["reserved"] for d in days)
    busiest = max(days, key=lambda d: daily[d]["reserved"] + daily[d]["walkin"])
    busiest_n = daily[busiest]["reserved"] + daily[busiest]["walkin"]
    top_band = max(range(len(k["bands"])), key=lambda i: k["bands"][i])

    data = {
        "months": [{"month": short_month(m["title"]), **m["kpi"]} for m in months],
        "bands": bands,
        "buildings": buildings,
        "daily": [{"date": d.isoformat(), "label": f"{d.month}/{d.day}({WEEKDAYS[d.weekday()]})",
                   "reserved": daily[d]["reserved"], "walkin": daily[d]["walkin"]} for d in days],
        "weekday": [{"day": WEEKDAYS[i], "avg": round(sum(v) / len(v), 1)} for i, v in sorted(weekday.items())],
    }

    over_rows = "".join(
        f'<tr class="{"over" if r["hours"] > LIMIT else "near"}"><td>{escape(r["building"])}</td>'
        f'<td data-unit="{escape(r["unit"])}">{escape(r["unit"])}</td><td>{r["hours"]:.1f}시간</td><td>{r["visits"]}회</td>'
        f'<td>{"초과 " + format(r["hours"] - LIMIT, ".1f") + "시간" if r["hours"] > LIMIT else "잔여 " + format(LIMIT - r["hours"], ".1f") + "시간"}</td></tr>'
        for r in focus) or '<tr><td colspan="5">해당 세대가 없습니다.</td></tr>'

    kpi_cards = [
        (f"{label} 이용 세대", f'{k["households"]:,}세대', delta(k["households"], prev and prev["households"], "세대", 0, False)),
        (f"{label} 총 이용시간", f'{k["totalHours"]:,.1f}h', delta(k["totalHours"], prev and prev["totalHours"], "h")),
        ("세대 평균", f'{k["mean"]:.1f}h', delta(k["mean"], prev and prev["mean"], "h")),
        ("중앙값", f'{k["median"]:.1f}h', delta(k["median"], prev and prev["median"], "h")),
        ("80시간 초과", f'{k["over80"]}세대 · {k["overRate"]:.1f}%', delta(k["over80"], prev and prev["over80"], "세대", 0)),
        ("80시간 근접 (60~80h)", f"{near_total}세대",
         delta(near_total, prev and prev.get("near80") and sum(prev["near80"]), "세대", 0)),
    ]
    kpi_html = "".join(f'<div class="kpi"><div class="l">{escape(l)}</div><div class="v">{v}</div>'
                       f'<div class="s">{s}</div></div>' for l, v, s in kpi_cards)

    over_text = (f"80시간을 넘긴 세대는 <b>{k['over80']}세대({k['overRate']:.1f}%)</b>, "
                 f"60~80시간 근접 세대는 <b>{near_total}세대</b>입니다.")
    trend_text = " → ".join(f"{n} {m['kpi']['over80']}" for n, m in zip(month_names, months))

    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{escape(title)} 방문차량 통계 대시보드</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<style>
:root{{--bg:#f4f6f9;--card:#fff;--ink:#172033;--muted:#64748b;--line:#e2e8f0;--navy:#173b70}}
*{{box-sizing:border-box}} body{{margin:0;font-family:Pretendard,"Noto Sans KR","Malgun Gothic",Arial,sans-serif;background:var(--bg);color:var(--ink)}}
.wrap{{max-width:1300px;margin:auto;padding:28px 20px 60px}} .hero{{background:linear-gradient(135deg,#173b70,#285ba6);color:#fff;padding:30px 32px;border-radius:22px}}
.hero h1{{margin:0 0 10px;font-size:30px}} .hero p{{margin:5px 0;color:#dbeafe;line-height:1.6}}
.notice{{margin:16px 0;padding:14px 16px;background:#fff7ed;border-left:4px solid #f59e0b;border-radius:10px;color:#7c2d12;line-height:1.65}}
.kpis{{display:grid;grid-template-columns:repeat(6,1fr);gap:12px;margin:18px 0 26px}} .kpi,.card{{background:#fff;border:1px solid var(--line);border-radius:16px;box-shadow:0 3px 12px rgba(15,23,42,.04)}}
.kpi{{padding:17px}} .kpi .l{{font-size:12px;color:var(--muted)}} .kpi .v{{font-size:23px;font-weight:800;margin-top:6px}} .kpi .s{{font-size:12px;color:var(--muted);margin-top:4px}}
.good{{color:#0f766e}} .bad{{color:#b45309}}
.section{{margin-top:28px}} .section h2{{margin:0 0 6px;font-size:22px}} .section>p{{margin:0 0 14px;color:var(--muted);line-height:1.65}}
.grid{{display:grid;grid-template-columns:1fr 1fr;gap:16px}} .card{{padding:18px}} .card.wide{{grid-column:1/-1}} .card h3{{margin:0 0 4px;font-size:17px}}
.hint{{color:var(--muted);font-size:12px}} .chart{{height:350px}} .chart.short{{height:300px}}
.insight{{margin-top:8px;padding:11px 13px;background:#f8fafc;border-radius:10px;line-height:1.6;color:#475569;font-size:14px}}
table{{width:100%;border-collapse:collapse;font-size:13px}} th,td{{padding:10px;border-bottom:1px solid var(--line);text-align:center}} th{{background:#f8fafc;position:sticky;top:0}}
tr.over td:nth-child(5){{color:#b45309;font-weight:700}} tr.near td:nth-child(5){{color:var(--muted)}}
.tablewrap{{max-height:520px;overflow:auto;border:1px solid var(--line);border-radius:12px}}
table.sortable th{{cursor:pointer;user-select:none;white-space:nowrap}} table.sortable th:hover{{background:#eef2f7}}
table.sortable th[data-sort=asc]::after{{content:" ▲";font-size:10px;color:var(--navy)}} table.sortable th[data-sort=desc]::after{{content:" ▼";font-size:10px;color:var(--navy)}}
.controls{{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:6px 0 10px;font-size:13px}} .controls select{{padding:5px 8px;border:1px solid var(--line);border-radius:8px;font:inherit;background:#fff}}
@media print{{.sort-controls{{display:none}}}}
.footer{{margin-top:26px;color:var(--muted);font-size:12px;line-height:1.7}}
@media(max-width:900px){{.kpis{{grid-template-columns:repeat(2,1fr)}}.grid{{grid-template-columns:1fr}}.card.wide{{grid-column:auto}}.hero{{padding:22px}}.hero h1{{font-size:24px}}}}
@media print{{body{{background:#fff}}.wrap{{max-width:none;padding:10mm}}.card,.kpi{{box-shadow:none}}.card{{break-inside:avoid}}.tablewrap{{max-height:none;overflow:visible}}thead{{display:table-header-group}}tr{{break-inside:avoid}}}}
</style></head><body>
<div class="wrap">
<div class="hero"><h1>{escape(title)} 방문차량 통계 대시보드</h1>
<p>세대별 방문예약 차량의 실제 체류시간을 합산하여 {escape(" · ".join(month_names))} 이용현황을 비교합니다.</p>
<p>집계 기준: {escape(basis)}</p></div>
<div class="notice"><b>집계 기준 안내:</b> {escape(label)} 통계는 입·출차 원자료에서 동·호가 확인되는 <b>방문예약 차량</b>의 체류시간만 세대별로 합산했습니다.
현장입차는 세대 귀속이 어려워 세대별 80시간 통계에서는 제외하고 일별 입차 현황에만 반영했습니다. 출차 기록이 없는 방문예약 {extra["open"]}건은 체류시간 0으로 계산됩니다.
7·8월은 시스템 월별 집계 자료 기준이라 원자료 기준(9월~)과 일부 차이가 있을 수 있습니다.</div>
<div class="kpis">{kpi_html}</div>

<div class="section"><h2>1. 월별 핵심지표 비교</h2><p>월별 운영 변화를 한눈에 볼 수 있도록 주요 지표를 비교합니다.</p><div class="grid">
<div class="card"><h3>이용 세대수</h3><div id="houseChart" class="chart short"></div></div>
<div class="card"><h3>총 이용시간</h3><div id="totalChart" class="chart short"></div></div>
<div class="card"><h3>세대 평균 · 중앙값</h3><div id="avgChart" class="chart short"></div></div>
<div class="card"><h3>80시간 초과 세대수 · 비율</h3><div id="overChart" class="chart short"></div></div>
</div>
<div class="insight">80시간 초과 세대는 {escape(trend_text)}세대로 바뀌었습니다. {over_text}</div></div>

<div class="section"><h2>2. 80시간 근접 세대 추이</h2><p>한도에 가까운 60~70시간, 70~80시간 구간과 초과 세대를 함께 봅니다.</p>
<div class="card wide"><h3>월별 근접 · 초과 세대</h3><div id="nearChart" class="chart"></div></div></div>

<div class="section"><h2>3. 이용시간 구간 분포 비교</h2><p>세대별 이용이 어느 시간대에 몰려 있는지 월별 비율로 비교합니다.</p>
<div class="card wide"><h3>세대 이용시간 구간 비율</h3><div id="bandChart" class="chart"></div>
<div class="insight">{escape(label)}은 <b>{escape(bands[top_band])}시간</b> 구간이 {k["bands"][top_band]}세대({k["bands"][top_band] / k["households"] * 100:.1f}%)로 가장 많습니다.</div></div></div>

<div class="section"><h2>4. {escape(label)} 일별 입차 현황</h2><p>방문예약과 현장입차를 포함한 모든 입차 기록입니다.</p><div class="grid">
<div class="card wide"><h3>일별 입차 건수</h3><div id="dailyChart" class="chart"></div>
<div class="insight">한 달 입차 <b>{total_entries:,}건</b>(일평균 {total_entries / len(days):.1f}건) 중 방문예약이 {reserved_entries / total_entries * 100:.1f}%입니다.
가장 많았던 날은 <b>{busiest.month}/{busiest.day}({WEEKDAYS[busiest.weekday()]}) {busiest_n}건</b>입니다.</div></div>
<div class="card wide"><h3>요일별 일평균 입차</h3><div id="weekdayChart" class="chart short"></div></div>
</div></div>

<div class="section"><h2>5. {escape(label)} 동별 이용현황</h2><p>동별 평균·중앙값과 80시간 초과율을 함께 확인합니다. 999동·9999동은 시스템에 등록된 기타 계정입니다.</p>
<div class="card wide"><h3>동별 평균 · 중앙값 · 80시간 초과율</h3><div id="buildingChart" class="chart"></div></div></div>

<div class="section"><h2>6. {escape(label)} 80시간 초과 · 근접 세대</h2><p>개인정보 보호를 위해 호수 대신 무작위 익명 번호로 표시합니다.</p>
<div class="card wide"><div class="tablewrap"><table><thead><tr><th>동</th><th data-reveal-text="호수">세대</th><th>이용시간</th><th>방문 횟수</th><th>80시간 대비</th></tr></thead>
<tbody>{over_rows}</tbody></table></div></div></div>

{special[0]}
<div class="footer">※ 방문예약 차량의 입·출차 기록상 체류시간을 세대별로 합산한 값이며, 관리 시스템의 월별 집계와는 산정 방식에 일부 차이가 있을 수 있습니다.<br>
※ 현장입차는 세대별 귀속이 명확하지 않아 세대별 80시간 분석에서 제외했습니다.{"<br>※ 제외 기간 입차 " + str(extra["excluded"]) + "건은 별도 특별판에서 분석합니다." if extra["excluded"] else ""}<br>
※ 생성일 {date.today().isoformat()}</div>
</div>
<script>
const DATA={json.dumps(data, ensure_ascii=False)};
const cfg={{responsive:true,displayModeBar:false}};
const base={{paper_bgcolor:'rgba(0,0,0,0)',plot_bgcolor:'rgba(0,0,0,0)',font:{{family:'Pretendard, Noto Sans KR, Malgun Gothic, sans-serif',color:'#334155'}},hoverlabel:{{font:{{family:'Pretendard, Noto Sans KR, sans-serif'}}}}}};
const grid='#e2e8f0', navy='#173b70', blue='#5b8bd0', amber='#d97706', orange='#c2410c', teal='#0f766e', slate='#94a3b8';
const M=DATA.months, ms=M.map(d=>d.month), last=ms.length-1;
const tone=ms.map((_,i)=>i===last?navy:'#a9bfe0');
const fmt=(v,d=1)=>v.toLocaleString('ko-KR',{{maximumFractionDigits:d}});
const yax=(t,extra={{}})=>({{title:t,rangemode:'tozero',gridcolor:grid,zeroline:false,...extra}});

Plotly.newPlot('houseChart',[{{x:ms,y:M.map(d=>d.households),type:'bar',marker:{{color:tone}},text:M.map(d=>d.households+'세대'),textposition:'outside',cliponaxis:false,hovertemplate:'%{{x}} %{{y}}세대<extra></extra>'}}],
 {{...base,margin:{{l:50,r:15,t:25,b:40}},yaxis:yax('세대수')}},cfg);
Plotly.newPlot('totalChart',[{{x:ms,y:M.map(d=>d.totalHours),type:'bar',marker:{{color:tone}},text:M.map(d=>fmt(d.totalHours)+'h'),textposition:'outside',cliponaxis:false,hovertemplate:'%{{x}} %{{y:,.1f}}h<extra></extra>'}}],
 {{...base,margin:{{l:60,r:15,t:25,b:40}},yaxis:yax('시간')}},cfg);
Plotly.newPlot('avgChart',[
 {{x:ms,y:M.map(d=>d.mean),type:'bar',name:'평균',marker:{{color:navy}},text:M.map(d=>fmt(d.mean)),textposition:'outside',cliponaxis:false}},
 {{x:ms,y:M.map(d=>d.median),type:'bar',name:'중앙값',marker:{{color:blue}},text:M.map(d=>fmt(d.median)),textposition:'outside',cliponaxis:false}}
],{{...base,barmode:'group',margin:{{l:50,r:15,t:30,b:40}},yaxis:yax('시간'),legend:{{orientation:'h',y:1.16}}}},cfg);
Plotly.newPlot('overChart',[{{x:ms,y:M.map(d=>d.over80),type:'bar',marker:{{color:ms.map((_,i)=>i===last?orange:'#f3c3a6')}},
 text:M.map(d=>d.over80+'세대 · '+fmt(d.overRate)+'%'),textposition:'outside',cliponaxis:false,hovertemplate:'%{{x}} %{{y}}세대<extra></extra>'}}],
 {{...base,margin:{{l:50,r:15,t:25,b:40}},yaxis:yax('세대수')}},cfg);

const N=M.filter(d=>d.near80);
Plotly.newPlot('nearChart',[
 {{x:N.map(d=>d.month),y:N.map(d=>d.near80[0]),type:'bar',name:'60~70시간',marker:{{color:'#f6c86b'}},text:N.map(d=>d.near80[0]),textposition:'inside'}},
 {{x:N.map(d=>d.month),y:N.map(d=>d.near80[1]),type:'bar',name:'70~80시간',marker:{{color:amber}},text:N.map(d=>d.near80[1]),textposition:'inside',insidetextfont:{{color:'#fff'}}}},
 {{x:N.map(d=>d.month),y:N.map(d=>d.over80),type:'bar',name:'80시간 초과',marker:{{color:orange}},text:N.map(d=>d.over80),textposition:'inside',insidetextfont:{{color:'#fff'}}}},
 {{x:N.map(d=>d.month),y:N.map(d=>d.near80[0]+d.near80[1]+d.over80),type:'scatter',mode:'text',text:N.map(d=>'60h 초과 '+(d.near80[0]+d.near80[1]+d.over80)+'세대'),textposition:'top center',showlegend:false,hoverinfo:'skip',cliponaxis:false}}
],{{...base,barmode:'stack',margin:{{l:50,r:15,t:30,b:40}},yaxis:yax('세대수'),legend:{{orientation:'h',y:1.12}},hovermode:'x unified'}},cfg);

Plotly.newPlot('bandChart',M.map((d,i)=>{{const t=d.bands.reduce((s,v)=>s+v,0);return {{x:DATA.bands,y:d.bands.map(v=>v/t*100),customdata:d.bands,type:'bar',name:d.month,
 marker:{{color:i===last?navy:['#dbe5f3','#bccfea','#9db8e0','#7ea1d6','#5f8acc'][i%5]}},hovertemplate:d.month+' %{{x}}<br>%{{y:.1f}}% (%{{customdata}}세대)<extra></extra>'}}}}),
 {{...base,barmode:'group',margin:{{l:55,r:15,t:30,b:50}},xaxis:{{title:'월 이용시간 구간(시간)'}},yaxis:yax('비율(%)'),legend:{{orientation:'h',y:1.12}}}},cfg);

const D=DATA.daily, weekend=D.map(d=>{{const w=new Date(d.date).getDay();return w===0||w===6}});
Plotly.newPlot('dailyChart',[
 {{x:D.map(d=>d.label),y:D.map(d=>d.reserved),type:'bar',name:'방문예약',marker:{{color:D.map((_,i)=>weekend[i]?'#0b2a52':navy)}}}},
 {{x:D.map(d=>d.label),y:D.map(d=>d.walkin),type:'bar',name:'현장입차',marker:{{color:slate}}}}
],{{...base,barmode:'stack',margin:{{l:50,r:15,t:30,b:70}},xaxis:{{tickangle:-60,tickfont:{{size:10}}}},yaxis:yax('입차 건수'),legend:{{orientation:'h',y:1.12}},hovermode:'x unified'}},cfg);
Plotly.newPlot('weekdayChart',[{{x:DATA.weekday.map(d=>d.day),y:DATA.weekday.map(d=>d.avg),type:'bar',marker:{{color:DATA.weekday.map(d=>d.day==='토'||d.day==='일'?navy:blue)}},
 text:DATA.weekday.map(d=>fmt(d.avg)+'건'),textposition:'outside',cliponaxis:false,hovertemplate:'%{{x}}요일 평균 %{{y}}건<extra></extra>'}}],
 {{...base,margin:{{l:50,r:15,t:25,b:40}},yaxis:yax('일평균 입차')}},cfg);

const B=DATA.buildings;
Plotly.newPlot('buildingChart',[
 {{x:B.map(d=>d.building),y:B.map(d=>d.mean),type:'bar',name:'평균',marker:{{color:navy}},customdata:B.map(d=>d.households),hovertemplate:'%{{x}} 평균 %{{y:.1f}}h (%{{customdata}}세대)<extra></extra>'}},
 {{x:B.map(d=>d.building),y:B.map(d=>d.median),type:'bar',name:'중앙값',marker:{{color:blue}},hovertemplate:'%{{x}} 중앙값 %{{y:.1f}}h<extra></extra>'}},
 {{x:B.map(d=>d.building),y:B.map(d=>d.overRate),type:'scatter',mode:'lines+markers',name:'80시간 초과율',yaxis:'y2',line:{{color:orange,width:2}},hovertemplate:'%{{x}} 초과율 %{{y:.1f}}%<extra></extra>'}}
],{{...base,barmode:'group',margin:{{l:55,r:60,t:30,b:45}},yaxis:yax('시간'),yaxis2:{{title:'초과율(%)',overlaying:'y',side:'right',rangemode:'tozero',showgrid:false}},legend:{{orientation:'h',y:1.12}}}},cfg);
{special[1]}</script></body></html>
"""


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("source", type=Path)
    parser.add_argument("slug", help="e.g. 2026-10")
    parser.add_argument("--title", required=True, help='e.g. "2026년 10월"')
    parser.add_argument("--exclude", action="append", default=[], help="YYYY-MM-DD:YYYY-MM-DD (inclusive)")
    parser.add_argument("--basis", help="text for reports.json 'basis'")
    parser.add_argument("--focus-day", type=date.fromisoformat, help="YYYY-MM-DD: add a separate analysis of this day")
    parser.add_argument("--private-out", type=Path,
                        help="also write a local copy whose focus-day table shows real 동·호수 (never commit it)")
    args = parser.parse_args()

    records, daily, extra = load_log(args.source, [parse_range(r) for r in args.exclude])
    if not records:
        sys.exit("방문예약 기록이 없습니다.")
    hours = [r["hours"] for r in records]
    kpi = kpis(hours)

    manifest = json.loads(REPORTS.read_text(encoding="utf-8"))
    previous = [r for r in manifest["reports"]
                if r["type"] == "monthly" and r.get("kpi") and r["slug"] < args.slug]
    current = {"slug": args.slug, "title": args.title, "kpi": kpi}
    months = previous + [current]

    basis = args.basis or "입·출차 원자료 (방문예약" + (
        ", " + ", ".join(e.replace("-", ".")[5:].replace(":", "~") for e in args.exclude) + " 제외" if args.exclude else "") + ")"

    ids = random.sample(range(1, len(records) + 1), len(records))
    cells = {}
    for record, new_id in zip(records, ids):
        record["unit"] = f"익명 {new_id:03d}"
        cells[record["unit"]] = f'{record.pop("realUnit")}호'

    focus = sorted((r for r in records if r["hours"] > 60), key=lambda r: -r["hours"])

    common = (args.title, basis, months, current, building_stats(records), focus, daily, extra, manifest["bands"])
    number = 7
    html = render(*common, special=focus_day_section(extra["entries"], args.focus_day, number, False, cells)
                  if args.focus_day else ("", ""))
    if unit_vault.available():
        used = {k: v for k, v in cells.items() if f'data-unit="{k}"' in html}
        html = html.replace("</body>", unit_vault.vault_tag({"cells": used}) + "\n</body>", 1)
    else:
        print("note: data/unit_key.json 없음 → 호수 표시 기능 없이 익명만 저장합니다 (python tools/unit_vault.py setup).")
    if args.private_out:
        if not args.focus_day:
            sys.exit("--private-out needs --focus-day")
        if ROOT.resolve() in args.private_out.resolve().parents:
            sys.exit("--private-out must be outside the repository (it contains 동·호수).")
        private = render(*common, special=focus_day_section(extra["entries"], args.focus_day, number, True))
        private = private.replace("<title>", "<title>[내부용] ", 1)
        args.private_out.write_text(private, encoding="utf-8")
        print(f"Wrote private copy {args.private_out}")

    with tempfile.TemporaryDirectory() as tmp:
        page = Path(tmp) / f"{args.slug}.html"
        page.write_text(html, encoding="utf-8")
        subprocess.run([sys.executable, str(TOOLS / "add_parking_report.py"), str(page), args.slug,
                        "--title", args.title], check=True)

    manifest = json.loads(REPORTS.read_text(encoding="utf-8"))
    entry = next(r for r in manifest["reports"] if r["slug"] == args.slug)
    entry["kpi"] = kpi
    entry["basis"] = basis
    entry.setdefault("published", date.today().isoformat())
    REPORTS.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(f"KPI {args.slug}: {json.dumps(kpi, ensure_ascii=False)}")
    print(f"  출차 미확인 방문예약 {extra['open']}건, 제외 기간 입차 {extra['excluded']}건")


if __name__ == "__main__":
    main()
