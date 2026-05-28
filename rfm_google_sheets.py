import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import gspread
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
import pickle
import os

# ─── CONFIG ───────────────────────────────────────────────────────────────────
TODAY        = datetime(2026, 5, 28)
N_PLAYERS    = 1000
RANDOM_SEED  = 42
SHEET_TITLE  = "Gaming RFM Segmentation Report"
CREDENTIALS  = "/Users/galshushan/Agent- add more space in drive/credentials.json"
TOKEN_FILE   = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/token_sheets.pkl"

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

# ─── SEGMENT CONFIG ───────────────────────────────────────────────────────────
SEGMENT_COLORS = {
    "Whale / VIP":         {"bg": (1.0, 0.85, 0.0),   "text": (0,0,0)},
    "Champion":            {"bg": (0.0, 0.69, 0.31),   "text": (1,1,1)},
    "Loyal Player":        {"bg": (0.57, 0.82, 0.31),  "text": (0,0,0)},
    "New Player":          {"bg": (0.0, 0.69, 0.94),   "text": (0,0,0)},
    "Active Free Player":  {"bg": (0.0, 0.44, 0.75),   "text": (1,1,1)},
    "At Risk":             {"bg": (1.0, 0.6,  0.0),    "text": (0,0,0)},
    "High Value Churning": {"bg": (1.0, 0.0,  0.0),    "text": (1,1,1)},
    "Churned":             {"bg": (0.75, 0.0, 0.0),    "text": (1,1,1)},
    "Casual":              {"bg": (0.75, 0.75, 0.75),  "text": (0,0,0)},
    "Dormant":             {"bg": (0.5,  0.5,  0.5),   "text": (1,1,1)},
}

SEGMENT_ACTIONS = {
    "Whale / VIP":         "VIP program, exclusive rewards, personal account manager",
    "Champion":            "Beta access, loyalty rewards, upsell premium features",
    "Loyal Player":        "Cross-sell, referral program, seasonal bonuses",
    "New Player":          "Onboarding flow, tutorial bonus, first-purchase offer",
    "Active Free Player":  "Starter pack offers, limited-time deals, monetization push",
    "At Risk":             "Win-back campaign, special offer, re-engagement push notification",
    "High Value Churning": "URGENT: Personal outreach, high-value retention offer",
    "Churned":             "Win-back email series, comeback bonus (30/60/90 day)",
    "Casual":              "Habit-building nudges, daily reward streaks",
    "Dormant":             "Last-chance re-engagement or sunset",
}

SEGMENT_ORDER = list(SEGMENT_COLORS.keys())


# ─── AUTH ─────────────────────────────────────────────────────────────────────
def get_google_client() -> gspread.Client:
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


