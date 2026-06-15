"""
מנהל ראשי – הרץ עיבוד על תיקיית incoming ושלח ב-WhatsApp
"""

import sys
import argparse
from pathlib import Path
from identify_photos import process_folder, INCOMING_DIR, MATCHED_DIR
from whatsapp_sender import send_text_summary


def main():
    parser = argparse.ArgumentParser(description="מזהה תמונות בנות מהגן")
    parser.add_argument("--incoming", type=Path, default=INCOMING_DIR, help="תיקיית תמונות נכנסות")
    parser.add_argument("--matched", type=Path, default=MATCHED_DIR, help="תיקיית תמונות שזוהו")
    parser.add_argument("--no-move", action="store_true", help="העתק במקום להזיז")
    parser.add_argument("--no-send", action="store_true", help="לא לשלוח WhatsApp (רק לזהות)")
    parser.add_argument("--tolerance", type=float, default=0.55, help="רמת דיוק (0.4=מחמיר, 0.6=גמיש)")
    args = parser.parse_args()

    print(f"🔍 מחפש בנות בתיקייה: {args.incoming.absolute()}\n")
    results = process_folder(
        incoming_dir=args.incoming,
        matched_dir=args.matched,
        move_matched=not args.no_move,
        tolerance=args.tolerance,
    )

    if results and not args.no_send:
        print("\n📱 שולח התראת WhatsApp...")
        try:
            send_text_summary(results)
        except Exception as e:
            print(f"⚠️  שליחת WhatsApp נכשלה: {e}")
            print(f"   התמונות נשמרו ב: {args.matched.absolute()}")
    elif results:
        print(f"\n✅ {len(results)} תמונות נשמרו ב: {args.matched.absolute()}")
    else:
        print("\nלא נמצאו תמונות עם הבנות.")


if __name__ == "__main__":
    main()
