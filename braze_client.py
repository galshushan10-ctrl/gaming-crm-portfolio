"""
Braze API Client — Mock + Production modes.

Mock mode (default): simulates Braze responses locally. No API key needed.
Production mode: set BRAZE_API_KEY and BRAZE_BASE_URL env vars.
  export BRAZE_API_KEY="your-key"
  export BRAZE_BASE_URL="https://rest.iad-01.braze.com"  # check your dashboard cluster

Switching from mock to production: zero code changes, only env vars.
"""

import os
import uuid
import time
import random
import json
import hashlib
from datetime import datetime
from typing import Optional

# ─── CONFIG ───────────────────────────────────────────────────────────────────
BRAZE_API_KEY  = os.environ.get("BRAZE_API_KEY", "")
BRAZE_BASE_URL = os.environ.get("BRAZE_BASE_URL", "https://rest.iad-01.braze.com")
MOCK_MODE      = not bool(BRAZE_API_KEY)

if MOCK_MODE:
    print("[BrazeClient] Running in MOCK mode — no API key set.")
    print("[BrazeClient] To use real Braze: export BRAZE_API_KEY='your-key'\n")


class BrazeClient:
    """
    Unified client for Braze API calls.
    In mock mode: returns realistic simulated responses.
    In production mode: makes real HTTP calls to Braze REST API.
    """

    def __init__(self):
        self.mock   = MOCK_MODE
        self.api_key = BRAZE_API_KEY
        self.base_url = BRAZE_BASE_URL
        self._mock_sends = []  # local log for mock mode

    # ── User attribute update ─────────────────────────────────────────────────
    def track_users(self, attributes: list[dict]) -> dict:
        """
        Update player attributes in Braze (segment, offer_type, propensity, etc.)
        Braze endpoint: POST /users/track

        attributes: list of dicts with 'external_id' + attribute key/values
        """
        if self.mock:
            return {
                "message": "success",
                "attributes_processed": len(attributes),
                "dispatch_id": str(uuid.uuid4()),
                "mock": True,
            }

        import requests
        response = requests.post(
            f"{self.base_url}/users/track",
            headers={"Authorization": f"Bearer {self.api_key}",
                     "Content-Type": "application/json"},
            json={"attributes": attributes},
            timeout=10,
        )
        return response.json()

    # ── Campaign send ──────────────────────────────────────────────────────────
    def send_campaign(self,
                      campaign_id: str,
                      recipients: list[dict],
                      message_variation_id: Optional[str] = None) -> dict:
        """
        Trigger a campaign send to specific users.
        Braze endpoint: POST /campaigns/trigger/send

        In production: campaign_id is the Braze Campaign ID from your dashboard.
        In mock: logs the send and returns simulated response.
        """
        if self.mock:
            dispatch_id = str(uuid.uuid4())
            self._mock_sends.append({
                "dispatch_id":     dispatch_id,
                "campaign_id":     campaign_id,
                "recipients":      len(recipients),
                "variation":       message_variation_id,
                "timestamp":       datetime.utcnow().isoformat(),
            })
            return {
                "message":     "success",
                "dispatch_id": dispatch_id,
                "recipients":  len(recipients),
                "mock":        True,
            }

        import requests
        payload = {
            "campaign_id": campaign_id,
            "recipients":  recipients,
        }
        if message_variation_id:
            payload["message_variation_id"] = message_variation_id

        response = requests.post(
            f"{self.base_url}/campaigns/trigger/send",
            headers={"Authorization": f"Bearer {self.api_key}",
                     "Content-Type": "application/json"},
            json=payload,
            timeout=10,
        )
        return response.json()

    # ── Canvas trigger ────────────────────────────────────────────────────────
    def trigger_canvas(self, canvas_id: str, recipients: list[dict],
                       canvas_entry_properties: Optional[dict] = None) -> dict:
        """
        Enter users into a Braze Canvas (multi-step flow).
        Braze endpoint: POST /canvas/trigger/send

        In production: canvas_id is the Braze Canvas ID.
        """
        if self.mock:
            dispatch_id = str(uuid.uuid4())
            return {
                "message":     "success",
                "dispatch_id": dispatch_id,
                "canvas_id":   canvas_id,
                "recipients":  len(recipients),
                "mock":        True,
            }

        import requests
        payload = {
            "canvas_id":  canvas_id,
            "recipients": recipients,
        }
        if canvas_entry_properties:
            payload["canvas_entry_properties"] = canvas_entry_properties

        response = requests.post(
            f"{self.base_url}/canvas/trigger/send",
            headers={"Authorization": f"Bearer {self.api_key}",
                     "Content-Type": "application/json"},
            json=payload,
            timeout=10,
        )
        return response.json()

    # ── Export mock log ───────────────────────────────────────────────────────
    def get_mock_log(self) -> list[dict]:
        return self._mock_sends


# ── Canvas IDs ────────────────────────────────────────────────────────────────
# In production: replace these with your actual Braze Canvas/Campaign IDs.
# Find them in Braze Dashboard → Campaigns/Canvases → Settings → API Identifier.

CANVAS_IDS = {
    "PURCHASE_OFFER":         "canvas_purchase_offer_001",
    "BROKE_OFFER":            "canvas_broke_offer_001",
    "CONSOLATION_THEN_OFFER": "canvas_consolation_001",
    "WIN_BACK":               "canvas_winback_001",
    "VIP_TEASER":             "canvas_vip_teaser_001",
    "NONE":                   None,
}

CAMPAIGN_IDS = {
    "PURCHASE_OFFER":         "campaign_purchase_001",
    "BROKE_OFFER":            "campaign_broke_001",
    "CONSOLATION_THEN_OFFER": "campaign_consolation_001",
    "WIN_BACK":               "campaign_winback_001",
    "VIP_TEASER":             "campaign_vip_001",
}
