"""
Generates a self-contained HTML dashboard from campaign data.
Run: python3 build_dashboard.py
Opens: dashboard.html in your browser.
"""

import pandas as pd
import json
import os
import webbrowser
from collections import defaultdict

CSV_PATH   = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/automation_ready.csv"
OUTPUT     = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/dashboard.html"

# ── Load data ─────────────────────────────────────────────────────────────────
df = pd.read_csv(CSV_PATH)
for col in ["purchase_propensity","balance_pct","frustration_index",
            "escalation_level","total_spend_usd"]:
    if col in df.columns:
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

# ── KPIs ──────────────────────────────────────────────────────────────────────
total_players  = len(df)
sent           = int((df["escalation_level"] >= 2).sum())
high_risk      = int((df["escalation_level"] >= 4).sum())
total_rev_risk = round(df["total_spend_usd"].sum(), 0)
avg_propensity = round(df["purchase_propensity"].mean(), 3)
payers         = int((df["total_spend_usd"] > 0).sum())

# ── Player type breakdown ──────────────────────────────────────────────────────
type_counts = df["player_type"].value_counts().to_dict() if "player_type" in df.columns else {}

TYPE_COLORS = {
    "Active Payer":            "#00a040",
    "Revenue Churning Payer":  "#cc0000",
    "Lapsed Payer":            "#880000",
    "F2P Active":              "#0070c0",
    "F2P Lapsing":             "#ff8c00",
    "Non-entrant":             "#888888",
}

# ── Offer distribution ────────────────────────────────────────────────────────
offer_counts = df["offer_type"].value_counts().to_dict() if "offer_type" in df.columns else {}

OFFER_COLORS = {
    "PURCHASE_OFFER":          "#00b050",
    "BROKE_OFFER":             "#cc0000",
    "CONSOLATION_THEN_OFFER":  "#ff8c00",
    "WIN_BACK":                "#7030a0",
    "VIP_TEASER":              "#ffd700",
    "NONE":                    "#cccccc",
}

# ── Propensity distribution ───────────────────────────────────────────────────
bins   = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
labels = ["0-20%","20-40%","40-60%","60-80%","80-100%"]
prop_dist = pd.cut(df["purchase_propensity"], bins=bins, labels=labels).value_counts().sort_index().to_dict()

# ── Escalation funnel ─────────────────────────────────────────────────────────
esc_counts = df["escalation_level"].value_counts().sort_index().to_dict()

# ── Top at-risk players table ─────────────────────────────────────────────────
top_cols = [c for c in ["player_id","player_type","offer_type","purchase_propensity",
                         "escalation_level","balance_pct","frustration_index",
                         "total_spend_usd","trigger_channel"] if c in df.columns]
top_players = (df.sort_values("escalation_level", ascending=False)
                 .head(20)[top_cols]
                 .fillna("")
                 .to_dict(orient="records"))

# ── Chip state breakdown ──────────────────────────────────────────────────────
mon_counts = df["monetization_state"].value_counts().to_dict() if "monetization_state" in df.columns else {}

STATE_COLORS = {
    "Broke — High Purchase Intent":      "#cc0000",
    "Frustrated — Console Before Offer": "#ff8c00",
    "Purchase Window — Optimal":         "#00b050",
    "Non-Entrant — Re-engage First":     "#888888",
    "Not Ready — Full Balance":          "#aaaaaa",
    "Monitor":                           "#dddddd",
}

# ── Serialize for JS ──────────────────────────────────────────────────────────
def jss(obj): return json.dumps(obj, ensure_ascii=False)

