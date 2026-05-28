"""
CRM Campaign Automation Runner — Huuuge Casino
════════════════════════════════════════════════
This is the script you run every day at your job.

What it does:
  1. Loads latest player data + chip economy state
  2. Assigns A/B variants to each player
  3. Sends campaigns via Braze (mock or real)
  4. Simulates / reads back campaign results
  5. Writes everything to Google Sheets dashboard

Usage:
  python3 run_campaigns.py                    ← full run (mock mode)
  BRAZE_API_KEY=xxx python3 run_campaigns.py  ← production mode

Switching to production:
  1. Set BRAZE_API_KEY and BRAZE_BASE_URL in your shell
  2. Replace CANVAS_IDS in braze_client.py with your real Canvas IDs
  3. Replace simulate_results() call with real Braze webhook query
  4. Done.
"""

import os
import pickle
import pandas as pd
import numpy as np
import gspread
from datetime import datetime
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

from braze_client import BrazeClient, CANVAS_IDS
from ab_test_tracker import build_ab_assignments, get_ab_summary
from results_simulator import simulate_results, get_campaign_summary, get_ab_winner

# ─── CONFIG ───────────────────────────────────────────────────────────────────
CREDENTIALS  = "/Users/galshushan/Agent- add more space in drive/credentials.json"
TOKEN_FILE   = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/token_sheets.pkl"
SHEET_TITLE  = "Gaming RFM Segmentation Report"
CSV_PATH     = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/automation_ready.csv"
RUN_DATE     = datetime.now().strftime("%Y-%m-%d %H:%M")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

# Only send to high-escalation players unless --all flag passed
MIN_ESCALATION = int(os.environ.get("MIN_ESCALATION", "2"))


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
def load_players() -> pd.DataFrame:
    df = pd.read_csv(CSV_PATH)
    numeric = ["purchase_propensity", "balance_pct", "frustration_index",
               "escalation_level", "total_spend_usd"]
    for col in numeric:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    return df


# ─── SEND CAMPAIGNS ───────────────────────────────────────────────────────────
def send_campaigns(df: pd.DataFrame, braze: BrazeClient) -> pd.DataFrame:
    """
    Groups players by offer_type + variant and sends each group
    to the appropriate Braze Canvas.

    Returns df with send_status column added.
    """
    df = df.copy()
    df["send_status"] = "not_sent"
    df["dispatch_id"]  = ""

    # Only send to players above escalation threshold
    eligible = df[df["escalation_level"] >= MIN_ESCALATION].copy()
    skip     = len(df) - len(eligible)

    print(f"\n  Eligible for send: {len(eligible)} players")
    print(f"  Skipped (low escalation): {skip} players")

    # First: update user attributes in Braze
    batch_size = 75  # Braze limit per request
    attributes = [
        {
            "external_id":         str(row["player_id"]),
            "crm_segment":         str(row.get("player_type", "")),
            "offer_type":          str(row.get("offer_type", "")),
            "purchase_propensity": float(row.get("purchase_propensity", 0)),
            "balance_pct":         float(row.get("balance_pct", 0)),
            "frustration_index":   float(row.get("frustration_index", 0)),
            "ab_variant":          str(row.get("ab_variant", "A")),
            "escalation_level":    int(row.get("escalation_level", 0)),
        }
        for _, row in eligible.iterrows()
    ]

    print(f"\n  Syncing {len(attributes)} user attributes to Braze...")
    for i in range(0, len(attributes), batch_size):
        batch = attributes[i:i+batch_size]
        braze.track_users(batch)
    print(f"  ✓ Attributes synced")

    # Then: trigger Canvas per offer_type + variant
    print(f"\n  Triggering Canvases...")
    for (offer_type, variant), group in eligible.groupby(["offer_type", "ab_variant"]):
        canvas_id = CANVAS_IDS.get(offer_type)
        if canvas_id is None:
            continue

        recipients = [{"external_user_id": str(pid)}
                      for pid in group["player_id"].tolist()]

        result = braze.trigger_canvas(
            canvas_id=canvas_id,
            recipients=recipients,
            canvas_entry_properties={"ab_variant": variant, "run_date": RUN_DATE},
        )

        dispatch_id = result.get("dispatch_id", "")
        status      = "sent" if result.get("message") == "success" else "error"

        df.loc[group.index, "send_status"] = status
        df.loc[group.index, "dispatch_id"] = dispatch_id

        mock_tag = " [MOCK]" if result.get("mock") else ""
        print(f"    {offer_type} / Variant {variant}: {len(recipients)} players → {status}{mock_tag}")

    sent = (df["send_status"] == "sent").sum()
    print(f"\n  Total sent: {sent} players")
    return df


