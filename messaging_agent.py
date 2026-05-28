"""
AI Messaging Agent
Reads segment summary from Google Sheet, uses Claude to generate
personalized campaign messages per segment. Exports CSV ready for
HubSpot / Mailchimp / Braze import.
"""

import os
import csv
import json
import pickle
import anthropic
import gspread
import pandas as pd
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

# ─── CONFIG ───────────────────────────────────────────────────────────────────
CREDENTIALS = "/Users/galshushan/Agent- add more space in drive/credentials.json"
TOKEN_FILE  = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/token_sheets.pkl"
SHEET_TITLE = "Gaming RFM Segmentation Report"
OUTPUT_CSV  = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/campaign_messages.csv"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

GAME_NAME = "Battle Arena"  # Change to match actual game


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


# ─── LOAD SEGMENT SUMMARY ─────────────────────────────────────────────────────
def load_segments(gc: gspread.Client) -> pd.DataFrame:
    spreadsheet = gc.open(SHEET_TITLE)
    ws = spreadsheet.worksheet("Segment Summary")
    records = ws.get_all_records()
    return pd.DataFrame(records)


# ─── AI MESSAGING AGENT ───────────────────────────────────────────────────────
def generate_messages(segments_df: pd.DataFrame) -> list[dict]:
    client = anthropic.Anthropic()

    segments_info = segments_df.to_dict(orient="records")

    prompt = f"""You are a senior CRM & Lifecycle Marketing Manager for a mobile/PC gaming company called {GAME_NAME}.

You have the following player segments with their stats:

{json.dumps(segments_info, indent=2)}

For EACH segment, generate a complete campaign package with:
1. push_notification - Short push notification (max 90 chars), urgent and personalized
2. email_subject - Email subject line (max 60 chars), high open-rate
3. email_body - Email body (3-4 sentences), conversational, value-driven
4. in_app_message - In-app popup message (max 120 chars)
5. offer - Specific offer or incentive tailored to this segment
6. timing - Best time to send (day of week + hour)
7. goal - The one KPI this campaign moves

Return a JSON array where each object has:
{{
  "segment": "...",
  "push_notification": "...",
  "email_subject": "...",
  "email_body": "...",
  "in_app_message": "...",
  "offer": "...",
  "timing": "...",
  "goal": "..."
}}

Rules:
- Push notifications must feel personal, not generic
- Offers must be segment-specific (VIPs get exclusivity, churned get comeback bonuses)
- Email body must mention the game and feel human, not automated
- High Value Churning and At Risk segments must have urgency
- Return ONLY valid JSON array, no markdown, no explanation"""

    print("  Calling Claude API...")
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()
    # Handle if Claude wraps in markdown code block
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    messages = json.loads(raw.strip())
    return messages


# ─── WRITE MESSAGES SHEET ─────────────────────────────────────────────────────
def write_messages_sheet(gc: gspread.Client, messages: list[dict]):
    spreadsheet = gc.open(SHEET_TITLE)

    try:
        old = spreadsheet.worksheet("Campaign Messages")
        spreadsheet.del_worksheet(old)
    except gspread.exceptions.WorksheetNotFound:
        pass

    ws = spreadsheet.add_worksheet(title="Campaign Messages", rows=len(messages) + 5, cols=9)

    headers = [
        "Segment", "Push Notification", "Email Subject", "Email Body",
        "In-App Message", "Offer", "Timing", "Goal"
    ]

    col_keys = [
        "segment", "push_notification", "email_subject", "email_body",
        "in_app_message", "offer", "timing", "goal"
    ]

    rows = [headers] + [[m.get(k, "") for k in col_keys] for m in messages]
    ws.update("A1", rows, value_input_option="USER_ENTERED")

    sheet_id = ws.id
    requests = [
        {
            "repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1,
                          "startColumnIndex": 0, "endColumnIndex": len(headers)},
                "cell": {
                    "userEnteredFormat": {
                        "backgroundColor": {"red": 0.12, "green": 0.22, "blue": 0.39},
                        "textFormat": {"foregroundColor": {"red": 1, "green": 1, "blue": 1},
                                       "bold": True, "fontSize": 11},
                        "horizontalAlignment": "CENTER",
                    }
                },
                "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
            }
        },
        {
            "updateSheetProperties": {
                "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
                "fields": "gridProperties.frozenRowCount",
            }
        },
        # Wrap text in email body column
        {
            "repeatCell": {
                "range": {"sheetId": sheet_id, "startRowIndex": 1,
                          "endRowIndex": len(messages) + 1,
                          "startColumnIndex": 3, "endColumnIndex": 4},
                "cell": {"userEnteredFormat": {"wrapStrategy": "WRAP"}},
                "fields": "userEnteredFormat.wrapStrategy",
            }
        },
    ]
    spreadsheet.batch_update({"requests": requests})
    print("  ✓ Campaign Messages sheet written")


# ─── EXPORT CSV ───────────────────────────────────────────────────────────────
def export_csv(messages: list[dict]):
    fieldnames = [
        "segment", "push_notification", "email_subject", "email_body",
        "in_app_message", "offer", "timing", "goal"
    ]
    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for m in messages:
            writer.writerow({k: m.get(k, "") for k in fieldnames})
    print(f"  ✓ CSV exported: {OUTPUT_CSV}")


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("\nERROR: ANTHROPIC_API_KEY not set.")
        print("Run: export ANTHROPIC_API_KEY='your-key-here'")
        print("Get key: https://console.anthropic.com/")
        return

    print("Authenticating with Google...")
    gc = get_client()

    print("Loading segment data...")
    segments_df = load_segments(gc)
    print(f"  Found {len(segments_df)} segments")

    print("Generating campaign messages with Claude...")
    messages = generate_messages(segments_df)
    print(f"  Generated messages for {len(messages)} segments")

    print("Writing to Google Sheet...")
    write_messages_sheet(gc, messages)

    print("Exporting CSV...")
    export_csv(messages)

    url = f"https://docs.google.com/spreadsheets/d/{gc.open(SHEET_TITLE).id}"
    print(f"\nDone!")
    print(f"Sheet: {url}")
    print(f"CSV:   {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
