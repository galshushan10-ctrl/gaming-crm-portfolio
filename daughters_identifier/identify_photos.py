"""
שלב 2: זיהוי תמונות הבנות בתמונות הגן
"""

import face_recognition
import pickle
import shutil
from pathlib import Path
from typing import Optional
import numpy as np

ENCODINGS_FILE = Path("daughters_encodings.pkl")
INCOMING_DIR = Path("incoming")
MATCHED_DIR = Path("matched")
TOLERANCE = 0.55  # ככל שנמוך יותר, הזיהוי מחמיר יותר (0.4–0.6 מומלץ)


def load_daughters():
    if not ENCODINGS_FILE.exists():
        raise FileNotFoundError("לא נמצא קובץ נתוני הבנות. הרץ setup_daughters.py קודם.")
    with open(ENCODINGS_FILE, "rb") as f:
        return pickle.load(f)


def identify_photo(image_path: str, daughters: dict, tolerance: float = TOLERANCE) -> list[str]:
    """
    בודק תמונה ומחזיר רשימת שמות הבנות שזוהו בה.
    מחזיר רשימה ריקה אם לא זוהתה אף בת.
    """
    image = face_recognition.load_image_file(image_path)
    unknown_encodings = face_recognition.face_encodings(image)

    if not unknown_encodings:
        return []

    found_daughters = set()

    for unknown_enc in unknown_encodings:
        for daughter_name, known_encodings in daughters.items():
            matches = face_recognition.compare_faces(known_encodings, unknown_enc, tolerance=tolerance)
            if any(matches):
                distances = face_recognition.face_distance(known_encodings, unknown_enc)
                confidence = 1 - float(np.min(distances))
                found_daughters.add((daughter_name, round(confidence * 100, 1)))

    return [(name, conf) for name, conf in sorted(found_daughters)]


def process_folder(
    incoming_dir: Path = INCOMING_DIR,
    matched_dir: Path = MATCHED_DIR,
    move_matched: bool = True,
    tolerance: float = TOLERANCE,
) -> list[dict]:
    """
    עובר על תיקיית incoming ומחפש תמונות עם הבנות.
    מחזיר רשימת תמונות שבהן זוהו בנות.
    """
    daughters = load_daughters()
    matched_dir.mkdir(exist_ok=True)
    results = []

    image_extensions = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}
    images = [p for p in incoming_dir.iterdir() if p.suffix.lower() in image_extensions]

    if not images:
        print(f"אין תמונות בתיקייה: {incoming_dir.absolute()}")
        return []

    print(f"בודק {len(images)} תמונות...")

    for img_path in sorted(images):
        found = identify_photo(str(img_path), daughters, tolerance)

        if found:
            names = [f"{n} ({c}%)" for n, c in found]
            print(f"  ✅ {img_path.name} → זוהו: {', '.join(names)}")

            dest = matched_dir / img_path.name
            if move_matched:
                shutil.move(str(img_path), str(dest))
            else:
                shutil.copy2(str(img_path), str(dest))

            results.append({
                "file": str(img_path),
                "dest": str(dest),
                "daughters": found,
            })
        else:
            print(f"  ⬜ {img_path.name} → לא זוהו בנות")

    print(f"\nסיכום: נמצאו {len(results)} תמונות עם הבנות מתוך {len(images)}")
    return results


if __name__ == "__main__":
    import sys
    if len(sys.argv) == 2:
        # בדיקת תמונה בודדת
        daughters = load_daughters()
        found = identify_photo(sys.argv[1], daughters)
        if found:
            print(f"✅ זוהו: {', '.join(f'{n} ({c}%)' for n, c in found)}")
        else:
            print("❌ לא זוהו בנות")
    else:
        process_folder()
