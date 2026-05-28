"""
Campaign Results Simulator
Simulates realistic open/click/conversion rates based on:
- Player's purchase propensity score
- Offer type
- A/B variant
- Channel

In production: replace simulate_results() with real Braze webhook data
or a query to your analytics DB.
"""

import numpy as np
import pandas as pd
from datetime import datetime


# ── Baseline rates per offer type ─────────────────────────────────────────────
# Based on industry benchmarks for social casino (Huuuge Casino segment)
OFFER_BASELINES = {
    "PURCHASE_OFFER": {
        "push_open_rate":   0.18,
        "email_open_rate":  0.28,
        "click_rate":       0.12,
        "conversion_rate":  0.08,   # % who purchase after seeing offer
        "avg_revenue_usd":  3.50,
    },
    "BROKE_OFFER": {
        "push_open_rate":   0.25,   # higher — urgent for them
        "email_open_rate":  0.22,
        "click_rate":       0.18,
        "conversion_rate":  0.14,   # highest — they NEED chips to play
        "avg_revenue_usd":  2.99,
    },
    "CONSOLATION_THEN_OFFER": {
        "push_open_rate":   0.30,   # emotional — they respond to empathy
        "email_open_rate":  0.25,
        "click_rate":       0.20,
        "conversion_rate":  0.06,   # lower — still recovering emotionally
        "avg_revenue_usd":  4.50,
    },
    "WIN_BACK": {
        "push_open_rate":   0.12,
        "email_open_rate":  0.15,
        "click_rate":       0.06,
        "conversion_rate":  0.03,   # hardest to convert — they left for a reason
        "avg_revenue_usd":  1.99,
    },
    "VIP_TEASER": {
        "push_open_rate":   0.22,
        "email_open_rate":  0.32,   # ego appeal — high open
        "click_rate":       0.14,
        "conversion_rate":  0.05,   # engagement, not direct purchase
        "avg_revenue_usd":  8.00,   # when they do buy, it's bigger
    },
    "NONE": {
        "push_open_rate":   0.0,
        "email_open_rate":  0.0,
        "click_rate":       0.0,
        "conversion_rate":  0.0,
        "avg_revenue_usd":  0.0,
    },
}

# A/B variant lift — how much better/worse is each variant vs baseline
VARIANT_LIFT = {
    "PURCHASE_OFFER":   {"A": 1.0,  "B": 1.12},  # B (value anchor) slightly better
    "BROKE_OFFER":      {"A": 1.0,  "B": 0.95},  # A (simple) wins when desperate
    "CONSOLATION_THEN_OFFER": {"A": 0.85, "B": 1.15},  # B (with offer) wins
    "WIN_BACK":         {"A": 1.0,  "B": 1.20},  # B (social proof) wins
    "VIP_TEASER":       {"A": 1.15, "B": 1.0},   # A (badge) wins on ego
}


