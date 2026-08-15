"""Terminal output that survives Windows.

Every CLI in this app prints Mongolian, emoji and box-drawing characters. On
Windows the default console encoding is a legacy codepage (cp1252 here), and
`print("🐫")` raises UnicodeEncodeError against it — the learner's session dies
on a camel. This switches stdout/stderr to UTF-8 and, where the terminal still
cannot draw a glyph, degrades to a replacement character instead of crashing.
"""

from __future__ import annotations

import sys


def utf8_output() -> None:
    for stream in (sys.stdout, sys.stderr):
        reconfigure = getattr(stream, "reconfigure", None)
        if reconfigure is None:
            continue
        try:
            reconfigure(encoding="utf-8", errors="replace")
        except (ValueError, OSError):  # already detached, or not a text stream
            pass
