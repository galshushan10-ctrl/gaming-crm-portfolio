"""
Customer Lifetime Value (CLV) Model — Huuuge Casino
════════════════════════════════════════════════════
Predicts how much each player will spend in the next 12 months.

Two components:
  1. Retention probability — will this player still be active?
  2. Expected spend — if active, how much will they spend?

CLV = retention_probability × expected_monthly_spend × 12

Segments players into CLV tiers and recommends investment level per player.

IN PRODUCTION: replace synthetic data with real purchase history from DB.
"""

import pandas as pd
import numpy as np
import pickle
import os
import gspread
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

# ─── CONFIG ───────────────────────────────────────────────────────────────────
CREDENTIALS = "/Users/galshushan/Agent- add more space in drive/credentials.json"
TOKEN_FILE  = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/token_sheets.pkl"
SHEET_TITLE = "Gaming RFM Segmentation Report"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

# CLV tiers — how much to invest in each player
CLV_TIERS = {
    "Elite":    {"min": 500,  "color": (1.0,  0.84, 0.0),  "text": (0,0,0), "invest": "High-touch: personal account manager, exclusive events"},
    "High":     {"min": 150,  "color": (0.0,  0.6,  0.2),  "text": (1,1,1), "invest": "VIP program, loyalty rewards, priority support"},
    "Mid":      {"min": 50,   "color": (0.0,  0.44, 0.75), "text": (1,1,1), "invest": "Standard retention campaigns, upsell offers"},
    "Low":      {"min": 10,   "color": (0.6,  0.6,  0.6),  "text": (1,1,1), "invest": "Automated campaigns only, low-cost offers"},
    "Minimal":  {"min": 0,    "color": (0.35, 0.35, 0.35), "text": (1,1,1), "invest": "Win-back only if cheap. Consider sunset."},
}


# ─── AUTH ─────────────────────────────────────────────────────────────────────
def get_client():
    creds = None
    if os.path.exists(TOKEN_FILE):
        with open(TOKEN_FILE, "rb") as f:
            creds = pickle.load(f)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS, SCOPES)
            creds = flow.run_local_server(port=0)
        with open(TOKEN_FILE, "wb") as f:
            pickle.dump(creds, f)
    return gspread.authorize(creds)


# ─── LOAD DATA ────────────────────────────────────────────────────────────────
def load_data(gc) -> tuple[pd.DataFrame, object]:
    spreadsheet = gc.open(SHEET_TITLE)
    ws = spreadsheet.worksheet("Player Data")
    df = pd.DataFrame(ws.get_all_records())

    for col in ["sessions_last_90d", "total_spend_usd", "days_since_last_activity", "player_level"]:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    return df, spreadsheet


# ─── RETENTION PROBABILITY ────────────────────────────────────────────────────
def calc_retention_probability(df: pd.DataFrame) -> pd.DataFrame:
    """
    Probability the player will still be active 12 months from now.

    Based on:
    - Current engagement level (sessions, recency)
    - Spend history (payers retain better)
    - Player level (progression = investment = higher retention)
    - Segment

    Formula: logistic curve on a composite engagement score.
    IN PRODUCTION: train on historical 12-month retention labels.
    """
    df = df.copy()

    sessions   = df["sessions_last_90d"].clip(0, 60)
    recency    = df["days_since_last_activity"].clip(0, 365)
    spend      = df["total_spend_usd"].clip(0, 2000)
    level      = df["player_level"].clip(0, 100)

    # Normalize each to 0-1
    sessions_n = sessions / 60
    recency_n  = 1 - (recency / 365)       # higher recency = lower score
    spend_n    = np.log1p(spend) / np.log1p(2000)
    level_n    = level / 100

    # Weighted engagement score
    engagement = (
        0.35 * sessions_n +
        0.30 * recency_n  +
        0.25 * spend_n    +
        0.10 * level_n
    )

    # Logistic curve: maps engagement 0-1 → retention probability 0-1
    # Steepness=8, midpoint=0.45 → casual players have ~20%, whales have ~90%
    df["retention_probability_12m"] = (
        1 / (1 + np.exp(-8 * (engagement - 0.45)))
    ).round(3)

    return df


