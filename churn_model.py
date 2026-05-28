"""
Churn Prediction Model
Reads the existing RFM Google Sheet, adds churn probability per player,
and writes results to a new "Churn Prediction" sheet.
"""

import pandas as pd
import numpy as np
import pickle
import os
import gspread
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score

# ─── CONFIG ───────────────────────────────────────────────────────────────────
CREDENTIALS = "/Users/galshushan/Agent- add more space in drive/credentials.json"
TOKEN_FILE  = "/Users/galshushan/Agent- add more space in drive/crm-portfolio/gaming-rfm/token_sheets.pkl"
SHEET_TITLE = "Gaming RFM Segmentation Report"
# If multiple sheets exist with same name, gspread opens the first one.
# Update this to the exact sheet URL if needed.

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]

CHURN_SEGMENTS = {"Churned", "Dormant", "High Value Churning", "At Risk"}

# Player type config — urgency 1 (lowest) to 5 (highest)
PLAYER_TYPE_CONFIG = {
    "Active Payer": {
        "urgency": 2, "color": (0.0, 0.6, 0.2),   "text": (1,1,1),
        "offer": "VIP loyalty reward + early access to new slots",
        "channel": "Push + Email",
        "goal": "Retain & upsell to next spend tier",
    },
    "Revenue Churning Payer": {
        "urgency": 5, "color": (0.85, 0.0, 0.0),   "text": (1,1,1),
        "offer": "Match their last purchase amount as bonus chips — personal offer",
        "channel": "Push + Email + In-app on next login",
        "goal": "Re-activate purchase behavior before full churn",
    },
    "Lapsed Payer": {
        "urgency": 5, "color": (0.7, 0.0, 0.0),    "text": (1,1,1),
        "offer": "Win-back: 20M chips + 50% off first purchase back",
        "channel": "Email series (day 1 / day 7 / day 30)",
        "goal": "Bring back paying player",
    },
    "F2P Active": {
        "urgency": 3, "color": (0.0, 0.44, 0.75),  "text": (1,1,1),
        "offer": "Starter pack $0.99 — chips + VIP badge for 7 days",
        "channel": "In-app + Push",
        "goal": "First purchase conversion (1-3% target)",
    },
    "F2P Lapsing": {
        "urgency": 4, "color": (1.0, 0.55, 0.0),   "text": (0,0,0),
        "offer": "Chip scarcity rescue: 5M free chips — limited 24h",
        "channel": "Push (urgency) + Email",
        "goal": "Re-engage before full churn — last conversion window",
    },
    "Non-entrant": {
        "urgency": 1, "color": (0.5, 0.5, 0.5),    "text": (1,1,1),
        "offer": "Day 30: 10M free chips | Day 60: 25M chips | Day 90: sunset",
        "channel": "Email win-back series",
        "goal": "Re-engagement or sunset",
    },
}

