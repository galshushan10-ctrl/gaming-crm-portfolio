"""
עוזר לשמור תמונות ייחוס מ-URL או Google Drive לתיקיית reference_photos.
שימוש: python save_reference.py <שם_בת> <url1> [url2] ...
"""

import sys
import requests
from pathlib import Path

REFERENCE_DIR = Path("reference_photos")
REFERENCE_DIR.mkdir(exist_ok=True)

SUPPORTED = {".jpg", ".jpeg", ".png", ".webp"}


def save_from_url(name: str, url: str, index: int) -> bool:
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        r.raise_for_status()
        content_type = r.headers.get("content-type", "")
        ext = ".jpg" if "jpeg" in content_type or "jpg" in content_type else \
              ".png" if "png" in content_type else \
              ".webp" if "webp" in content_type else ".jpg"
        dest = REFERENCE_DIR / f"{name}_{index}{ext}"
        dest.write_bytes(r.content)
        print(f"  ✅ נשמר: {dest}")
        return True
    except Exception as e:
        print(f"  ❌ שגיאה ב-{url}: {e}")
        return False


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("שימוש: python save_reference.py <שם_בת> <url1> [url2] ...")
        print("דוגמה: python save_reference.py gafan https://... https://...")
        sys.exit(1)

    name = sys.argv[1]
    urls = sys.argv[2:]
    print(f"שומר {len(urls)} תמונות של {name}...")
    for i, url in enumerate(urls):
        save_from_url(name, url, i + 1)

    print(f"\nכעת הרץ: python setup_daughters.py")
