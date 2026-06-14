"""
שלב 1: רישום תמונות הבנות
הרץ את הסקריפט הזה פעם אחת עם תמונות של הבנות שלך.
"""

import face_recognition
import pickle
import os
import sys
from pathlib import Path

REFERENCE_DIR = Path("reference_photos")
ENCODINGS_FILE = Path("daughters_encodings.pkl")


def register_daughters():
    if not REFERENCE_DIR.exists() or not list(REFERENCE_DIR.iterdir()):
        print(f"❌ שים תמונות של הבנות בתיקייה: {REFERENCE_DIR.absolute()}")
        print("   שם הקובץ = שם הבת, למשל: maya.jpg, noa.jpg, shira.png")
        return

    daughters = {}
    failed = []

    for img_path in sorted(REFERENCE_DIR.iterdir()):
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue

        name = img_path.stem  # שם הקובץ בלי סיומת = שם הבת
        print(f"  מעבד תמונה של {name}... ", end="", flush=True)

        image = face_recognition.load_image_file(str(img_path))
        encodings = face_recognition.face_encodings(image)

        if not encodings:
            print(f"❌ לא זוהה פנים בתמונה")
            failed.append(img_path.name)
            continue

        if len(encodings) > 1:
            print(f"⚠️  נמצאו {len(encodings)} פנים - לוקח את הראשונה. השתמש בתמונה שיש בה רק פנים של הבת.")

        # מרשים את הבת - כל תמונה נוספת מוסיפה לדיוק
        if name not in daughters:
            daughters[name] = []
        daughters[name].append(encodings[0])
        print(f"✅ נרשמה")

    if not daughters:
        print("\n❌ לא נרשמה אף בת. בדוק שהתמונות ברורות ובאיכות טובה.")
        return

    with open(ENCODINGS_FILE, "wb") as f:
        pickle.dump(daughters, f)

    print(f"\n✅ נרשמו {len(daughters)} בנות: {', '.join(daughters.keys())}")
    print(f"   הנתונים נשמרו ב: {ENCODINGS_FILE}")

    if failed:
        print(f"\n⚠️  נכשלו: {', '.join(failed)}")

    return daughters


def add_more_photos(daughter_name: str, image_path: str):
    """הוסף תמונות נוספות לבת קיימת לשיפור הדיוק"""
    if not ENCODINGS_FILE.exists():
        print("❌ קובץ הנתונים לא קיים. הרץ register_daughters() קודם.")
        return

    with open(ENCODINGS_FILE, "rb") as f:
        daughters = pickle.load(f)

    image = face_recognition.load_image_file(image_path)
    encodings = face_recognition.face_encodings(image)

    if not encodings:
        print(f"❌ לא זוהו פנים ב-{image_path}")
        return

    if daughter_name not in daughters:
        daughters[daughter_name] = []

    daughters[daughter_name].append(encodings[0])

    with open(ENCODINGS_FILE, "wb") as f:
        pickle.dump(daughters, f)

    print(f"✅ נוספה תמונה ל-{daughter_name} (סה\"כ {len(daughters[daughter_name])} תמונות)")


if __name__ == "__main__":
    if len(sys.argv) == 3:
        # הוספת תמונה לבת קיימת: python setup_daughters.py <שם> <נתיב_תמונה>
        add_more_photos(sys.argv[1], sys.argv[2])
    else:
        register_daughters()
