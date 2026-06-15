---
description: הסבר מושגי AI מרכזיים בפרויקט זיהוי הפנים
---

הסבר למשתמש את המושגים הבאים כפי שהם מופיעים **בפרויקט שלו**:

## מושגים להסביר

1. **Embedding / וקטור**
   - קובץ רלוונטי: `vector_store.py` פונקציה `register_face`
   - הסבר: תמונה → 128 מספרים

2. **Vector Database (ChromaDB)**
   - קובץ רלוונטי: `vector_store.py` פונקציה `get_collection`
   - הסבר: מה ההבדל מ-SQL, למה צריך זאת

3. **Cosine Similarity**
   - קובץ רלוונטי: `vector_store.py` פונקציה `find_matching_daughter`
   - הסבר: distance < 0.45 = אותה ילדה

4. **Neural Network (ResNet-34)**
   - מסביר: dlib/face_recognition מאחורי הקלעים

5. **Tolerance / Threshold**
   - קובץ רלוונטי: `identify_photos.py` משתנה `TOLERANCE`
   - הסבר: trade-off בין false positives לbetween false negatives

6. **Face Detection vs Face Recognition**
   - Detection: "יש פנים בתמונה?" (bounding box)
   - Recognition: "של מי הפנים?" (embedding + comparison)

הצג קטעי קוד אמיתיים מהפרויקט עם הסבר שורה שורה.