# ─── WRITE DASHBOARD ──────────────────────────────────────────────────────────
def write_dashboard(spreadsheet, df: pd.DataFrame,
                    summary: pd.DataFrame, ab_results: pd.DataFrame,
                    ab_summary: pd.DataFrame):

    # ── Campaign Results sheet ────────────────────────────────────────────────
    for sheet_name, data in [
        ("Campaign Results",  df),
        ("Campaign Summary",  summary),
        ("A/B Test Results",  ab_results),
        ("A/B Test Plan",     ab_summary),
    ]:
        try:
            old = spreadsheet.worksheet(sheet_name)
            spreadsheet.del_worksheet(old)
        except gspread.exceptions.WorksheetNotFound:
            pass

        ws = spreadsheet.add_worksheet(title=sheet_name,
                                       rows=len(data) + 10, cols=len(data.columns) + 2)

        headers = list(data.columns)
        rows    = [headers] + data.fillna("").values.tolist()
        ws.update("A1", rows, value_input_option="USER_ENTERED")

        # Header formatting
        sheet_id = ws.id
        spreadsheet.batch_update({"requests": [
            {
                "repeatCell": {
                    "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1,
                              "startColumnIndex": 0, "endColumnIndex": len(headers)},
                    "cell": {"userEnteredFormat": {
                        "backgroundColor": {"red": 0.12, "green": 0.22, "blue": 0.39},
                        "textFormat": {"foregroundColor": {"red":1,"green":1,"blue":1},
                                       "bold": True, "fontSize": 11},
                        "horizontalAlignment": "CENTER",
                    }},
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                }
            },
            {
                "updateSheetProperties": {
                    "properties": {"sheetId": sheet_id,
                                   "gridProperties": {"frozenRowCount": 1}},
                    "fields": "gridProperties.frozenRowCount",
                }
            },
        ]})

        print(f"  ✓ {sheet_name} ({len(data)} rows)")


# ─── PRINT SUMMARY ────────────────────────────────────────────────────────────
def print_run_summary(summary: pd.DataFrame, ab_results: pd.DataFrame):
    print("\n" + "═"*55)
    print("  CAMPAIGN RUN SUMMARY")
    print(f"  {RUN_DATE}")
    print("═"*55)

    total_sent    = summary["sent"].sum()
    total_rev     = summary["total_revenue_usd"].sum()
    total_conv    = summary["conversions"].sum()
    overall_conv  = total_conv / total_sent if total_sent > 0 else 0

    print(f"\n  Messages sent:      {int(total_sent):,}")
    print(f"  Conversions:        {int(total_conv):,}  ({overall_conv:.1%})")
    print(f"  Revenue generated:  ${total_rev:,.2f}")
    print(f"  Revenue per send:   ${total_rev/total_sent:.2f}" if total_sent > 0 else "")

    print("\n  By offer type:")
    for _, row in summary.iterrows():
        print(f"    [{row['variant']}] {row['offer_type']:<28} "
              f"sent={int(row['sent']):>4}  "
              f"conv={row['conversion_rate']:.1%}  "
              f"rev=${row['total_revenue_usd']:>7,.2f}")

    if len(ab_results) > 0:
        print("\n  A/B Winners:")
        for _, row in ab_results.iterrows():
            print(f"    {row['offer_type']:<28} Winner: {row['winner']}  "
                  f"lift={row['lift_pct']:+.1f}%  ({row['confidence']})")

    print("\n" + "═"*55)


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("="*55)
    print("  CRM AUTOMATION RUNNER — Huuuge Casino")
    print(f"  {RUN_DATE}")
    print("="*55)

    print("\n[1/6] Loading player data...")
    df = load_players()
    print(f"  {len(df)} players loaded")

    print("\n[2/6] Assigning A/B variants...")
    df = build_ab_assignments(df)
    ab_plan = get_ab_summary(df)
    print(f"  {df['offer_type'].nunique()} offer types, {len(df)} assignments")

    print("\n[3/6] Connecting to Braze...")
    braze = BrazeClient()

    print("\n[4/6] Sending campaigns...")
    df = send_campaigns(df, braze)

    print("\n[5/6] Simulating results...")
    # In production: replace with braze.get_campaign_stats() or analytics query
    sent_df = df[df["send_status"] == "sent"].copy()
    if len(sent_df) > 0:
        sent_df = simulate_results(sent_df)
        summary    = get_campaign_summary(sent_df)
        ab_results = get_ab_winner(summary)
    else:
        sent_df    = df
        summary    = pd.DataFrame()
        ab_results = pd.DataFrame()

    print_run_summary(summary, ab_results)

    print("\n[6/6] Writing to Google Sheets dashboard...")
    gc = get_client()
    spreadsheet = gc.open(SHEET_TITLE)
    write_dashboard(spreadsheet, sent_df, summary, ab_results, ab_plan)

    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}"
    print(f"\nDone! Dashboard: {url}")


if __name__ == "__main__":
    main()
