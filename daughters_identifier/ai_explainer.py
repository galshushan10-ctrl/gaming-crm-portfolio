"""
AI Explainer – מסביר מה קורה מאחורי הקלעים בזמן אמת.

הרץ אותו כדי ללמוד על:
- מה זה embedding / וקטור
- מה זה cosine similarity
- איך רשת עצבית רואה פנים
- מה ההבדל בין vector DB לבין DB רגיל
"""

import numpy as np
import face_recognition
from pathlib import Path
from vector_store import get_collection


def explain_what_is_embedding():
    print("\n" + "="*60)
    print("🧠 מה זה EMBEDDING (ייצוג וקטורי)?")
    print("="*60)
    print("""
מחשב לא מבין תמונות ישירות.
הוא מבין רק מספרים.

רשת עצבית (neural network) לומדת להפוך תמונה
לרשימה קומפקטית של מספרים שמייצגים את "המהות" שלה.

דוגמה לאנלוגיה פשוטה:
  "תפוח אדום גדול" → [צבע=1.0, גודל=0.9, צורה=0.7]
  "תפוח ירוק קטן" → [צבע=0.2, גודל=0.1, צורה=0.7]

בפנים: רשת ResNet-34 הופכת תמונת פנים ל-128 מספרים
  פנים של אמא → [0.12, -0.34, 0.87, ..., 0.05]  ← 128 ערכים
  פנים של בת  → [0.11, -0.35, 0.86, ..., 0.06]  ← קרוב מאוד!
  פנים זר     → [0.89,  0.21, -0.43, ..., 0.77]  ← שונה לגמרי
""")


def explain_cosine_similarity():
    print("\n" + "="*60)
    print("📐 מה זה COSINE SIMILARITY?")
    print("="*60)

    v1 = np.array([1.0, 0.0, 0.0])
    v2 = np.array([0.9, 0.4, 0.1])
    v3 = np.array([-1.0, 0.0, 0.0])

    def cosine_sim(a, b):
        return np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))

    print(f"""
דמיינו וקטורים בחלל תלת-מימדי:
  v1 (בת א') = {v1}
  v2 (בת א' תמונה נוספת) = {v2}
  v3 (ילד זר) = {v3}

Cosine Similarity (קרוב ל-1 = דומה):
  v1 ↔ v2: {cosine_sim(v1, v2):.3f}  ← אותה ילדה, תמונה שונה
  v1 ↔ v3: {cosine_sim(v1, v3):.3f}  ← אדם שונה לחלוטין

ChromaDB משתמש ב-cosine distance = 1 - cosine_similarity:
  v1 ↔ v2: {1-cosine_sim(v1, v2):.3f}  ← distance קטן = אותה ילדה
  v1 ↔ v3: {1-cosine_sim(v1, v3):.3f}  ← distance גדול = אדם אחר

הסף שלנו: distance < 0.45 = "זיהינו אותה!"
""")


def explain_vector_db_vs_sql():
    print("\n" + "="*60)
    print("💾 Vector DB לעומת SQL רגיל")
    print("="*60)
    print("""
SQL רגיל (כמו MySQL):
  SELECT * FROM faces WHERE name = 'מאיה'
  ← מחפש התאמה מדויקת של טקסט

Vector DB (ChromaDB):
  collection.query(embedding=[0.12, -0.34, ...], n_results=5)
  ← מחפש את הוקטורים הקרובים ביותר!

למה Vector DB?
  ✅ מציאת דמיון סמנטי (לא רק התאמה מדויקת)
  ✅ חיפוש מהיר בין מיליוני וקטורים (אלגוריתם HNSW)
  ✅ עובד עם embeddings של תמונות, טקסט, קול

שימושים נוספים של Vector DB:
  • ChatGPT: זוכר שיחות עם embeddings של טקסט
  • Spotify: ממליץ שירים לפי embedding של מוזיקה
  • Google Images: חיפוש תמונות דומות
  • אנחנו: זיהוי פנים הבנות!
""")


