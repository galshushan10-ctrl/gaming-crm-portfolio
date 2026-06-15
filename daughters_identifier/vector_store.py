"""
מסד נתונים וקטורי לאחסון embeddings של הבנות.
משתמש ב-ChromaDB + DeepFace (Facenet512 – 512 מימדים).
"""

import chromadb
import numpy as np
from pathlib import Path
from typing import Optional
import sys

CHROMA_DIR = Path("chroma_db")
COLLECTION_NAME = "daughters_faces"
REFERENCE_DIR = Path("reference_photos")
MODEL = "Facenet512"


def get_embedding(image_path: str) -> Optional[np.ndarray]:
    from deepface import DeepFace
    try:
        result = DeepFace.represent(
            img_path=image_path,
            model_name=MODEL,
            enforce_detection=True,
            detector_backend="retinaface",
        )
        return np.array(result[0]["embedding"])
    except Exception as e:
        print(f"  ⚠️  {e}")
        return None


def get_collection() -> chromadb.Collection:
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def register_face(daughter_name: str, image_path: str, photo_index: int = 0) -> bool:
    embedding = get_embedding(image_path)
    if embedding is None:
        return False

    collection = get_collection()
    doc_id = f"{daughter_name}_{photo_index}"
    collection.upsert(
        ids=[doc_id],
        embeddings=[embedding.tolist()],
        metadatas=[{
            "name": daughter_name,
            "source_image": str(image_path),
            "dimensions": len(embedding),
            "model": MODEL,
        }],
        documents=[f"Face of {daughter_name}"],
    )
    print(f"  ✅ {daughter_name}: embedding נשמר ({len(embedding)} מימדים)")
    return True


def register_all_from_reference_dir() -> dict:
    if not REFERENCE_DIR.exists():
        print(f"❌ תיקייה לא קיימת: {REFERENCE_DIR.absolute()}")
        return {}

    registered = {}
    image_extensions = {".jpg", ".jpeg", ".png", ".webp"}

    for img_path in sorted(REFERENCE_DIR.iterdir()):
        if img_path.suffix.lower() not in image_extensions:
            continue
        stem = img_path.stem
        name = stem.rsplit("_", 1)[0] if stem[-1].isdigit() and "_" in stem else stem
        print(f"  מעבד: {name} ({img_path.name})...", end=" ")
        idx = registered.get(name, 0)
        success = register_face(name, str(img_path), photo_index=idx)
        if success:
            registered[name] = idx + 1

    print(f"\n✅ נרשמו {len(registered)} בנות ב-ChromaDB")
    return registered


def find_matching_daughter(image_path: str, max_distance: float = 0.35) -> list[dict]:
    """
    מחפש בנות בתמונה. Facenet512 משתמש בסף נמוך יותר מ-dlib (0.35 במקום 0.45).
    """
    embedding = get_embedding(image_path)
    if embedding is None:
        return []

    collection = get_collection()
    if collection.count() == 0:
        return []

    results = collection.query(
        query_embeddings=[embedding.tolist()],
        n_results=min(5, collection.count()),
        include=["metadatas", "distances"],
    )

    found = {}
    for metadata, distance in zip(results["metadatas"][0], results["distances"][0]):
        if distance <= max_distance:
            name = metadata["name"]
            confidence = round((1 - distance) * 100, 1)
            if name not in found or confidence > found[name]["confidence"]:
                found[name] = {"name": name, "distance": round(distance, 4), "confidence": confidence}

    return sorted(found.values(), key=lambda x: x["confidence"], reverse=True)


def show_stored_daughters() -> None:
    collection = get_collection()
    count = collection.count()

    if count == 0:
        print("❌ אין בנות רשומות.")
        return

    all_items = collection.get(include=["metadatas", "embeddings"])
    daughters = {}
    for metadata, embedding in zip(all_items["metadatas"], all_items["embeddings"]):
        name = metadata["name"]
        if name not in daughters:
            daughters[name] = []
        daughters[name].append(embedding)

    print(f"\n📊 בנות רשומות ב-ChromaDB ({count} embeddings, מודל: {MODEL}):\n")
    for name, embeddings in sorted(daughters.items()):
        print(f"  👧 {name}: {len(embeddings)} תמונות")
        vec = np.array(embeddings[0])
        print(f"     {len(vec)} מימדים | norm={np.linalg.norm(vec):.3f}")
        print(f"     ערכים לדוגמה: {[round(v, 3) for v in vec[:5]]} ...")

    if len(daughters) >= 2:
        print("\n📐 מרחקים cosine בין הבנות:")
        names = list(daughters.keys())
        for i in range(len(names)):
            for j in range(i + 1, len(names)):
                v1 = np.array(daughters[names[i]][0])
                v2 = np.array(daughters[names[j]][0])
                dist = 1 - np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
                print(f"  {names[i]} ↔ {names[j]}: {dist:.4f}")


if __name__ == "__main__":
    if "--show" in sys.argv:
        show_stored_daughters()
    elif "--register" in sys.argv:
        register_all_from_reference_dir()
    else:
        print("שימוש:")
        print("  python vector_store.py --register")
        print("  python vector_store.py --show")
