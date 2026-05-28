# Gaming CRM Automation Toolkit

AI-powered CRM & retention automation system built for mobile/social casino games (Huuuge Casino model).  
Covers the full lifecycle: segmentation → churn prediction → chip economy scoring → campaign automation → A/B testing.

---

## What This Does

A retention manager's daily toolkit — runs automatically, outputs actionable segments and campaign-ready data.

```
Player Data
    ↓
RFM Segmentation       → who are they?
    ↓
Churn Prediction       → who is about to leave?
    ↓
Chip Economy Model     → when are they ready to buy?
    ↓
Campaign Automation    → what do we send, to whom, on which channel?
    ↓
A/B Testing            → which message wins?
    ↓
Google Sheets Dashboard + HTML Dashboard
```

---

## Modules

| File | What it does |
|------|-------------|
| `rfm_google_sheets.py` | Generates 1,000 synthetic players + RFM segmentation → Google Sheets |
| `churn_model.py` | Personalized churn detection based on each player's own login cadence |
| `chip_economy.py` | Chip balance scoring + purchase propensity + monetization state per player |
| `braze_client.py` | Braze API wrapper — mock mode by default, production-ready with API key |
| `ab_test_tracker.py` | Deterministic A/B variant assignment + statistical validity checks |
| `results_simulator.py` | Simulates open/click/conversion rates based on propensity scores |
| `run_campaigns.py` | Main runner — orchestrates everything end to end |
| `build_dashboard.py` | Generates self-contained HTML dashboard |

---

## Key Concepts

### Personalized Churn Detection
Instead of a fixed "7 days inactive = churned" threshold, each player has their own cadence:

```
personal_cadence = 90 / sessions_last_90d
overdue_ratio    = days_since_last_activity / personal_cadence
```

A daily player is at risk after 2 days away.  
A weekly player is fine after 6 days away.  
Cold-start players (< 5 sessions) use the population p60 cadence as a benchmark.

### Chip Economy & Purchase Propensity
Purchase propensity peaks at 15–25% of a player's normal chip balance — not at zero.  
At zero chips, frustration is high and churn risk spikes. The consolation mechanic bridges this.

```
balance_pct 20–50% + moderate frustration → PURCHASE_OFFER
balance_pct < 10%  + high frustration     → CONSOLATION → then offer (30min delay)
balance_pct < 5%   + low frustration      → BROKE_OFFER (immediate)
balance_pct > 80%                         → VIP_TEASER (no monetization push)
```

### Six Player Types
```
Active Payer           → retain + upsell
Revenue Churning Payer → URGENT: still logging in but stopped buying
Lapsed Payer           → URGENT: was paying, now gone
F2P Active             → convert: first purchase offer
F2P Lapsing            → last window before full churn
Non-entrant            → win-back email series
```

### A/B Testing
Every campaign has two variants. Assignment is deterministic (hash of player_id) — the same player always gets the same variant. Statistical validity is flagged automatically (min 100 per variant).

---

## How to Run

```bash
pip install -r requirements.txt

# Full pipeline
python3 rfm_google_sheets.py   # creates Google Sheet
python3 churn_model.py         # adds churn prediction
python3 chip_economy.py        # adds chip economy + propensity
python3 run_campaigns.py       # sends campaigns (mock mode)
python3 build_dashboard.py     # opens HTML dashboard
```

### Production Mode (with Braze)
```bash
export BRAZE_API_KEY="your-key"
export BRAZE_BASE_URL="https://rest.iad-01.braze.com"
python3 run_campaigns.py
```
Zero code changes — only environment variables.

---

## Outputs

- **Google Sheets** — 8 sheets: Player Data, Segment Summary, KPI Dashboard, Churn Prediction, Chip Economy, Campaign Results, A/B Test Results, A/B Test Plan
- **automation_ready.csv** — Braze/HubSpot import-ready file with offer type, channel, variant per player
- **dashboard.html** — Self-contained visual dashboard (no server needed)

---

## Tech Stack

`Python` · `pandas` · `scikit-learn` · `gspread` · `Google Sheets API` · `Braze REST API` · `Chart.js`

---

## Business Impact

This system enables:
- **Churn prevention** — catch players before they leave based on personal behavior, not arbitrary thresholds
- **Monetization timing** — reach players exactly when they're ready to buy
- **Segment-specific strategies** — 6 player types × tailored offer × A/B variant = relevant communication
- **Automation** — runs daily via GitHub Actions, no manual work required

---

*Built as a CRM & Retention portfolio — gaming vertical. eCommerce version in progress.*