# ─── DATA ─────────────────────────────────────────────────────────────────────
def generate_data(n: int) -> pd.DataFrame:
    np.random.seed(RANDOM_SEED)
    random.seed(RANDOM_SEED)

    # Huuuge Casino realistic distribution:
    # ~70% never spend (true F2P), ~20% occasional payers, ~10% regular/whale payers
    # spend=0 explicitly for F2P profiles
    profiles = [
        # label       weight  recency        freq         spend
        ("whale",      0.03, (1,  14), (20, 60), (500, 2000)),
        ("dolphin",    0.07, (1,  21), (10, 30), ( 50,  500)),
        ("minnow",     0.10, (1,  30), ( 5, 20), (  5,   50)),
        ("f2p_active", 0.35, (1,  20), ( 5, 40), (  0,    0)),  # pure F2P, active
        ("f2p_casual", 0.20, (7,  60), ( 1, 10), (  0,    0)),  # F2P, casual
        ("at_risk",    0.10, (30, 90), ( 2, 10), (  0,   20)),  # mixed, dropping off
        ("churned",    0.15, (90,365), ( 1,  3), (  0,   10)),  # mostly gone
    ]
    weights   = [p[1] for p in profiles]
    games     = ["Battle Arena", "Fantasy Quest", "Speed Racers", "Space Wars", "Puzzle Kingdom"]
    platforms = ["Mobile", "PC", "Console"]
    p_weights = [0.50, 0.30, 0.20]
    countries = ["Israel", "USA", "UK", "Germany", "France", "Brazil", "Japan", "Korea"]
    c_weights = [0.15, 0.25, 0.10, 0.08, 0.07, 0.10, 0.10, 0.15]

    rows = []
    for i in range(n):
        _, _, rec_r, freq_r, spend_r = random.choices(profiles, weights=weights)[0]
        recency   = random.randint(*rec_r)
        frequency = random.randint(*freq_r)
        monetary  = round(random.uniform(*spend_r), 2)
        reg_days  = random.randint(max(recency, 30), 1095)

        rows.append({
            "player_id":                f"PLR_{i+1:04d}",
            "registration_date":        (TODAY - timedelta(days=reg_days)).strftime("%Y-%m-%d"),
            "last_activity_date":       (TODAY - timedelta(days=recency)).strftime("%Y-%m-%d"),
            "days_since_last_activity": recency,
            "sessions_last_90d":        frequency,
            "total_spend_usd":          monetary,
            "favorite_game":            random.choice(games),
            "platform":                 random.choices(platforms, weights=p_weights)[0],
            "country":                  random.choices(countries, weights=c_weights)[0],
            "player_level":             min(100, int(frequency * random.uniform(0.8, 1.5))),
        })
    return pd.DataFrame(rows)


def score_rfm(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["R_score"] = pd.qcut(df["days_since_last_activity"], q=5, labels=[5,4,3,2,1]).astype(int)
    df["F_score"] = pd.qcut(df["sessions_last_90d"].rank(method="first"), q=5, labels=[1,2,3,4,5]).astype(int)
    df["M_score"] = pd.qcut(df["total_spend_usd"].rank(method="first"), q=5, labels=[1,2,3,4,5]).astype(int)
    df["RFM_score"] = df["R_score"].astype(str) + df["F_score"].astype(str) + df["M_score"].astype(str)
    df["RFM_total"] = df["R_score"] + df["F_score"] + df["M_score"]
    return df


def assign_segment(row) -> str:
    r, f, m = row["R_score"], row["F_score"], row["M_score"]
    if r >= 4 and f >= 4 and m >= 4:   return "Whale / VIP"
    if r >= 4 and f >= 3 and m >= 3:   return "Champion"
    if r >= 3 and f >= 3 and m >= 3:   return "Loyal Player"
    if r >= 4 and f <= 2:               return "New Player"
    if r >= 3 and f >= 3 and m <= 2:   return "Active Free Player"
    if r <= 2 and f >= 3 and m >= 3:   return "High Value Churning"
    if r <= 2 and f >= 3:              return "At Risk"
    if r == 1 and f <= 2:              return "Churned"
    if r >= 3 and f <= 2:              return "Casual"
    return "Dormant"


# ─── FORMATTING HELPERS ───────────────────────────────────────────────────────
def rgb(r, g, b):
    return {"red": r, "green": g, "blue": b}

def header_fmt(sheet_id: int, start_col: int, end_col: int) -> dict:
    return {
        "repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": 0, "endRowIndex": 1,
                      "startColumnIndex": start_col, "endColumnIndex": end_col},
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": rgb(0.12, 0.22, 0.39),
                    "textFormat": {"foregroundColor": rgb(1,1,1), "bold": True, "fontSize": 11},
                    "horizontalAlignment": "CENTER",
                    "verticalAlignment": "MIDDLE",
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        }
    }

def freeze_row(sheet_id: int) -> dict:
    return {
        "updateSheetProperties": {
            "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount",
        }
    }

