---
description: רישום בנות חדשות במערכת הזיהוי
---

עזור למשתמש לרשום בנות חדשות במערכת זיהוי הפנים.

שאל:
1. מה שם הבת שרוצים לרשום?
2. האם יש תמונה מוכנה, או צריך הסבר איך לשמור אחת?

לאחר מכן:
1. הסבר שצריך לשים תמונה ברורה של הבת (פנים בלבד) בתיקיית `daughters_identifier/reference_photos/`
2. שם הקובץ = שם הבת (למשל: `maya.jpg`)
3. הרץ: `cd daughters_identifier && python setup_daughters.py`
4. לאחר רישום, הרץ `python vector_store.py --register` כדי לשמור ב-ChromaDB
5. הרץ `python vector_store.py --show` להצגת אישור

אם יש כבר בנות רשומות, הצג אותן קודם.
