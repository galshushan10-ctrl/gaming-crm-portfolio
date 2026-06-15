"""
שלב 3: שליחת תמונות שזוהו ב-WhatsApp אישי דרך Twilio
"""

import os
from pathlib import Path
from twilio.rest import Client


def get_client() -> Client:
    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    if not account_sid or not auth_token:
        raise EnvironmentError(
            "חסרים פרטי Twilio.\n"
            "הגדר: TWILIO_ACCOUNT_SID ו-TWILIO_AUTH_TOKEN\n"
            "ראה: https://console.twilio.com"
        )
    return Client(account_sid, auth_token)


def send_photo(
    image_path: str,
    daughter_names: list[str],
    media_url: str,
    to_number: str = None,
    from_number: str = None,
) -> str:
    """
    שולח תמונה ב-WhatsApp דרך Twilio.

    media_url: URL ציבורי לתמונה (Twilio מושך מ-URL, לא מקובץ מקומי)
    לאפשרות העלאה ל-ngrok/S3 ראה את הפונקציה upload_and_send.
    """
    client = get_client()
    to = to_number or os.environ.get("WHATSAPP_TO")
    from_ = from_number or os.environ.get("WHATSAPP_FROM", "whatsapp:+14155238886")

    if not to:
        raise EnvironmentError("הגדר WHATSAPP_TO עם מספר הטלפון שלך (בפורמט +972...)")

    names_str = ", ".join(daughter_names)
    body = f"📸 מהגן – {names_str} בתמונה!"

    message = client.messages.create(
        from_=f"whatsapp:{from_}",
        to=f"whatsapp:{to}",
        body=body,
        media_url=[media_url],
    )
    return message.sid


def send_matched_photos_via_cloudinary(matched_results: list[dict]) -> None:
    """
    גרסה מלאה: מעלה לCloudinary ושולחת ב-WhatsApp.
    דורש CLOUDINARY_URL בנוסף לפרטי Twilio.
    """
    import cloudinary
    import cloudinary.uploader

    cloudinary.config(from_env=True)

    for result in matched_results:
        image_path = result["dest"]
        daughter_names = [name for name, _ in result["daughters"]]

        upload = cloudinary.uploader.upload(
            image_path,
            folder="gan_photos",
            resource_type="image",
        )
        public_url = upload["secure_url"]

        sid = send_photo(
            image_path=image_path,
            daughter_names=daughter_names,
            media_url=public_url,
        )
        print(f"✅ נשלח: {Path(image_path).name} → WhatsApp (sid: {sid})")


def send_text_summary(matched_results: list[dict]) -> None:
    """שולח סיכום טקסטואלי בלי תמונות (לבדיקה ראשונית)"""
    client = get_client()
    to = os.environ.get("WHATSAPP_TO")
    from_ = os.environ.get("WHATSAPP_FROM", "whatsapp:+14155238886")

    if not matched_results:
        return

    lines = [f"📸 נמצאו {len(matched_results)} תמונות מהגן:\n"]
    for r in matched_results:
        names = ", ".join(n for n, _ in r["daughters"])
        lines.append(f"• {Path(r['dest']).name}: {names}")

    body = "\n".join(lines)

    client.messages.create(
        from_=f"whatsapp:{from_}",
        to=f"whatsapp:{to}",
        body=body,
    )
    print(f"✅ נשלח סיכום ל-WhatsApp")