def col_width(sheet_id: int, col_idx: int, px: int) -> dict:
    return {
        "updateDimensionProperties": {
            "range": {"sheetId": sheet_id, "dimension": "COLUMNS",
                      "startIndex": col_idx, "endIndex": col_idx + 1},
            "properties": {"pixelSize": px},
            "fields": "pixelSize",
        }
    }

def cell_color_fmt(sheet_id: int, row: int, col: int, bg, text_color=(0,0,0), bold=False) -> dict:
    return {
        "repeatCell": {
            "range": {"sheetId": sheet_id, "startRowIndex": row, "endRowIndex": row+1,
                      "startColumnIndex": col, "endColumnIndex": col+1},
            "cell": {
                "userEnteredFormat": {
                    "backgroundColor": rgb(*bg),
                    "textFormat": {"foregroundColor": rgb(*text_color), "bold": bold},
                }
            },
            "fields": "userEnteredFormat(backgroundColor,textFormat)",
        }
    }


# ─── SHEET WRITERS ────────────────────────────────────────────────────────────
def write_player_sheet(gc: gspread.Client, spreadsheet, df: pd.DataFrame):
    ws = spreadsheet.sheet1
    ws.update_title("Player Data")

    headers = list(df.columns)
    all_rows = [headers] + df.values.tolist()
    ws.update("A1", all_rows, value_input_option="USER_ENTERED")

    seg_col_idx = headers.index("segment")
    sheet_id    = ws.id

    requests = [header_fmt(sheet_id, 0, len(headers)), freeze_row(sheet_id)]

    # Color segment cells
    for i, seg in enumerate(df["segment"].tolist(), start=1):
        cfg = SEGMENT_COLORS.get(seg, {})
        if cfg:
            requests.append(cell_color_fmt(
                sheet_id, i, seg_col_idx,
                bg=cfg["bg"], text_color=cfg["text"], bold=True
            ))

    # Alternating row stripes (non-segment columns)
    for i in range(1, len(df) + 1):
        if i % 2 == 0:
            for c in range(len(headers)):
                if c != seg_col_idx:
                    requests.append({
                        "repeatCell": {
                            "range": {"sheetId": sheet_id, "startRowIndex": i,
                                      "endRowIndex": i+1, "startColumnIndex": c, "endColumnIndex": c+1},
                            "cell": {"userEnteredFormat": {"backgroundColor": rgb(0.95, 0.95, 0.95)}},
                            "fields": "userEnteredFormat.backgroundColor",
                        }
                    })

    spreadsheet.batch_update({"requests": requests})
    print("  ✓ Player Data sheet")


def write_summary_sheet(gc: gspread.Client, spreadsheet, df: pd.DataFrame):
    ws = spreadsheet.add_worksheet(title="Segment Summary", rows=20, cols=10)

    summary = (
        df.groupby("segment")
        .agg(
            player_count    =("player_id", "count"),
            avg_recency     =("days_since_last_activity", "mean"),
            avg_sessions    =("sessions_last_90d", "mean"),
            avg_spend       =("total_spend_usd", "mean"),
            total_revenue   =("total_spend_usd", "sum"),
        )
        .reset_index()
    )
    summary["pct_of_base"]       = (summary["player_count"] / len(df) * 100).round(1)
    summary["avg_recency"]       = summary["avg_recency"].round(1)
    summary["avg_sessions"]      = summary["avg_sessions"].round(1)
    summary["avg_spend"]         = summary["avg_spend"].round(2)
    summary["total_revenue"]     = summary["total_revenue"].round(2)
    summary["recommended_action"]= summary["segment"].map(SEGMENT_ACTIONS)
    summary["sort_key"]          = summary["segment"].map(
        lambda s: SEGMENT_ORDER.index(s) if s in SEGMENT_ORDER else 99
    )
    summary = summary.sort_values("sort_key").drop(columns="sort_key")

    headers = ["Segment", "# Players", "% of Base", "Avg Days Since Login",
               "Avg Sessions (90d)", "Avg Spend ($)", "Total Revenue ($)", "Recommended Action"]

    col_order = ["segment", "player_count", "pct_of_base", "avg_recency",
                 "avg_sessions", "avg_spend", "total_revenue", "recommended_action"]
    rows = [headers] + summary[col_order].values.tolist()
    ws.update("A1", rows, value_input_option="USER_ENTERED")

    sheet_id = ws.id
    requests = [header_fmt(sheet_id, 0, len(headers)), freeze_row(sheet_id)]

    for i, seg in enumerate(summary["segment"].tolist(), start=1):
        cfg = SEGMENT_COLORS.get(seg, {})
        if cfg:
            requests.append(cell_color_fmt(
                sheet_id, i, 0, bg=cfg["bg"], text_color=cfg["text"], bold=True
            ))

    spreadsheet.batch_update({"requests": requests})
    print("  ✓ Segment Summary sheet")


