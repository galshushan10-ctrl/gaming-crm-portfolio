"""
מעקב אוטומטי: עוקב אחרי תיקיית incoming ומעבד תמונות חדשות אוטומטית.
הרץ ברקע: python watcher.py
"""

import time
import os
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler, FileCreatedEvent

from identify_photos import identify_photo, load_daughters, MATCHED_DIR
from whatsapp_sender import send_text_summary
import shutil

INCOMING_DIR = Path("incoming")
COOLDOWN_SECONDS = 3  # המתן שניות אחרי יצירת הקובץ לפני עיבוד (מונע קריאה של קובץ חלקי)

SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


class PhotoHandler(FileSystemEventHandler):
    def __init__(self):
        self.daughters = load_daughters()
        MATCHED_DIR.mkdir(exist_ok=True)
        print(f"✅ מוכן לזיהוי. מחפש: {', '.join(self.daughters.keys())}")
        print(f"   מעקב אחרי: {INCOMING_DIR.absolute()}\n")

    def on_created(self, event: FileCreatedEvent):
        if event.is_directory:
            return

        path = Path(event.src_path)
        if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
            return

        time.sleep(COOLDOWN_SECONDS)

        if not path.exists():
            return

        print(f"📷 תמונה חדשה: {path.name}")
        found = identify_photo(str(path), self.daughters)

        if found:
            names = [n for n, _ in found]
            confidence_str = ", ".join(f"{n} ({c}%)" for n, c in found)
            print(f"  ✅ זוהו: {confidence_str}")

            dest = MATCHED_DIR / path.name
            shutil.move(str(path), str(dest))

            result = {"dest": str(dest), "daughters": found}
            try:
                send_text_summary([result])
            except Exception as e:
                print(f"  ⚠️  שליחת WhatsApp נכשלה: {e}")
                print(f"     התמונה נשמרה ב: {dest}")
        else:
            print(f"  ⬜ לא זוהו בנות")


def run():
    INCOMING_DIR.mkdir(exist_ok=True)

    handler = PhotoHandler()
    observer = Observer()
    observer.schedule(handler, str(INCOMING_DIR), recursive=False)
    observer.start()

    print("🔍 מערכת פעילה! שים תמונות בתיקיית incoming/ לעיבוד אוטומטי.")
    print("   עצור עם Ctrl+C\n")

    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
        print("\n🛑 המערכת עצרה.")

    observer.join()


if __name__ == "__main__":
    run()
