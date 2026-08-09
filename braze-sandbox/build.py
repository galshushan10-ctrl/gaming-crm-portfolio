#!/usr/bin/env python3
"""Inline the Braze Sandbox into one self-contained HTML file.

The modular sources under css/ and js/ are the thing you edit. This produces
dist/braze-sandbox.html, which has no external requests at all and therefore
works offline, from a file:// URL, or published as a hosted page.

    python3 build.py
"""

from pathlib import Path
import re
import sys

ROOT = Path(__file__).parent
DIST = ROOT / "dist"

JS_ORDER = [
    "js/data.js",
    "js/liquid.js",
    "js/segments.js",
    "js/casestudies.js",
    "js/ui.js",
    "js/canvas.js",
    "js/editor.js",
    "js/app.js",
]
CSS = "css/braze.css"


def read(rel: str) -> str:
    p = ROOT / rel
    if not p.exists():
        sys.exit(f"missing source file: {rel}")
    return p.read_text(encoding="utf-8")


def guard(js: str, name: str) -> str:
    """A stray </script> inside a JS string literal would end the tag early."""
    if "</script" in js.lower():
        js = re.sub(r"</(script)", r"<\\/\1", js, flags=re.I)
        print(f"  escaped a literal </script> in {name}")
    return js


def main() -> None:
    parts = [guard(read(p), p) for p in JS_ORDER]
    css = read(CSS)

    html = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Braze Sandbox — Marketing Automation Practice</title>
<style>
{css}
</style>
</head>
<body>
<div class="bz-app" id="bz-app"></div>
<script>
{"".join(f"/* ===== {name} ===== */{chr(10)}{src}{chr(10)}{chr(10)}" for name, src in zip(JS_ORDER, parts))}
</script>
</body>
</html>
"""

    DIST.mkdir(exist_ok=True)
    out = DIST / "braze-sandbox.html"
    out.write_text(html, encoding="utf-8")
    kb = out.stat().st_size / 1024
    print(f"built {out.relative_to(ROOT)}  ({kb:.0f} KB, {len(JS_ORDER)} scripts + 1 stylesheet inlined)")


if __name__ == "__main__":
    main()