html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CRM Dashboard — Huuuge Casino</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
  * {{ margin:0; padding:0; box-sizing:border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background:#0f1117; color:#e8eaf0; min-height:100vh; }}

  header {{ background:linear-gradient(135deg,#1a237e,#283593);
            padding:24px 32px; border-bottom:2px solid #3949ab; }}
  header h1 {{ font-size:22px; font-weight:700; letter-spacing:.5px; }}
  header p  {{ font-size:13px; color:#9fa8da; margin-top:4px; }}

  .container {{ max-width:1400px; margin:0 auto; padding:24px 32px; }}

  /* KPI cards */
  .kpi-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
               gap:16px; margin-bottom:28px; }}
  .kpi {{ background:#1e2130; border-radius:12px; padding:20px 22px;
           border:1px solid #2a2d3e; }}
  .kpi .label {{ font-size:11px; color:#9fa8da; text-transform:uppercase;
                  letter-spacing:1px; margin-bottom:8px; }}
  .kpi .value {{ font-size:30px; font-weight:700; line-height:1; }}
  .kpi .sub   {{ font-size:11px; color:#616880; margin-top:6px; }}
  .kpi.red    {{ border-color:#cc0000; }}
  .kpi.green  {{ border-color:#00b050; }}
  .kpi.gold   {{ border-color:#ffd700; }}

  /* Charts grid */
  .charts-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:28px; }}
  .charts-grid-3 {{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:20px; margin-bottom:28px; }}
  @media(max-width:900px) {{ .charts-grid,.charts-grid-3 {{ grid-template-columns:1fr; }} }}

  .card {{ background:#1e2130; border-radius:12px; padding:20px;
            border:1px solid #2a2d3e; }}
  .card h3 {{ font-size:13px; color:#9fa8da; text-transform:uppercase;
               letter-spacing:1px; margin-bottom:16px; }}
  .chart-wrap {{ position:relative; height:240px; }}

  /* Table */
  .table-card {{ background:#1e2130; border-radius:12px; padding:20px;
                  border:1px solid #2a2d3e; margin-bottom:28px; overflow-x:auto; }}
  .table-card h3 {{ font-size:13px; color:#9fa8da; text-transform:uppercase;
                     letter-spacing:1px; margin-bottom:16px; }}
  table {{ width:100%; border-collapse:collapse; font-size:12px; }}
  th {{ background:#252840; color:#9fa8da; text-align:left; padding:10px 12px;
        font-size:11px; text-transform:uppercase; letter-spacing:.8px; }}
  td {{ padding:9px 12px; border-bottom:1px solid #252840; color:#c8ccd8; }}
  tr:hover td {{ background:#252840; }}

  /* Badges */
  .badge {{ display:inline-block; padding:3px 8px; border-radius:20px;
             font-size:10px; font-weight:600; letter-spacing:.5px; }}

  /* Escalation bar */
  .esc-bar {{ display:flex; align-items:center; gap:6px; }}
  .esc-dot {{ width:8px; height:8px; border-radius:50%; background:#555; }}
  .esc-dot.active {{ background:#ffd700; }}

  .section-title {{ font-size:15px; font-weight:600; color:#c8ccd8;
                     margin:28px 0 14px; border-left:3px solid #3949ab;
                     padding-left:10px; }}
</style>
</head>
<body>

<header>
  <h1>🎰 CRM Automation Dashboard — Huuuge Casino</h1>
  <p>Segment: {total_players:,} players &nbsp;·&nbsp; Run date: 2026-05-28 &nbsp;·&nbsp; Mock mode</p>
</header>

<div class="container">

  <!-- KPIs -->
  <div class="kpi-grid" style="margin-top:24px;">
    <div class="kpi">
      <div class="label">Total Players</div>
      <div class="value">{total_players:,}</div>
      <div class="sub">active in dataset</div>
    </div>
    <div class="kpi green">
      <div class="label">Sent This Run</div>
      <div class="value">{sent:,}</div>
      <div class="sub">escalation ≥ 2</div>
    </div>
    <div class="kpi red">
      <div class="label">High Risk Players</div>
      <div class="value">{high_risk:,}</div>
      <div class="sub">escalation 4-5 🔴</div>
    </div>
    <div class="kpi">
      <div class="label">Paying Players</div>
      <div class="value">{payers:,}</div>
      <div class="sub">{payers/total_players*100:.0f}% of base</div>
    </div>
    <div class="kpi gold">
      <div class="label">Revenue at Risk</div>
      <div class="value">${total_rev_risk:,.0f}</div>
      <div class="sub">total spend at risk</div>
    </div>
    <div class="kpi">
      <div class="label">Avg Propensity</div>
      <div class="value">{avg_propensity:.2f}</div>
      <div class="sub">purchase score 0-1</div>
    </div>
  </div>

  <div class="section-title">Player Segments</div>
  <div class="charts-grid">
    <div class="card">
      <h3>Player Type Distribution</h3>
      <div class="chart-wrap"><canvas id="typeChart"></canvas></div>
    </div>
    <div class="card">
      <h3>Offer Type Distribution</h3>
      <div class="chart-wrap"><canvas id="offerChart"></canvas></div>
    </div>
  </div>

  <div class="section-title">Chip Economy & Monetization</div>
  <div class="charts-grid">
    <div class="card">
      <h3>Monetization State</h3>
      <div class="chart-wrap"><canvas id="stateChart"></canvas></div>
    </div>
    <div class="card">
      <h3>Purchase Propensity Distribution</h3>
      <div class="chart-wrap"><canvas id="propChart"></canvas></div>
    </div>
  </div>

  <div class="section-title">Top 20 Priority Players</div>
  <div class="table-card">
    <h3>Highest Escalation — Action Required Now</h3>
    <table>
      <thead>
        <tr>
          <th>Player ID</th>
          <th>Type</th>
          <th>Offer</th>
          <th>Propensity</th>
          <th>Escalation</th>
          <th>Balance %</th>
          <th>Frustration</th>
          <th>Spend $</th>
          <th>Channel</th>
        </tr>
      </thead>
      <tbody id="playerTable"></tbody>
    </table>
  </div>

</div>

<script>
// ── Data ──────────────────────────────────────────────────────────────────────
const typeCounts  = {jss(type_counts)};
const offerCounts = {jss(offer_counts)};
const typeColors  = {jss(TYPE_COLORS)};
const offerColors = {jss(OFFER_COLORS)};
const stateCounts = {jss(mon_counts)};
const stateColors = {jss(STATE_COLORS)};
const propDist    = {jss({str(k): int(v) for k,v in prop_dist.items()})};
const topPlayers  = {jss(top_players)};

const DEFAULTS = ['#3949ab','#e53935','#43a047','#fb8c00','#8e24aa','#00acc1','#6d4c41'];

function getColors(keys, colorMap) {{
  return keys.map((k,i) => colorMap[k] || DEFAULTS[i % DEFAULTS.length]);
}}

Chart.defaults.color = '#9fa8da';
Chart.defaults.borderColor = '#2a2d3e';

// ── Player Type Chart ─────────────────────────────────────────────────────────
new Chart(document.getElementById('typeChart'), {{
  type: 'doughnut',
  data: {{
    labels: Object.keys(typeCounts),
    datasets: [{{ data: Object.values(typeCounts),
      backgroundColor: getColors(Object.keys(typeCounts), typeColors),
      borderWidth: 2, borderColor: '#1e2130' }}]
  }},
  options: {{ plugins: {{ legend: {{ position:'right', labels:{{ boxWidth:12, font:{{size:11}} }} }} }},
               maintainAspectRatio: false }}
}});

// ── Offer Type Chart ──────────────────────────────────────────────────────────
new Chart(document.getElementById('offerChart'), {{
  type: 'bar',
  data: {{
    labels: Object.keys(offerCounts),
    datasets: [{{ data: Object.values(offerCounts),
      backgroundColor: getColors(Object.keys(offerCounts), offerColors),
      borderRadius: 6, borderWidth: 0 }}]
  }},
  options: {{
    indexAxis: 'y', maintainAspectRatio: false,
    plugins: {{ legend: {{ display:false }} }},
    scales: {{ x: {{ grid:{{ color:'#252840' }} }}, y: {{ grid:{{ display:false }} }} }}
  }}
}});

// ── Monetization State Chart ──────────────────────────────────────────────────
new Chart(document.getElementById('stateChart'), {{
  type: 'doughnut',
  data: {{
    labels: Object.keys(stateCounts),
    datasets: [{{ data: Object.values(stateCounts),
      backgroundColor: getColors(Object.keys(stateCounts), stateColors),
      borderWidth: 2, borderColor: '#1e2130' }}]
  }},
  options: {{ plugins: {{ legend: {{ position:'right', labels:{{ boxWidth:12, font:{{size:10}} }} }} }},
               maintainAspectRatio: false }}
}});

// ── Propensity Distribution ───────────────────────────────────────────────────
new Chart(document.getElementById('propChart'), {{
  type: 'bar',
  data: {{
    labels: Object.keys(propDist),
    datasets: [{{ label: 'Players', data: Object.values(propDist),
      backgroundColor: ['#555','#888','#ff8c00','#00b050','#00e676'],
      borderRadius: 6, borderWidth: 0 }}]
  }},
  options: {{
    maintainAspectRatio: false,
    plugins: {{ legend:{{ display:false }} }},
    scales: {{ x:{{ grid:{{ display:false }} }}, y:{{ grid:{{ color:'#252840' }} }} }}
  }}
}});

// ── Player Table ──────────────────────────────────────────────────────────────
const TYPE_BADGE = {{
  'Active Payer':           '#00a040',
  'Revenue Churning Payer': '#cc0000',
  'Lapsed Payer':           '#880000',
  'F2P Active':             '#0070c0',
  'F2P Lapsing':            '#ff8c00',
  'Non-entrant':            '#666',
}};
const ESC_ICONS = ['','⚪','🟡','🟠','🔴','🔴'];

const tbody = document.getElementById('playerTable');
topPlayers.forEach(p => {{
  const esc = parseInt(p.escalation_level) || 0;
  const bg  = TYPE_BADGE[p.player_type] || '#555';
  const bal = parseFloat(p.balance_pct) || 0;
  const fri = parseFloat(p.frustration_index) || 0;
  const pp  = parseFloat(p.purchase_propensity) || 0;
  const sp  = parseFloat(p.total_spend_usd) || 0;

  tbody.innerHTML += `
    <tr>
      <td style="font-family:monospace;color:#7986cb">${{p.player_id}}</td>
      <td><span class="badge" style="background:${{bg}}20;color:${{bg}};border:1px solid ${{bg}}">${{p.player_type}}</span></td>
      <td style="font-size:11px;color:#aaa">${{p.offer_type}}</td>
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <div style="width:50px;height:6px;background:#252840;border-radius:3px">
            <div style="width:${{Math.round(pp*100)}}%;height:100%;background:${{pp>0.5?'#00b050':pp>0.25?'#ff8c00':'#cc0000'}};border-radius:3px"></div>
          </div>
          ${{(pp*100).toFixed(0)}}%
        </div>
      </td>
      <td>${{ESC_ICONS[esc] || ''}} ${{esc}}/5</td>
      <td style="color:${{bal<0.2?'#cc0000':bal<0.5?'#ff8c00':'#00b050'}}">${{(bal*100).toFixed(0)}}%</td>
      <td style="color:${{fri>0.7?'#cc0000':fri>0.4?'#ff8c00':'#888'}}">${{fri.toFixed(2)}}</td>
      <td style="color:${{sp>0?'#ffd700':'#555'}}">${{sp>0?'$'+sp.toFixed(0):'—'}}</td>
      <td style="font-size:11px;color:#aaa">${{p.trigger_channel||'—'}}</td>
    </tr>`;
}});
</script>
</body>
</html>"""

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write(html)

print(f"Dashboard built: {OUTPUT}")
webbrowser.open(f"file://{OUTPUT}")