RISK_COLORS = {
    "High":   {"bg": (1.0, 0.2, 0.2),  "text": (1, 1, 1)},
    "Medium": {"bg": (1.0, 0.65, 0.0), "text": (0, 0, 0)},
    "Low":    {"bg": (0.2, 0.75, 0.2), "text": (1, 1, 1)},
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


# ─── LOAD DATA FROM SHEET ─────────────────────────────────────────────────────
def load_player_data(gc: gspread.Client) -> tuple[pd.DataFrame, gspread.Spreadsheet]:
    print(f"Opening sheet: '{SHEET_TITLE}'...")
    spreadsheet = gc.open(SHEET_TITLE)
    ws = spreadsheet.worksheet("Player Data")
    records = ws.get_all_records()
    df = pd.DataFrame(records)
    print(f"  Loaded {len(df)} players")
    return df, spreadsheet


# ─── CHURN MODEL ──────────────────────────────────────────────────────────────
def build_churn_model(df: pd.DataFrame) -> pd.DataFrame:
    """
    Personalized churn detection based on each player's own login cadence.

    Core idea:
      personal_cadence = 90 / sessions_last_90d  (avg days between logins)
      expected_next_login = days_since_last_activity - personal_cadence
      overdue_ratio = days_since_last_activity / personal_cadence

      overdue_ratio < 1.0  → still within their normal window (not at risk)
      overdue_ratio 1.0–1.5 → slightly overdue (soft signal)
      overdue_ratio 1.5–2.0 → at risk
      overdue_ratio > 2.0  → high risk

    Cold start (< MIN_SESSIONS): not enough personal data.
      Use p60 cadence of active players as benchmark. p60 chosen over
      mean to avoid whales pulling the benchmark too low.

    Purchase signal (separate):
      IN PRODUCTION: use real purchase event timestamps.
      HERE: we simulate purchase_count from total_spend_usd as a proxy.
      purchase_cadence = 90 / purchase_count
      purchase_overdue_ratio = days_since_last_purchase / purchase_cadence

    Combined risk score = 0.65 * activity_overdue + 0.35 * purchase_overdue
    Weights reflect that activity = survival, purchase = revenue.
    """
    MIN_SESSIONS = 5  # minimum sessions for personal cadence to be reliable
    df = df.copy()

    # ── Activity cadence ──────────────────────────────────────────────────────
    df["personal_cadence"] = (90 / df["sessions_last_90d"].clip(lower=1)).round(1)
    df["has_personal_data"] = df["sessions_last_90d"] >= MIN_SESSIONS

    # p60 of active players (>= MIN_SESSIONS) as cold-start benchmark
    active_mask = df["sessions_last_90d"] >= MIN_SESSIONS
    population_p60_cadence = df.loc[active_mask, "personal_cadence"].quantile(0.60)
    print(f"  Population p60 login cadence (active players): {population_p60_cadence:.1f} days")

    # Players with enough data use their own cadence; others use p60 benchmark
    df["effective_cadence"] = np.where(
        df["has_personal_data"],
        df["personal_cadence"],
        population_p60_cadence
    )

    # days_overdue: negative = still within window, positive = missed expected login
    df["days_overdue"] = (df["days_since_last_activity"] - df["effective_cadence"]).round(1)

    # overdue_ratio: > 1.0 means they've exceeded their normal window
    df["activity_overdue_ratio"] = (
        df["days_since_last_activity"] / df["effective_cadence"]
    ).round(2)

    # ── Purchase cadence ──────────────────────────────────────────────────────
    # IN PRODUCTION: replace with real purchase event data
    # purchase_count = query("SELECT count(*) FROM purchases WHERE player_id=? AND date > now()-90d")
    # days_since_last_purchase = query("SELECT datediff(now(), max(purchase_date)) FROM purchases WHERE player_id=?")
    #
    # HERE: simulate from total_spend_usd as proxy
    np.random.seed(42)
    avg_purchase_value = 15  # assumed avg transaction size in USD
    df["purchase_count_90d"] = (
        (df["total_spend_usd"] / avg_purchase_value)
        .clip(lower=0)
        .apply(lambda x: max(0, int(np.random.poisson(x))) if x > 0 else 0)
    )
    df["days_since_last_purchase"] = (
        df["days_since_last_activity"] +
        np.random.randint(0, 15, size=len(df))
    ).clip(upper=90)

    df["purchase_cadence"] = np.where(
        df["purchase_count_90d"] >= 2,
        (90 / df["purchase_count_90d"].clip(lower=1)).round(1),
        population_p60_cadence * 3  # non-paying players: very high cadence = low risk signal
    )
    df["purchase_overdue_ratio"] = (
        df["days_since_last_purchase"] / df["purchase_cadence"]
    ).clip(upper=5).round(2)

    # ── Player type classification ────────────────────────────────────────────
    # activity_ok: player is within their normal login window
    # is_payer: has spent money (in production: any purchase in last 90 days)
    # purchase_ok: purchase cadence not exceeded (still buying at normal rate)
    df["is_payer"]      = df["total_spend_usd"] > 0
    df["activity_ok"]   = df["activity_overdue_ratio"] <= 1.5
    df["purchase_ok"]   = df["purchase_overdue_ratio"] <= 1.5

    def classify_player(row):
        active   = row["activity_ok"]
        payer    = row["is_payer"]
        buying   = row["purchase_ok"]

        if active and payer and buying:     return "Active Payer"
        if active and payer and not buying: return "Revenue Churning Payer"
        if not active and payer:            return "Lapsed Payer"
        if active and not payer:            return "F2P Active"
        if not active and not payer:
            # Distinguish: was recently active F2P vs fully gone
            if row["activity_overdue_ratio"] < 3.0: return "F2P Lapsing"
            return "Non-entrant"
        return "Non-entrant"

    df["player_type"] = df.apply(classify_player, axis=1)
    df["offer"]       = df["player_type"].map(lambda t: PLAYER_TYPE_CONFIG[t]["offer"])
    df["channel"]     = df["player_type"].map(lambda t: PLAYER_TYPE_CONFIG[t]["channel"])
    df["crm_goal"]    = df["player_type"].map(lambda t: PLAYER_TYPE_CONFIG[t]["goal"])
    df["urgency"]     = df["player_type"].map(lambda t: PLAYER_TYPE_CONFIG[t]["urgency"])

    # ── Combined risk score ───────────────────────────────────────────────────
    # Payers: weight purchase signal more heavily — that's where revenue is
    # F2P: weight activity more — need them engaged before conversion
    payer_mask = df["is_payer"]
    df["risk_score"] = np.where(
        payer_mask,
        0.50 * df["activity_overdue_ratio"] + 0.50 * df["purchase_overdue_ratio"],
        0.80 * df["activity_overdue_ratio"] + 0.20 * df["purchase_overdue_ratio"]
    ).round(3)

    # ── Activity risk label ───────────────────────────────────────────────────
    df["churn_risk"] = pd.cut(
        df["activity_overdue_ratio"],
        bins=[0, 1.0, 1.5, 2.0, float("inf")],
        labels=["On Track", "Soft Signal", "At Risk", "High Risk"]
    ).astype(str)

    # ── Churn label for model training ───────────────────────────────────────
    df["churned_label"] = (
        (df["activity_overdue_ratio"] > 2.0) |
        (df["segment"].isin(CHURN_SEGMENTS))
    ).astype(int)

    noise_mask = np.random.random(len(df)) < 0.04
    df.loc[noise_mask, "churned_label"] = 1 - df.loc[noise_mask, "churned_label"]

    # Features
    features = [
        "days_since_last_activity", "sessions_last_90d",
        "total_spend_usd", "player_level",
        "R_score", "F_score", "M_score",
        "activity_overdue_ratio", "purchase_overdue_ratio",
        "effective_cadence", "risk_score",
    ]

    X = df[features].fillna(0)
    y = df["churned_label"]

    # Train / test split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    model = LogisticRegression(max_iter=500, random_state=42)
    model.fit(X_train_s, y_train)

    auc = roc_auc_score(y_test, model.predict_proba(X_test_s)[:, 1])
    print(f"  Model AUC: {auc:.3f}")

    # Score all players
    X_all_s = scaler.transform(X.values)
    df["churn_probability"] = model.predict_proba(X_all_s)[:, 1].round(3)

    # Risk label
    df["churn_risk"] = pd.cut(
        df["churn_probability"],
        bins=[0, 0.35, 0.65, 1.0],
        labels=["Low", "Medium", "High"]
    ).astype(str)

    # Expected revenue at risk
    df["revenue_at_risk_usd"] = (df["churn_probability"] * df["total_spend_usd"]).round(2)

    return df


# ─── WRITE CHURN SHEET ────────────────────────────────────────────────────────
def write_churn_sheet(spreadsheet: gspread.Spreadsheet, df: pd.DataFrame):
    # Remove existing sheet if present
    try:
        old = spreadsheet.worksheet("Churn Prediction")
        spreadsheet.del_worksheet(old)
    except gspread.exceptions.WorksheetNotFound:
        pass

    ws = spreadsheet.add_worksheet(title="Churn Prediction", rows=len(df) + 5, cols=10)

    output_cols = [
        "player_id", "player_type", "urgency", "churn_risk", "churn_probability",
        "activity_overdue_ratio", "days_overdue", "effective_cadence",
        "purchase_overdue_ratio", "risk_score",
        "days_since_last_activity", "sessions_last_90d",
        "total_spend_usd", "revenue_at_risk_usd",
        "offer", "channel", "crm_goal",
        "platform", "country"
    ]
    out = df[output_cols].sort_values(["urgency", "risk_score"], ascending=[False, False])

    headers = [
        "Player ID", "Player Type", "Urgency (1-5)", "Activity Risk", "Churn Probability",
        "Activity Overdue (x cadence)", "Days Overdue", "Personal Cadence (days)",
        "Purchase Overdue (x cadence)", "Combined Risk Score",
        "Days Since Login", "Sessions (90d)",
        "Total Spend ($)", "Revenue at Risk ($)",
        "Recommended Offer", "Channel", "CRM Goal",
        "Platform", "Country"
    ]

    rows = [headers] + out.values.tolist()
    ws.update("A1", rows, value_input_option="USER_ENTERED")

    sheet_id = ws.id
    requests = []

    # Header styling
    requests.append({
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
    })

    # Freeze header
    requests.append({
        "updateSheetProperties": {
            "properties": {"sheetId": sheet_id, "gridProperties": {"frozenRowCount": 1}},
            "fields": "gridProperties.frozenRowCount",
        }
    })

    # Color risk cells (column D = index 3)
    risk_col = output_cols.index("churn_risk")
    type_col = output_cols.index("player_type")
    for i, ptype in enumerate(out["player_type"].tolist(), start=1):
        cfg = PLAYER_TYPE_CONFIG.get(ptype, {})
        if cfg:
            bg, txt = cfg["color"], cfg["text"]
            requests.append({
                "repeatCell": {
                    "range": {"sheetId": sheet_id, "startRowIndex": i, "endRowIndex": i+1,
                              "startColumnIndex": type_col, "endColumnIndex": type_col+1},
                    "cell": {
                        "userEnteredFormat": {
                            "backgroundColor": {"red": bg[0], "green": bg[1], "blue": bg[2]},
                            "textFormat": {"foregroundColor": {"red": txt[0], "green": txt[1],
                                                               "blue": txt[2]}, "bold": True},
                            "horizontalAlignment": "CENTER",
                        }
                    },
                    "fields": "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
                }
            })

    spreadsheet.batch_update({"requests": requests})

    # Summary stats
    total_at_risk = out["revenue_at_risk_usd"].sum()
    print(f"\n  Player Type Breakdown:")
    for ptype, count in out["player_type"].value_counts().items():
        urgency = PLAYER_TYPE_CONFIG[ptype]["urgency"]
        rev = out.loc[out["player_type"] == ptype, "revenue_at_risk_usd"].sum()
        print(f"    [{urgency}★] {ptype:<30} {count:>4} players  |  ${rev:>8,.0f} at risk")
    print(f"\n    Total revenue at risk: ${total_at_risk:,.0f}")
    print("  ✓ Churn Prediction sheet written")

    return out


# ─── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print("Authenticating...")
    gc = get_client()

    df, spreadsheet = load_player_data(gc)

    print("Training churn model...")
    df = build_churn_model(df)

    print("Writing results to Google Sheet...")
    write_churn_sheet(spreadsheet, df)

    url = f"https://docs.google.com/spreadsheets/d/{spreadsheet.id}"
    print(f"\nDone! Sheet updated: {url}")


if __name__ == "__main__":
    main()
