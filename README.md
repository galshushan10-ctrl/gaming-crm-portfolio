# Gaming RFM Segmentation Engine

An automated player segmentation tool built for mobile/PC gaming companies.  
Takes raw player activity data and produces actionable CRM segments with recommended retention actions.

---

## What It Does

- Generates a realistic dataset of 1,000 players (or plug in your own CSV)
- Scores each player on **Recency**, **Frequency**, and **Monetary** value (1–5 scale)
- Classifies players into 10 behavioral segments
- Exports a fully formatted Excel report with 4 sheets

---

## Segments & Actions

| Segment | Description | Recommended Action |
|---|---|---|
| Whale / VIP | High R, F, M — top players | VIP program, exclusive rewards, personal outreach |
| Champion | High engagement + spend | Beta access, loyalty rewards, upsell |
| Loyal Player | Consistent across all dimensions | Referral program, seasonal bonuses |
| New Player | Recent signup, low frequency | Onboarding flow, first-purchase offer |
| Active Free Player | Engaged but not spending | Monetization push, starter pack deals |
| At Risk | Dropping off, was engaged | Win-back campaign, re-engagement push |
| High Value Churning | Spent before, now leaving | URGENT: Personal outreach, high-value offer |
| Churned | Long inactive | 30/60/90-day comeback bonus series |
| Casual | Low freq, infrequent login | Daily streaks, habit-building nudges |
| Dormant | No meaningful activity | Last-chance email or sunset |

---

## Excel Report — 4 Sheets

| Sheet | Content |
|---|---|
| **Player Data** | Full dataset with RFM scores + segment per player |
| **Segment Summary** | Aggregate KPIs per segment + recommended actions |
| **Charts** | Bar chart — player distribution by segment |
| **KPI Dashboard** | Business KPIs: total revenue, whale share, churn rate, etc. |

---

## How to Run

```bash
pip install -r requirements.txt
python3 rfm_analysis.py
```

Output: `gaming_rfm_report.xlsx`

---

## RFM Scoring Logic

| Dimension | Metric | Score Direction |
|---|---|---|
| **Recency (R)** | Days since last login | Fewer days = higher score |
| **Frequency (F)** | Sessions in last 90 days | More sessions = higher score |
| **Monetary (M)** | Total spend in USD | Higher spend = higher score |

Each dimension scored 1–5 using quintile distribution. Combined into a 3-digit RFM score (e.g., `553` = highly recent, frequent, spending).

---

## Business Impact

RFM segmentation enables:
- **Targeted lifecycle campaigns** — right message to the right segment
- **Churn prevention** — catch at-risk players before they leave
- **Revenue optimization** — focus monetization on converting free players
- **VIP identification** — find future whales before competitors do

---

*Built as part of a CRM & Retention AI toolkit — gaming vertical.*