# ─── EXPECTED MONTHLY SPEND ───────────────────────────────────────────────────
def calc_expected_spend(df: pd.DataFrame) -> pd.DataFrame:
    """
    Expected monthly spend IF the player stays active.

    Base: actual spend over last 90 days → monthly rate.
    Adjusted for: growth trajectory (new players spend more over time),
    whale multiplier, F2P conversion probability.

    IN PRODUCTION: use full purchase history + time series model.
    """
    df = df.copy()

    # Monthly spend rate from last 90 days
    monthly_spend_base = df["total_spend_usd"] / 3  # 90 days = 3 months

    # Growth factor: engaged players tend to spend more over time
    sessions_factor = np.where(
        df["sessions_last_90d"] > 20, 1.15,   # high engagement → growing spend
        np.where(df["sessions_last_90d"] > 8, 1.0, 0.80)  # casual → declining
    )

    # F2P players: small probability of first conversion
    # avg first purchase $1.99, probability based on engagement
    f2p_mask = df["total_spend_usd"] == 0
    f2p_conversion_prob = np.where(
        f2p_mask,
        (df["sessions_last_90d"] / 60).clip(0, 0.08),  # max 8% conversion chance
        0
    )
    f2p_expected_spend = f2p_conversion_prob * 1.99

    df["expected_monthly_spend_usd"] = (
        monthly_spend_base * sessions_factor + f2p_expected_spend
    ).round(2)

    return df


# ─── CLV CALCULATION ─────────────────────────────────────────────────────────
def calc_clv(df: pd.DataFrame) -> pd.DataFrame:
    """
    CLV = retention_probability × expected_monthly_spend × 12

    Also calculates:
    - clv_3m: short-term value (next quarter)
    - clv_6m: mid-term value
    - clv_12m: full annual value

    Discounted at 10% annual rate (standard for gaming).
    """
    df = df.copy()
    discount_rate_monthly = 0.10 / 12  # 10% annual → monthly

    r  = df["retention_probability_12m"]
    ms = df["expected_monthly_spend_usd"]

    # Present value of future spend (discounted cash flow, simplified)
    # PV = Σ (r^t × monthly_spend / (1+discount)^t) for t=1..12
    clv_3m  = sum(r**t * ms / (1 + discount_rate_monthly)**t for t in range(1, 4))
    clv_6m  = sum(r**t * ms / (1 + discount_rate_monthly)**t for t in range(1, 7))
    clv_12m = sum(r**t * ms / (1 + discount_rate_monthly)**t for t in range(1, 13))

    df["clv_3m_usd"]  = clv_3m.round(2)
    df["clv_6m_usd"]  = clv_6m.round(2)
    df["clv_12m_usd"] = clv_12m.round(2)

    # CLV tier
    def assign_tier(clv):
        for tier, cfg in CLV_TIERS.items():
            if clv >= cfg["min"]:
                return tier
        return "Minimal"

    df["clv_tier"]           = df["clv_12m_usd"].apply(assign_tier)
    df["investment_strategy"] = df["clv_tier"].map(lambda t: CLV_TIERS[t]["invest"])

    # ROI flag: how much can we spend to retain this player?
    # Rule: max retention cost = 20% of CLV
    df["max_retention_cost_usd"] = (df["clv_12m_usd"] * 0.20).round(2)

    return df


