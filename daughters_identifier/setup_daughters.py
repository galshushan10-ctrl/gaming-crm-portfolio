"""
שלב 1: רישום תמונות הבנות
הרץ את הסקריפט הזה פעם אחת עם תמונות של הבנות שלך.
"""

from deepface import DeepFace
import pickle
import numpy as np
from pathlib import Path
import sys

REFERENCE_DIR = Path("reference_photos")
ENCODINGS_FILE = Path("daughters_encodings.pkl")
MODEL = "Facenet512"  # מודל מדויק ועובד עם פנים של ילדים


def get_embedding(image_path: str) -> np.ndarray | None:
    try:
        result = DeepFace.represent(
            img_path=image_path,
            model_name=MODEL,
            enforce_detection=True,
            detector_backend="retinaface",
        )
        return np.array(result[0]["embedding"])
    except Exception as e:
        print(f"שגיאה: {e}")
        return None


def register_daughters():
    if not REFERENCE_DIR.exists() or not list(REFERENCE_DIR.iterdir()):
        print(f"❌ שים תמונות של הבנות בתיקייה: {REFERENCE_DIR.absolute()}")
        print("   שם הקובץ = שם הבת, למשל: gafan.jpg, noa.jpg")
        return

    daughters = {}
    failed = []

    for img_path in sorted(REFERENCE_DIR.iterdir()):
        if img_path.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue

        # gafan_1 → gafan, gafan_2 → gafan
        stem = img_path.stem
        name = stem.rsplit("_", 1)[0] if stem[-1].isdigit() and "_" in stem else stem
        print(f"  מעבד תמונה של {name}... ", end="", flush=True)

        embedding = get_embedding(str(img_path))
        if embedding is None:
            print("❌ לא זוהו פנים")
            failed.append(img_path.name)
            continue

        if name not in daughters:
            daughters[name] = []
        daughters[name].append(embedding)
        print(f"✅ ({len(embedding)} מימדים)")

    if not daughters:
        print("\n❌ לא נרשמה אף בת.")
        return

    with open(ENCODINGS_FILE, "wb") as f:
        pickle.dump(daughters, f)

    print(f"\n✅ נרשמו {len(daughters)} בנות: {', '.join(daughters.keys())}")
    if failed:
        print(f"⚠️  נכשלו: {', '.join(failed)}")
    return daughters


def add_more_photos(daughter_name: str, image_path: str):
    if not ENCODINGS_FILE.exists():
        print("❌ הרץ register_daughters() קודם.")
        return

    with open(ENCODINGS_FILE, "rb") as f:
        daughters = pickle.load(f)

    embedding = get_embedding(image_path)
    if embedding is None:
        print(f"❌ לא זוהו פנים ב-{image_path}")
        return

    if daughter_name not in daughters:
        daughters[daughter_name] = []
    daughters[daughter_name].append(embedding)

    with open(ENCODINGS_FILE, "wb") as f:
        pickle.dump(daughters, f)

    print(f"✅ נוספה תמונה ל-{daughter_name} (סה\"כ {len(daughters[daughter_name])} תמונות)")


if __name__ == "__main__":
    if len(sys.argv) == 3:
        add_more_photos(sys.argv[1], sys.argv[2])
    else:
        register_daughters()