def live_demo_with_real_data():
    print("\n" + "="*60)
    print("🔬 דמו חי מהנתונים שלך")
    print("="*60)

    collection = get_collection()
    count = collection.count()

    if count == 0:
        print("⚠️  אין עדיין נתונים. הרץ קודם:")
        print("   python vector_store.py --register")
        return

    all_data = collection.get(include=["metadatas", "embeddings"])
    print(f"\nנמצאו {count} embeddings ב-ChromaDB\n")

    for metadata, embedding in zip(all_data["metadatas"], all_data["embeddings"]):
        name = metadata["name"]
        vec = np.array(embedding)
        print(f"👧 {name}:")
        print(f"   גודל הוקטור: {len(vec)} מימדים")
        print(f"   5 ערכים ראשונים: {[round(v, 4) for v in vec[:5]]}")
        print(f"   ממוצע: {vec.mean():.4f}, סטיית תקן: {vec.std():.4f}")
        print(f"   מינימום: {vec.min():.4f}, מקסימום: {vec.max():.4f}")
        print()

    if count >= 2:
        embeddings = all_data["embeddings"]
        names = [m["name"] for m in all_data["metadatas"]]
        print("📊 מטריצת דמיון בין כל הפנים:")
        print(f"{'':15}", end="")
        for n in names:
            print(f"{n:>12}", end="")
        print()
        for i, (e1, n1) in enumerate(zip(embeddings, names)):
            print(f"{n1:15}", end="")
            for e2 in embeddings:
                v1, v2 = np.array(e1), np.array(e2)
                sim = np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
                print(f"{sim:12.3f}", end="")
            print()


def explain_neural_network_simple():
    print("\n" + "="*60)
    print("🕸️  איך רשת עצבית יוצרת embeddings?")
    print("="*60)
    print("""
תמונת פנים (300x300 פיקסלים):
  כל פיקסל = 3 מספרים (R, G, B)
  סה"כ: 300 × 300 × 3 = 270,000 מספרים → קלט

ResNet-34 (הרשת שבספריית face_recognition):
  שכבה 1: 270,000 → 64 "מאפיינים"  (קצוות, גרדיאנטים)
  שכבה 2:     64  → 128            (עיניים, אף, פה)
  שכבה 3:    128  → 256            (מבנה גולגולת)
  ...
  שכבה 34:   512  → 128            (ייצוג סופי!)

פלט: וקטור של 128 מספרים
  ← זה ה-embedding!
  ← כל מספר מייצג מאפיין כלשהו של הפנים
  ← הרשת למדה אילו מאפיינים חשובים (לא אנחנו קבענו)

הרשת אומנה על מיליוני זוגות תמונות:
  "אלה אותם אנשים" / "אלה אנשים שונים"
  ← למדה לייצג פנים כך שאותו אדם → וקטורים קרובים
""")


def run_all():
    explain_what_is_embedding()
    explain_cosine_similarity()
    explain_vector_db_vs_sql()
    explain_neural_network_simple()
    live_demo_with_real_data()

    print("\n" + "="*60)
    print("🎓 מה למדנו?")
    print("="*60)
    print("""
  1. Embedding = תמונה → 128 מספרים (וקטור)
  2. Cosine Similarity = מדד קרבה בין וקטורים
  3. Vector DB (ChromaDB) = מסד נתונים שמחפש לפי קרבה
  4. Neural Network = מי שהמיר את התמונות לוקטורים

  המערכת שבנינו:
  ┌─────────────┐    ┌──────────┐    ┌──────────┐    ┌─────────┐
  │ תמונת גן   │ →  │  dlib    │ →  │ ChromaDB │ →  │WhatsApp │
  │ (JPG)       │    │  128-dim │    │ cosine   │    │ התראה   │
  └─────────────┘    └──────────┘    └──────────┘    └─────────┘
""")


if __name__ == "__main__":
    run_all()