# ─── WRITE SHEET ──────────────────────────────────────────────────────────────
def write_clv_sheet(spreadsheet, df: pd.DataFrame):
    try:
        old = spreadsheet.worksheet("CLV Model")
        spreadsheet.del_worksheet(old)
    except gspread.exceptions.WorksheetNotFound:
        pass

    ws = spreadsheet.add_worksheet(title="CLV Model", rows=len(df)+5, cols=14)

    output_cols = [
        "player_id", "segment", "clv_tier", "clv_12m_usd",
        "clv_6m_usd", "clv_3m_usd",
        "retention_probability_12m", "expected_monthly_spend_usd",
        "max_retention_cost_usd", "investment_strategy",
        "total_spend_usd", "sessions_last_90d", "platform", "country"
    ]
    available = [c for c in output_cols if c in df.columns]
    out = df[available].sort_values("clv_12m_usd", ascending=False)

    headers = [
        "Player ID", "Segment", "CLV Tier", "CLV 12M ($)",
        "CLV 6M ($)", "CLV 3M ($)",
        "Retention Prob (12M)", "Expected Monthly Spend ($)",
        "Max Retention Cost ($)", "Investment Strategy",
        "Total Spend ($)", "Sessions (90d)", "Platform", "Country"
    ]

    rows = [headers[:len(available)]] + out.fillna("").values.tolist()
    ws.update("A1", rows, value_input_option="USER_ENTERED")

    sheet_id = ws.id
    tier_col = available.index("clv_tier")

    requests = [
        {
            "repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1,
                          "startColumnIndex": 0, "endColumnIndex": len(available)},
                "cell": {"userEnteredFormat": {
                    "backgroundColor": {"red": 0.12, "green": 0.22, "blue": 0.39},
                    "textFormat": {"foregroundColor": {"red":1,"green":1,"blue":1}, "bold": True},
                    "horizontalAlignment": "CENTER",
                }},
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }
        },
        {
            "updateSheetProperties": {
                "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
                "fields": "gridProperties.frozenRowCount",
            }
        },
    ]

    for i, tier in enumerate(out["clv_tier"].tolist(), start=1):
        cfg = CLV_TIERS.get(tier, {})
        if cfg:
            bg, txt = cfg["color"], cfg["text"]
            requests.append({
                "repeatCell": {
                    "range": {"sheetId": sheet_id, "startRowIndex": i, "endRowIndex": i+1,
                              "startColumnIndex": tier_col, "endColumnIndex": tier_col+1},
                    "cell": {"userEnteredFormat": {
                        "backgroundColor": {"red": bg[0], "green": bg[1], "blue": bg[2]},
                        "textFormat": {"foregroundColor": {"red": txt[0], "green": txt[1],
                                                           "blue": txt[2]}, "bold": True},
                        "horizontalAlignment": "CENTER",
                    }},
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                }
            })

    spreadsheet.batch_update({"requests": requests})
    print("  ✓ CLV Model sheet written")
    return out


# ─── PRINT SUMMARY ────────────────────────────────────────────────────────────
def print_summary(df: pd.DataFrame):
    total_clv = df["clv_12m_usd"].sum()
    print(f"\n  CLV Summary (12-month portfolio value):")
    print(f"  Total predicted revenue: ${total_clv:,.0f}")
    print(f"\n  By tier:")
    for tier in CLV_TIERS:
        subset = df[df["clv_tier"] == tier]
        if len(subset) == 0:
            continue
        tier_clv = subset["clv_12m_usd"].sum()
        avg_clv  = subset["clv_12m_usd"].mean()
        print(f"    {tier:<10} {len(subset):>4} players  "
              f"avg CLV=${avg_clv:>7.0f}  "
              f"total=${tier_clv:>9,.0f}  "
              f"({tier_clv/total_clv*100:.0f}% of revenue)")


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("Authenticating...")
    gc = get_client()

    print("Loading player data...")
    df, spreadsheet = load_data(gc)
    print(f"  {len(df)} players loaded")

    print("Calculating retention probability...")
    df = calc_retention_probability(df)

    print("Calculating expected monthly spend...")
    df = calc_expected_spend(df)

    print("Calculating CLV (3M / 6M / 12M)...")
    df = calc_clv(df)

    print("Writing to Google Sheet...")
    out = write_clv_sheet(spreadsheet, df)

    print_summary(df)

    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}"
    print(f"\nDone! {url}")


if __name__ == "__main__":
    main()
