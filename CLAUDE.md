# Gaming CRM + Daughters Photo Identifier

## מה הפרויקט הזה

שני פרויקטים תחת אותו repo:

1. **Gaming CRM** – ניתוח שחקנים, RFM, churn prediction, A/B testing
2. **Daughters Identifier** – זיהוי פנים של בנות בתמונות גן, שליחה ל-WhatsApp

---

## ארכיטקטורת AI בפרויקט

### Face Recognition Pipeline
```
תמונה גולמית
     ↓
face_recognition (dlib HOG detector)
     ↓
128-dimensional face embedding (וקטור)
     ↓
ChromaDB (vector store)  ←→  cosine similarity search
     ↓
match / no match
     ↓
WhatsApp (Twilio)
```

### מושגי AI מרכזיים בפרויקט
- **Embedding**: ייצוג מספרי (וקטור) של פנים – 128 מספרים שמייצגים זהות
- **Vector DB**: מסד נתונים שמחפש לפי קרבה מתמטית בין וקטורים
- **Cosine Similarity**: מדד דמיון בין שני וקטורים (0=שונים, 1=זהים)
- **Tolerance**: סף ההחלטה – כמה "קרוב" מספיק כדי להגיד "זו אותה בת"

---

## מבנה הפרויקטים

```
gaming-crm-portfolio/
├── CLAUDE.md                    ← המסמך הזה
├── daughters_identifier/
│   ├── setup_daughters.py       ← שלב 1: רישום פנים הבנות
│   ├── vector_store.py          ← שמירת embeddings ב-ChromaDB
│   ├── identify_photos.py       ← זיהוי תמונות
│   ├── ai_explainer.py          ← הסבר חי של מה שקורה
│   ├── watcher.py               ← מעקב אוטומטי
│   ├── whatsapp_sender.py       ← שליחה ל-WhatsApp
│   ├── main.py                  ← כניסה ראשית
│   ├── reference_photos/        ← תמונות הבנות (לא ב-git)
│   ├── incoming/                ← תמונות גן נכנסות (לא ב-git)
│   └── matched/                 ← תמונות שזוהו (לא ב-git)
├── .claude/
│   └── commands/               ← פקודות מותאמות לקלוד
└── [קבצי CRM...]
```

---

## הפקודות הכי חשובות

```bash
# רישום בנות
cd daughters_identifier && python setup_daughters.py

# זיהוי תמונות בתיקיית incoming
python main.py

# מעקב אוטומטי
python watcher.py

# הצגת הסבר AI חי
python ai_explainer.py

# הצגת הוקטורים של הבנות
python vector_store.py --show
```

---

## משתני סביבה נדרשים

```bash
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
WHATSAPP_TO=+972...
CLOUDINARY_URL=...   # רק לשליחת תמונות (לא רק טקסט)
```

---

## AI Skills זמינים

| פקודה | תיאור |
|-------|--------|
| `/identify` | הרץ זיהוי על תיקיית incoming |
| `/register` | רשום בת חדשה |
| `/explain-embedding` | הסבר מה זה embedding עם דוגמה חיה |
| `/ai-concepts` | הסבר מושגי AI בפרויקט |

---

## כיצד face recognition עובד (בקצרה)

1. **Detection**: מזהה היכן הפנים בתמונה (bounding box)
2. **Alignment**: מיישר את הפנים (עיניים, אף, פה)
3. **Encoding**: מעביר דרך רשת עצבית → 128 מספרים
4. **Comparison**: משווה את ה-128 מספרים לאלה שנשמרו

```python
# מה שקורה מאחורי face_recognition.face_encodings():
# תמונה של 300x300 פיקסלים (270,000 מספרים)
# ↓ רשת עצבית (ResNet-34, 29 שכבות)
# ↓ 128 מספרים בלבד – compact representation
embedding = [0.12, -0.34, 0.87, ..., 0.05]  # 128 ערכים
```
