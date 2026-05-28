"""
A/B Test Tracker
Deterministic variant assignment (same player always gets same variant).
Tracks assignments in Google Sheets for analysis.
"""

import hashlib
import pandas as pd
from datetime import datetime

# ── A/B Test definitions per offer type ──────────────────────────────────────
AB_TESTS = {
    "PURCHASE_OFFER": {
        "test_name": "Purchase Offer — Price vs Value Framing",
        "variants": {
            "A": {"name": "Price Anchor",  "desc": "X chips for $0.99 (was $4.99)"},
            "B": {"name": "Value Anchor",  "desc": "X chips = 3 hours of gameplay"},
        },
        "primary_metric":   "purchase_conversion_rate",
        "secondary_metric": "revenue_per_send",
        "min_sample_size":  100,
    },
    "BROKE_OFFER": {
        "test_name": "Broke Player — Single Pack vs Bundle",
        "variants": {
            "A": {"name": "Single Pack",  "desc": "Get back in the game — X chips for $1.99"},
            "B": {"name": "Bundle",       "desc": "Best value: 2x chips + VIP badge for $2.99"},
        },
        "primary_metric":   "purchase_conversion_rate",
        "secondary_metric": "avg_revenue_per_converter",
        "min_sample_size":  100,
    },
    "CONSOLATION_THEN_OFFER": {
        "test_name": "Consolation Timing — Immediate vs 30-min delay",
        "variants": {
            "A": {"name": "Consolation Only",     "desc": "Free chips + no upsell (pure goodwill)"},
            "B": {"name": "Consolation + Offer",  "desc": "Free chips → 30min → purchase offer"},
        },
        "primary_metric":   "session_retention_rate",
        "secondary_metric": "purchase_conversion_rate",
        "min_sample_size":  50,
    },
    "WIN_BACK": {
        "test_name": "Win-back — Chip Volume vs Social Proof",
        "variants": {
            "A": {"name": "Big Chips",      "desc": "50M chips waiting for you"},
            "B": {"name": "Social Proof",   "desc": "1,200 players came back this week — join them"},
        },
        "primary_metric":   "re_login_rate_48h",
        "secondary_metric": "purchase_within_7d",
        "min_sample_size":  50,
    },
    "VIP_TEASER": {
        "test_name": "VIP Engagement — Badge vs Leaderboard",
        "variants": {
            "A": {"name": "VIP Badge",       "desc": "You're in the top 5% — claim your VIP badge"},
            "B": {"name": "Leaderboard",     "desc": "See where you rank vs. top players"},
        },
        "primary_metric":   "feature_engagement_rate",
        "secondary_metric": "purchase_within_14d",
        "min_sample_size":  100,
    },
}


def assign_variant(player_id: str, offer_type: str) -> str:
    """
    Deterministic variant assignment using hash of player_id + offer_type.
    Same player always gets the same variant for the same offer type.
    50/50 split.
    """
    if offer_type not in AB_TESTS:
        return "A"

    test = AB_TESTS[offer_type]
    variants = list(test["variants"].keys())

    h = int(hashlib.md5(f"{player_id}_{offer_type}".encode()).hexdigest(), 16)
    return variants[h % len(variants)]


def build_ab_assignments(df: pd.DataFrame) -> pd.DataFrame:
    """Add ab_variant column based on offer_type."""
    df = df.copy()
    df["ab_variant"] = df.apply(
        lambda r: assign_variant(str(r.get("player_id", "")),
                                 str(r.get("offer_type", ""))),
        axis=1
    )
    df["ab_test_name"] = df["offer_type"].map(
        lambda o: AB_TESTS.get(o, {}).get("test_name", "N/A")
    )
    df["ab_variant_desc"] = df.apply(
        lambda r: AB_TESTS.get(r.get("offer_type", ""), {})
                          .get("variants", {})
                          .get(r["ab_variant"], {})
                          .get("desc", ""),
        axis=1
    )
    return df


def get_ab_summary(df: pd.DataFrame) -> pd.DataFrame:
    """Return a summary table of variant splits per offer type."""
    rows = []
    for offer_type in df["offer_type"].unique():
        if offer_type not in AB_TESTS:
            continue
        subset = df[df["offer_type"] == offer_type]
        test   = AB_TESTS[offer_type]
        total  = len(subset)
        min_n  = test["min_sample_size"]
        valid  = "✓ Valid" if total >= min_n else f"✗ Need {min_n - total} more"

        for variant, info in test["variants"].items():
            count = (subset["ab_variant"] == variant).sum()
            rows.append({
                "offer_type":       offer_type,
                "test_name":        test["test_name"],
                "variant":          variant,
                "variant_name":     info["name"],
                "variant_desc":     info["desc"],
                "sample_size":      count,
                "total_in_test":    total,
                "statistical_validity": valid,
                "primary_metric":   test["primary_metric"],
            })
    return pd.DataFrame(rows)
