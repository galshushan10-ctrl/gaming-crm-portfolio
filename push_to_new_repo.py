"""
מעביר את קוד daughters_identifier לריפו daughters-photo-identifier.
שימוש: GITHUB_TOKEN=ghp_xxx python push_to_new_repo.py
"""

import os
import base64
import requests
from pathlib import Path

TOKEN = os.environ.get("GITHUB_TOKEN")
OWNER = "galshushan10-ctrl"
REPO = "daughters-photo-identifier"
BRANCH = "main"
API = "https://api.github.com"

if not TOKEN:
    print("❌ חסר GITHUB_TOKEN")
    print("   צור token ב: https://github.com/settings/tokens/new")
    print("   בחר scope: repo")
    print("   הרץ: GITHUB_TOKEN=ghp_xxx python push_to_new_repo.py")
    exit(1)

headers = {
    "Authorization": f"token {TOKEN}",
    "Accept": "application/vnd.github.v3+json",
}

SOURCE_DIR = Path("daughters_identifier")
CLAUDE_DIR = Path(".claude")

FILES_TO_PUSH = [
    # קבצי הפרויקט הראשיים
    (SOURCE_DIR / "setup_daughters.py",   "setup_daughters.py"),
    (SOURCE_DIR / "vector_store.py",      "vector_store.py"),
    (SOURCE_DIR / "identify_photos.py",   "identify_photos.py"),
    (SOURCE_DIR / "ai_explainer.py",      "ai_explainer.py"),
    (SOURCE_DIR / "watcher.py",           "watcher.py"),
    (SOURCE_DIR / "whatsapp_sender.py",   "whatsapp_sender.py"),
    (SOURCE_DIR / "main.py",              "main.py"),
    (SOURCE_DIR / "save_reference.py",    "save_reference.py"),
    (SOURCE_DIR / "requirements.txt",     "requirements.txt"),
    (SOURCE_DIR / ".env.example",         ".env.example"),
    # Skills
    (CLAUDE_DIR / "commands/identify.md",         ".claude/commands/identify.md"),
    (CLAUDE_DIR / "commands/register.md",         ".claude/commands/register.md"),
    (CLAUDE_DIR / "commands/explain-embedding.md",".claude/commands/explain-embedding.md"),
    (CLAUDE_DIR / "commands/ai-concepts.md",      ".claude/commands/ai-concepts.md"),
]

EXTRA_FILES = {
    ".gitignore": """\
# סביבה
.env
*.env
__pycache__/
*.pyc
.venv/
venv/

# נתוני פנים – לא עולים ל-git
reference_photos/
incoming/
matched/
chroma_db/
*.pkl

# כלי פיתוח
.DS_Store
*.egg-info/
""",
    "CLAUDE.md": open("CLAUDE.md").read() if Path("CLAUDE.md").exists() else "# Daughters Photo Identifier\n",
}


def push_file(dest_path: str, content: str) -> bool:
    url = f"{API}/repos/{OWNER}/{REPO}/contents/{dest_path}"
    encoded = base64.b64encode(content.encode()).decode()

    # בדוק אם קובץ קיים (כדי לקבל SHA לעדכון)
    r = requests.get(url, headers=headers)
    sha = r.json().get("sha") if r.status_code == 200 else None

    payload = {
        "message": f"Add {dest_path}",
        "content": encoded,
        "branch": BRANCH,
    }
    if sha:
        payload["sha"] = sha

    r = requests.put(url, json=payload, headers=headers)
    if r.status_code in (200, 201):
        print(f"  ✅ {dest_path}")
        return True
    else:
        print(f"  ❌ {dest_path}: {r.status_code} {r.json().get('message', '')}")
        return False


def main():
    print(f"📦 מעביר קבצים ל-{OWNER}/{REPO}...\n")

    ok = 0
    fail = 0

    for src, dest in FILES_TO_PUSH:
        if not src.exists():
            print(f"  ⬜ דלג (לא קיים): {src}")
            continue
        content = src.read_text(encoding="utf-8")
        if push_file(dest, content):
            ok += 1
        else:
            fail += 1

    for dest, content in EXTRA_FILES.items():
        if push_file(dest, content):
            ok += 1
        else:
            fail += 1

    print(f"\n{'✅' if fail == 0 else '⚠️'} סיום: {ok} הצליחו, {fail} נכשלו")
    print(f"\n🔗 הריפו החדש: https://github.com/{OWNER}/{REPO}")


if __name__ == "__main__":
    main()
