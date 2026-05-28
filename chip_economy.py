"""
Chip Economy Model — Huuuge Casino style
Adds chip balance signals and purchase propensity scoring to each player.
Outputs a full automation-ready CSV with per-player messaging strategy.

Key concept: Need State Targeting
  - Purchase propensity peaks at 15-25% of player's normal chip level
  - Drops sharply at 0% (frustration → churn, not purchase)
  - Consolation mechanic bridges the gap at 0%

IN PRODUCTION: chip_balance and chips_burned_today come from real-time
event stream (Braze SDK / Amplitude / internal analytics).
HERE: simulated from existing player behavior signals.
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
OUTPUT_CSV  = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/automation_ready.csv"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

# Chip tiers (in millions) — Huuuge Casino scale
CHIP_TIERS = {
    "whale":    (500,  5000),
    "dolphin":  ( 50,   500),
    "minnow":   (  5,    50),
    "f2p":      (  1,    20),
    "broke":    (  0,     2),
}


# ─── AUTH ─────────────────────────────────────────────────────────────────────
def get_client() -> gspread.Client:
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


# ─── SIMULATE CHIP ECONOMY ────────────────────────────────────────────────────
def simulate_chip_economy(df: pd.DataFrame) -> pd.DataFrame:
    """
    In production, replace this entire function with a JOIN to your
    real-time analytics table:
      SELECT player_id,
             chip_balance,
             chip_balance_session_start,
             chip_balance_7d_avg,
             chips_burned_today,
             session_duration_minutes
      FROM player_chip_state
      WHERE snapshot_time = NOW()

    Here: we derive realistic chip state from spend, sessions, and RFM scores.
    """
    np.random.seed(42)
    n = len(df)

    is_payer = df["total_spend_usd"] > 0
    sessions = df["sessions_last_90d"].clip(lower=1)

    # 7-day average balance — proxy for player's "comfortable level"
    # Payers have higher balances (they top up regularly)
    base_balance = np.where(
        is_payer,
        df["total_spend_usd"] * 500 * np.random.uniform(0.5, 2.0, n),  # spend correlates with chip tier
        np.random.uniform(1, 15, n) * 1_000_000  # F2P: 1M-15M chips avg
    )
    df["chip_balance_7d_avg_M"] = (base_balance / 1_000_000).round(2)  # in millions

    # Current session burn — how much they've used today
    # Higher sessions = higher burn rate
    session_intensity = (sessions / 90).clip(0, 1)  # 0-1 normalized activity
    chips_burned_pct = np.random.beta(
        2 * session_intensity + 0.5,   # alpha: active players burn more
        2 * (1 - session_intensity) + 0.5  # beta
    )
    df["chips_burned_pct_today"] = chips_burned_pct.round(3)
    df["chips_burned_today_M"] = (
        df["chip_balance_7d_avg_M"] * chips_burned_pct
    ).round(2)

    # Session start balance — what they had at start of today's session
    # Add some variance (yesterday they might have topped up or had a bad day)
    session_start_multiplier = np.random.uniform(0.6, 1.4, n)
    df["chip_balance_session_start_M"] = (
        df["chip_balance_7d_avg_M"] * session_start_multiplier
    ).round(2)

    # Current balance = session_start - burned (can't go below 0)
    df["chip_balance_M"] = (
        df["chip_balance_session_start_M"] - df["chips_burned_today_M"]
    ).clip(lower=0).round(2)

    # Balance % relative to their personal average (100% = at their norm)
    df["balance_pct"] = (
        df["chip_balance_M"] / df["chip_balance_7d_avg_M"].clip(lower=0.01)
    ).clip(0, 3).round(3)

    # Frustration index: how much they burned today vs their average
    # > 0.5 = burned more than half their normal in one day = frustrated
    df["frustration_index"] = (
        df["chips_burned_today_M"] / df["chip_balance_7d_avg_M"].clip(lower=0.01)
    ).clip(0, 2).round(3)

    return df


# ─── PURCHASE PROPENSITY ──────────────────────────────────────────────────────
def score_purchase_propensity(df: pd.DataFrame) -> pd.DataFrame:
    """
    Purchase propensity curve based on chip balance state.
    Peaks at 15-25% balance (hungry but not broken).
    Falls at 0% (too frustrated) and >80% (doesn't need chips).

    Score: 0.0 (won't buy) → 1.0 (almost certainly buys if shown offer)
    """
    bp = df["balance_pct"]   # 0-3
    fi = df["frustration_index"]  # 0-2

    # Base propensity from balance_pct (bell curve peaking at 0.2)
    # Using a skewed normal-like function
    peak = 0.20
    base_propensity = np.exp(-((bp - peak) ** 2) / (2 * 0.15 ** 2))

    # Frustration modifier:
    # Mild frustration (0.2-0.5) → boosts propensity (they want to recover)
    # Heavy frustration (>0.7)   → reduces propensity (they feel cheated)
    frustration_boost = np.where(
        fi < 0.3,   1.0,                          # low frustration: neutral
        np.where(
            fi < 0.6, 1.0 + (fi - 0.3) * 1.5,    # mild: small boost
            np.where(
                fi < 1.0, 1.3 - (fi - 0.6) * 2.0, # rising: starts to hurt
                0.5 - (fi - 1.0) * 0.3             # heavy: significant reduction
            )
        )
    )

    # Non-entrant penalty (they're not even in the game)
    activity_multiplier = np.where(df["sessions_last_90d"] > 2, 1.0, 0.4)

    df["purchase_propensity"] = (
        base_propensity * frustration_boost * activity_multiplier
    ).clip(0, 1).round(3)

    return df


# ─── MONETIZATION STATE ───────────────────────────────────────────────────────
def classify_monetization_state(row) -> dict:
    """
    Returns the monetization state and recommended action for each player.
    This is what drives the automation trigger in Braze.
    """
    bp  = row["balance_pct"]
    fi  = row["frustration_index"]
    pp  = row["purchase_propensity"]
    pt  = row.get("player_type", "Unknown")
    avg = row["chip_balance_7d_avg_M"]

    # ── Case 1: Winning / Full ────────────────────────────────────────────────
    if bp > 0.8:
        return {
            "monetization_state": "Not Ready — Full Balance",
            "action":             "Show VIP teaser or social content. No purchase offer.",
            "offer_type":         "VIP_TEASER",
            "consolation_chips_M": 0,
            "escalation_level":   1,
            "trigger_channel":    "In-App",
            "ab_variant":         "A=VIP_badge | B=Leaderboard_position",
        }

    # ── Case 2: Sweet spot — ready to buy ────────────────────────────────────
    if 0.10 < bp <= 0.50 and fi < 0.7:
        offer_price = "$0.99" if pt in ("F2P Active", "F2P Lapsing") else "$4.99"
        chips_M     = round(avg * 0.8, 1)
        return {
            "monetization_state": "Purchase Window — Optimal",
            "action":             f"Show monetization offer: {chips_M}M chips for {offer_price}. Time-limited 2h.",
            "offer_type":         "PURCHASE_OFFER",
            "consolation_chips_M": 0,
            "escalation_level":   3,
            "trigger_channel":    "In-App + Push",
            "ab_variant":         "A=Price_anchor | B=Value_anchor",
        }

    # ── Case 3: Low balance, high frustration — console first ─────────────────
    if bp <= 0.10 and fi > 0.6:
        consolation = round(avg * 0.15, 1)  # ~15% of their average as free gift
        chips_M     = round(avg * 1.0, 1)
        return {
            "monetization_state": "Frustrated — Console Before Offer",
            "action":             f"Step 1: Give {consolation}M free chips ('Tough session — on us!'). Step 2: 30min later offer {chips_M}M for $2.99.",
            "offer_type":         "CONSOLATION_THEN_OFFER",
            "consolation_chips_M": consolation,
            "escalation_level":   4,
            "trigger_channel":    "In-App (step 1) → Push (step 2, 30min delay)",
            "ab_variant":         "A=Consolation_only | B=Consolation+Offer_immediate",
        }

    # ── Case 4: Broke (0 chips), moderate frustration ─────────────────────────
    if bp <= 0.05 and fi <= 0.6:
        chips_M = round(avg * 1.2, 1)
        return {
            "monetization_state": "Broke — High Purchase Intent",
            "action":             f"Immediate offer: {chips_M}M chips. They can't play without buying.",
            "offer_type":         "BROKE_OFFER",
            "consolation_chips_M": 0,
            "escalation_level":   5,
            "trigger_channel":    "In-App (blocks gameplay) + Push",
            "ab_variant":         "A=Single_pack | B=Bundle_with_VIP_badge",
        }

    # ── Case 5: Non-entrant (not in session) ──────────────────────────────────
    if row["sessions_last_90d"] < 2:
        return {
            "monetization_state": "Non-Entrant — Re-engage First",
            "action":             "Win-back: big free chip offer. No purchase ask yet.",
            "offer_type":         "WIN_BACK",
            "consolation_chips_M": round(avg * 0.5, 1),
            "escalation_level":   2,
            "trigger_channel":    "Email + Push",
            "ab_variant":         "A=Chip_volume | B=Social_proof",
        }

    # ── Default ───────────────────────────────────────────────────────────────
    return {
        "monetization_state": "Monitor",
        "action":             "No immediate action. Re-evaluate next session.",
        "offer_type":         "NONE",
        "consolation_chips_M": 0,
        "escalation_level":   0,
        "trigger_channel":    "None",
        "ab_variant":         "N/A",
    }


# ─── WRITE CHIP SHEET ─────────────────────────────────────────────────────────
def write_chip_sheet(spreadsheet, df: pd.DataFrame):
    try:
        old = spreadsheet.worksheet("Chip Economy")
        spreadsheet.del_worksheet(old)
    except gspread.exceptions.WorksheetNotFound:
        pass

    ws = spreadsheet.add_worksheet(title="Chip Economy", rows=len(df) + 5, cols=16)

    output_cols = [
        "player_id", "player_type", "monetization_state", "purchase_propensity",
        "escalation_level", "balance_pct", "chip_balance_M",
        "chip_balance_7d_avg_M", "chips_burned_today_M", "frustration_index",
        "offer_type", "consolation_chips_M", "trigger_channel", "ab_variant",
        "action",
    ]

    headers = [
        "Player ID", "Player Type", "Monetization State", "Purchase Propensity (0-1)",
        "Escalation Level (1-5)", "Balance % of Normal", "Chips Now (M)",
        "7-Day Avg Balance (M)", "Chips Burned Today (M)", "Frustration Index (0-2)",
        "Offer Type", "Free Chips to Give (M)", "Trigger Channel", "A/B Variants",
        "Recommended Action",
    ]

    available = [c for c in output_cols if c in df.columns]
    out = df[available].sort_values("escalation_level", ascending=False)

    rows = [headers[:len(available)]] + out.values.tolist()
    ws.update("A1", rows, value_input_option="USER_ENTERED")

    sheet_id = ws.id

    # State color map
    STATE_COLORS = {
        "Broke — High Purchase Intent":      {"bg": (0.85, 0.1,  0.1),  "text": (1,1,1)},
        "Frustrated — Console Before Offer": {"bg": (1.0,  0.45, 0.0),  "text": (1,1,1)},
        "Purchase Window — Optimal":         {"bg": (0.0,  0.65, 0.3),  "text": (1,1,1)},
        "Non-Entrant — Re-engage First":     {"bg": (0.5,  0.5,  0.5),  "text": (1,1,1)},
        "Not Ready — Full Balance":          {"bg": (0.85, 0.85, 0.85), "text": (0,0,0)},
        "Monitor":                           {"bg": (0.95, 0.95, 0.95), "text": (0,0,0)},
    }

    state_col_idx = available.index("monetization_state") if "monetization_state" in available else None

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

    if state_col_idx is not None:
        for i, state in enumerate(out["monetization_state"].tolist(), start=1):
            cfg = STATE_COLORS.get(state, {})
            if cfg:
                bg, txt = cfg["bg"], cfg["text"]
                requests.append({
                    "repeatCell": {
                        "range": {"sheetId": sheet_id, "startRowIndex": i, "endRowIndex": i+1,
                                  "startColumnIndex": state_col_idx, "endColumnIndex": state_col_idx+1},
                        "cell": {"userEnteredFormat": {
                            "backgroundColor": {"red": bg[0], "green": bg[1], "blue": bg[2]},
                            "textFormat": {"foregroundColor": {"red": txt[0], "green": txt[1], "blue": txt[2]},
                                           "bold": True},
                        }},
                        "fields": "userEnteredFormat(backgroundColor,textFormat)",
                    }
                })

    spreadsheet.batch_update({"requests": requests})
    print("  ✓ Chip Economy sheet written")


# ─── EXPORT AUTOMATION CSV ────────────────────────────────────────────────────
def export_automation_csv(df: pd.DataFrame):
    """
    This CSV is the input to Braze or HubSpot.
    Each row = one player with their trigger, offer, channel, and A/B variant.

    In Braze: import as User Attributes → trigger Canvas based on offer_type.
    In HubSpot: import as Contact Properties → enroll in Workflow.
    """
    export_cols = [
        "player_id", "player_type", "segment",
        "monetization_state", "offer_type", "escalation_level",
        "purchase_propensity", "balance_pct", "frustration_index",
        "consolation_chips_M", "trigger_channel", "ab_variant", "action",
        "churn_risk", "churn_probability",
        "total_spend_usd", "platform", "country",
    ]

    available = [c for c in export_cols if c in df.columns]
    out = df[available].sort_values("escalation_level", ascending=False)
    out.to_csv(OUTPUT_CSV, index=False)
    print(f"  ✓ Automation CSV: {OUTPUT_CSV}")
    print(f"    Rows: {len(out)} players")

    # Summary
    print(f"\n  Offer Type Distribution:")
    for otype, count in out["offer_type"].value_counts().items():
        high_prop = (out.loc[out["offer_type"] == otype, "purchase_propensity"] > 0.5).sum()
        print(f"    {otype:<35} {count:>4} players  ({high_prop} high propensity)")


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("Authenticating...")
    gc = get_client()

    print("Loading player data...")
    spreadsheet = gc.open(SHEET_TITLE)

    # Load from Churn Prediction sheet (has player_type already)
    try:
        ws_churn = spreadsheet.worksheet("Churn Prediction")
        records = ws_churn.get_all_records()
        df = pd.DataFrame(records)
        print(f"  Loaded {len(df)} players from Churn Prediction sheet")
    except gspread.exceptions.WorksheetNotFound:
        ws_player = spreadsheet.sheet1
        records = ws_player.get_all_records()
        df = pd.DataFrame(records)
        print(f"  Loaded {len(df)} players from Player Data sheet")

    # Normalize column names from sheet headers → internal names
    col_map = {
        "Player ID": "player_id",
        "Player Type": "player_type",
        "Total Spend ($)": "total_spend_usd",
        "Sessions (90d)": "sessions_last_90d",
        "Days Since Login": "days_since_last_activity",
        "Churn Probability": "churn_probability",
        "Activity Risk": "churn_risk",
        "Activity Overdue (x cadence)": "activity_overdue_ratio",
        "Platform": "platform",
        "Country": "country",
        "Segment": "segment",
    }
    df = df.rename(columns={k: v for k, v in col_map.items() if k in df.columns})

    # Ensure numeric columns
    numeric_cols = ["sessions_last_90d", "total_spend_usd", "days_since_last_activity",
                    "churn_probability", "activity_overdue_ratio"]
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)

    print("Simulating chip economy...")
    df = simulate_chip_economy(df)

    print("Scoring purchase propensity...")
    df = score_purchase_propensity(df)

    print("Classifying monetization states...")
    mon_states = df.apply(classify_monetization_state, axis=1)
    mon_df = pd.DataFrame(list(mon_states))
    df = pd.concat([df.reset_index(drop=True), mon_df.reset_index(drop=True)], axis=1)

    print("Writing to Google Sheet...")
    write_chip_sheet(spreadsheet, df)

    print("Exporting automation CSV...")
    export_automation_csv(df)

    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}"
    print(f"\nDone! {url}")


if __name__ == "__main__":
    main()