def write_kpi_sheet(gc: gspread.Client, spreadsheet, df: pd.DataFrame):
    ws = spreadsheet.add_worksheet(title="KPI Dashboard", rows=20, cols=5)

    total     = len(df)
    total_rev = df["total_spend_usd"].sum()
    vip       = df[df["segment"] == "Whale / VIP"]
    churned   = df[df["segment"].isin(["Churned", "Dormant"])]
    at_risk   = df[df["segment"].isin(["At Risk", "High Value Churning"])]
    paying    = df[df["total_spend_usd"] > 0]

    kpis = [
        ["KPI", "Value", "Notes"],
        ["Total Players",              total,                                   ""],
        ["Total Revenue ($)",          round(total_rev, 2),                     ""],
        ["Avg Revenue per Player ($)", round(total_rev / total, 2),             ""],
        ["Whales / VIPs",              len(vip),                                f"{len(vip)/total*100:.1f}% of base"],
        ["Whale Revenue ($)",          round(vip["total_spend_usd"].sum(), 2),  f"{vip['total_spend_usd'].sum()/total_rev*100:.1f}% of revenue"],
        ["Paying Players",             len(paying),                             f"{len(paying)/total*100:.1f}% conversion"],
        ["At-Risk Players",            len(at_risk),                            f"{len(at_risk)/total*100:.1f}% — take action now"],
        ["Churned + Dormant",          len(churned),                            f"{len(churned)/total*100:.1f}% of base"],
        ["Avg Days Since Login",       round(df["days_since_last_activity"].mean(), 1), "days"],
        ["Avg Sessions (90d)",         round(df["sessions_last_90d"].mean(), 1),        "sessions"],
    ]

    ws.update("A1", kpis, value_input_option="USER_ENTERED")
    sheet_id = ws.id
    requests = [header_fmt(sheet_id, 0, 3), freeze_row(sheet_id)]
    spreadsheet.batch_update({"requests": requests})
    print("  ✓ KPI Dashboard sheet")


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("Authenticating with Google...")
    gc = get_google_client()

    print("Generating player data...")
    df = generate_data(N_PLAYERS)
    df = score_rfm(df)
    df["segment"]             = df.apply(assign_segment, axis=1)
    df["recommended_action"]  = df["segment"].map(SEGMENT_ACTIONS)

    print(f"Creating Google Sheet: '{SHEET_TITLE}'...")
    spreadsheet = gc.create(SHEET_TITLE)
    spreadsheet.share(None, perm_type="anyone", role="reader")

    print("Writing sheets...")
    write_player_sheet(gc, spreadsheet, df)
    write_summary_sheet(gc, spreadsheet, df)
    write_kpi_sheet(gc, spreadsheet, df)

    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}"
    print(f"\nDone! Google Sheet is live:")
    print(url)

    print(f"\nSegment breakdown:")
    print(df["segment"].value_counts().to_string())


if __name__ == "__main__":
    main()