def simulate_results(df: pd.DataFrame, random_seed: int = 99) -> pd.DataFrame:
    """
    Simulate campaign results for each player.
    Uses purchase_propensity to modulate baseline rates.
    Players with higher propensity are more likely to open, click, convert.

    In production: replace with:
      SELECT player_id, opened, clicked, converted, revenue
      FROM braze_campaign_events
      WHERE campaign_id IN (...) AND date > '...'
    """
    np.random.seed(random_seed)
    df = df.copy()

    results = []
    for _, row in df.iterrows():
        offer = str(row.get("offer_type", "NONE"))
        variant = str(row.get("ab_variant", "A"))
        propensity = float(row.get("purchase_propensity", 0.1))
        channel = str(row.get("trigger_channel", "Push"))

        base = OFFER_BASELINES.get(offer, OFFER_BASELINES["NONE"])
        lift = VARIANT_LIFT.get(offer, {}).get(variant, 1.0)

        # Propensity multiplier — scales between 0.3x and 2.5x
        prop_mult = 0.3 + propensity * 2.2

        push_rate  = min(base["push_open_rate"]  * lift * prop_mult, 0.85)
        email_rate = min(base["email_open_rate"] * lift * prop_mult, 0.80)
        click_rate = min(base["click_rate"]      * lift * prop_mult, 0.70)
        conv_rate  = min(base["conversion_rate"] * lift * prop_mult, 0.60)

        # Simulate individual outcomes (Bernoulli draws)
        channel_lower = channel.lower()
        push_sent    = "push" in channel_lower
        email_sent   = "email" in channel_lower
        inapp_sent   = "in-app" in channel_lower or "in_app" in channel_lower

        push_opened  = push_sent  and np.random.random() < push_rate
        email_opened = email_sent and np.random.random() < email_rate
        clicked      = (push_opened or email_opened or inapp_sent) and np.random.random() < click_rate
        converted    = clicked and np.random.random() < conv_rate

        revenue = 0.0
        if converted:
            # Revenue varies around avg with log-normal distribution
            avg_rev = base["avg_revenue_usd"]
            revenue = max(0.99, np.random.lognormal(np.log(avg_rev), 0.4))
            revenue = round(revenue, 2)

        results.append({
            "push_sent":    push_sent,
            "email_sent":   email_sent,
            "inapp_sent":   inapp_sent,
            "push_opened":  push_opened,
            "email_opened": email_opened,
            "any_opened":   push_opened or email_opened,
            "clicked":      clicked,
            "converted":    converted,
            "revenue_usd":  revenue,
        })

    results_df = pd.DataFrame(results)
    return pd.concat([df.reset_index(drop=True), results_df.reset_index(drop=True)], axis=1)


def get_campaign_summary(df: pd.DataFrame) -> pd.DataFrame:
    """
    Aggregate campaign results by offer_type + variant.
    This is what you'd review in your weekly CRM meeting.
    """
    rows = []
    for (offer, variant), group in df.groupby(["offer_type", "ab_variant"]):
        if offer == "NONE":
            continue
        sent      = len(group)
        opened    = group["any_opened"].sum()
        clicked   = group["clicked"].sum()
        converted = group["converted"].sum()
        revenue   = group["revenue_usd"].sum()

        rows.append({
            "offer_type":          offer,
            "variant":             variant,
            "sent":                sent,
            "opened":              opened,
            "open_rate":           round(opened / sent, 3) if sent > 0 else 0,
            "clicks":              clicked,
            "ctr":                 round(clicked / opened, 3) if opened > 0 else 0,
            "conversions":         converted,
            "conversion_rate":     round(converted / sent, 3) if sent > 0 else 0,
            "total_revenue_usd":   round(revenue, 2),
            "revenue_per_send":    round(revenue / sent, 2) if sent > 0 else 0,
            "revenue_per_convert": round(revenue / converted, 2) if converted > 0 else 0,
        })

    return pd.DataFrame(rows).sort_values(["offer_type", "variant"])


def get_ab_winner(summary_df: pd.DataFrame) -> pd.DataFrame:
    """Determine which A/B variant is winning per offer type."""
    rows = []
    for offer, group in summary_df.groupby("offer_type"):
        if len(group) < 2:
            continue
        a = group[group["variant"] == "A"].iloc[0] if len(group[group["variant"] == "A"]) > 0 else None
        b = group[group["variant"] == "B"].iloc[0] if len(group[group["variant"] == "B"]) > 0 else None

        if a is None or b is None:
            continue

        # Primary metric: conversion_rate
        a_conv = a["conversion_rate"]
        b_conv = b["conversion_rate"]
        lift   = round((b_conv - a_conv) / a_conv * 100, 1) if a_conv > 0 else 0

        winner   = "B" if b_conv > a_conv else "A"
        min_size = 100  # simplified — real stat sig needs power calculation

        rows.append({
            "offer_type":           offer,
            "variant_A_conv_rate":  a_conv,
            "variant_B_conv_rate":  b_conv,
            "lift_pct":             lift,
            "winner":               winner,
            "confidence":           "High" if min(a["sent"], b["sent"]) >= min_size else "Low — need more data",
            "recommendation":       f"Scale Variant {winner}" if min(a["sent"], b["sent"]) >= min_size else "Keep running",
        })

    return pd.DataFrame(rows)
