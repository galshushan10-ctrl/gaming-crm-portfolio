"""
מסד נתונים וקטורי לאחסון embeddings של הבנות.

ChromaDB = מסד נתונים שמאפשר חיפוש לפי "קרבה" בין וקטורים.
במקום לחפש "האם השמות זהים?", הוא שואל "האם הוקטורים קרובים?"
"""

import chromadb
import face_recognition
import numpy as np
from pathlib import Path
from typing import Optional
import sys

CHROMA_DIR = Path("chroma_db")
COLLECTION_NAME = "daughters_faces"
REFERENCE_DIR = Path("reference_photos")


def get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},  # cosine similarity = מדד הדמיון
    )


def register_face(daughter_name: str, image_path: str, photo_index: int = 0) -> bool:
    """
    מוסיף embedding של פנים ל-ChromaDB.

    ה-embedding הוא וקטור של 128 מספרים.
    ChromaDB שומר אותו ומאפשר חיפוש מהיר לפי קרבה.
    """
    image = face_recognition.load_image_file(image_path)
    encodings = face_recognition.face_encodings(image)

    if not encodings:
        print(f"  ⚠️  לא זוהו פנים ב-{image_path}")
        return False

    embedding = encodings[0].tolist()  # numpy array → Python list

    collection = get_collection()
    doc_id = f"{daughter_name}_{photo_index}"

    collection.upsert(
        ids=[doc_id],
        embeddings=[embedding],
        metadatas=[{
            "name": daughter_name,
            "source_image": str(image_path),
            "dimensions": len(embedding),
        }],
        documents=[f"Face of {daughter_name}"],
    )

    print(f"  ✅ {daughter_name}: embedding נשמר ({len(embedding)} מימדים)")
    return True


def register_all_from_reference_dir() -> dict:
    """רושם את כל הבנות מתיקיית reference_photos/"""
    if not REFERENCE_DIR.exists():
        print(f"❌ תיקייה לא קיימת: {REFERENCE_DIR.absolute()}")
        return {}

    registered = {}
    image_extensions = {".jpg", ".jpeg", ".png", ".webp"}

    for img_path in sorted(REFERENCE_DIR.iterdir()):
        if img_path.suffix.lower() not in image_extensions:
            continue

        name = img_path.stem
        print(f"  מעבד: {name}...", end=" ")

        idx = len([k for k in registered if k == name])
        success = register_face(name, str(img_path), photo_index=idx)
        if success:
            registered[name] = registered.get(name, 0) + 1

    print(f"\n✅ נרשמו {len(registered)} בנות ב-ChromaDB")
    return registered


def find_matching_daughter(
    image_path: str,
    max_distance: float = 0.45,
    n_results: int = 3,
) -> list[dict]:
    """
    מחפש בנות שמופיעות בתמונה.

    max_distance: ב-cosine space, 0=זהה, 1=הפכים.
    0.45 ≈ tolerance של 0.55 בספריית face_recognition.

    מחזיר רשימה של {"name": ..., "distance": ..., "confidence": ...}
    """
    image = face_recognition.load_image_file(image_path)
    unknown_encodings = face_recognition.face_encodings(image)

    if not unknown_encodings:
        return []

    collection = get_collection()
    found = {}

    for unknown_enc in unknown_encodings:
        results = collection.query(
            query_embeddings=[unknown_enc.tolist()],
            n_results=min(n_results, collection.count()),
            include=["metadatas", "distances"],
        )

        if not results["ids"][0]:
            continue

        for doc_id, metadata, distance in zip(
            results["ids"][0],
            results["metadatas"][0],
            results["distances"][0],
        ):
            if distance <= max_distance:
                name = metadata["name"]
                confidence = round((1 - distance) * 100, 1)
                # שמור רק את הציון הגבוה ביותר לכל בת
                if name not in found or confidence > found[name]["confidence"]:
                    found[name] = {
                        "name": name,
                        "distance": round(distance, 4),
                        "confidence": confidence,
                    }

    return sorted(found.values(), key=lambda x: x["confidence"], reverse=True)


def show_stored_daughters() -> None:
    """מציג את כל הבנות הרשומות והוקטורים שלהן"""
    collection = get_collection()
    count = collection.count()

    if count == 0:
        print("❌ אין בנות רשומות. הרץ register_all_from_reference_dir() קודם.")
        return

    all_items = collection.get(include=["metadatas", "embeddings"])
    daughters = {}
    for metadata, embedding in zip(all_items["metadatas"], all_items["embeddings"]):
        name = metadata["name"]
        if name not in daughters:
            daughters[name] = []
        daughters[name].append(embedding)

    print(f"\n📊 בנות רשומות ב-ChromaDB ({count} embeddings):\n")
    for name, embeddings in sorted(daughters.items()):
        print(f"  👧 {name}: {len(embeddings)} תמונות רשומות")
        vec = embeddings[0]
        print(f"     וקטור לדוגמה (5 ערכים ראשונים מתוך {len(vec)}):")
        print(f"     {[round(v, 4) for v in vec[:5]]} ...")
        print(f"     גודל: L2 norm = {np.linalg.norm(vec):.4f}")

    if len(daughters) >= 2:
        print("\n📐 מרחקים בין הבנות (cosine distance):")
        names = list(daughters.keys())
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                v1 = np.array(daughters[names[i]][0])
                v2 = np.array(daughters[names[j]][0])
                cosine_dist = 1 - np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
                print(f"  {names[i]} ↔ {names[j]}: distance = {cosine_dist:.4f}")


if __name__ == "__main__":
    if "--show" in sys.argv:
        show_stored_daughters()
    elif "--register" in sys.argv:
        register_all_from_reference_dir()
    else:
        print("שימוש:")
        print("  python vector_store.py --register   # רשום בנות")
        print("  python vector_store.py --show       # הצג נתונים")
