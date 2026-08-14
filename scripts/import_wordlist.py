"""Build knowledge/cefr_wordlist.json from the Words-CEFR-Dataset CSVs.

Source: https://github.com/Maximax67/Words-CEFR-Dataset (MIT license,
CEFR-J based). Raw CSVs live in data/raw/ (gitignored — re-download with
the URLs below); the generated JSON is committed.

Per level we keep the most FREQUENT words first — a learner "knows a
level" by knowing its common words, not its rare ones. New-words-per-level
caps are chosen so the cumulative totals land near the official list
sizes (Cambridge B1 Preliminary ≈ 2,500–3,000 cumulative words).

    python scripts/import_wordlist.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
RAW = REPO / "data" / "raw"
OUT = REPO / "knowledge" / "cefr_wordlist.json"

SOURCE_URLS = [
    "https://raw.githubusercontent.com/Maximax67/Words-CEFR-Dataset/main/csv/words.csv",
    "https://raw.githubusercontent.com/Maximax67/Words-CEFR-Dataset/main/csv/word_pos.csv",
]

# CEFR-J labels A1–B2; the dataset's level 6 is its "above B2" bucket,
# which we split by frequency into C1 (more common) and C2 (rarer).
LEVEL_NAMES = {1: "A1", 2: "A2", 3: "B1", 4: "B2", 6: "ADV"}

# New words per level → cumulative ≈ 600 / 1300 / 2800 / 4800 / 5800 / 6800
CAPS = {"A1": 600, "A2": 700, "B1": 1500, "B2": 2000, "ADV": 2000}
C1_SHARE = 1000  # first (most frequent) advanced words → C1, rest → C2

_WORD_OK = re.compile(r"^[a-z][a-z'-]*$")
_SINGLE_LETTER_OK = {"a", "i"}
# skip proper nouns (14=NNP, 15=NNPS), symbols, list markers, foreign words
_SKIP_POS = {"5", "10", "14", "15", "24"}


def main() -> int:
    words_path = RAW / "words.csv"
    pos_path = RAW / "word_pos.csv"
    if not words_path.exists() or not pos_path.exists():
        print("raw CSVs missing — download them into data/raw/ from:")
        for url in SOURCE_URLS:
            print(f"  {url}")
        return 1

    id_to_word: dict[str, str] = {}
    with open(words_path, encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            id_to_word[row["word_id"]] = row["word"]

    # per word: easiest level across its POS entries, highest frequency
    best: dict[str, tuple[int, int]] = {}  # word -> (min_level, max_freq)
    with open(pos_path, encoding="utf-8") as fh:
        for row in csv.DictReader(fh):
            if row["pos_tag_id"] in _SKIP_POS:
                continue
            word = id_to_word.get(row["word_id"], "")
            lowered = word.lower()
            if not (_WORD_OK.match(lowered) or lowered in _SINGLE_LETTER_OK):
                continue
            try:
                level = int(row["level"])
                freq = int(row["frequency_count"] or 0)
            except ValueError:
                continue
            if level not in LEVEL_NAMES:
                continue
            prev = best.get(lowered)
            if prev is None:
                best[lowered] = (level, freq)
            else:
                best[lowered] = (min(prev[0], level), max(prev[1], freq))

    by_level: dict[str, list[tuple[str, int]]] = {v: [] for v in LEVEL_NAMES.values()}
    for word, (level, freq) in best.items():
        by_level[LEVEL_NAMES[level]].append((word, freq))

    levels: dict[str, list[str]] = {}
    for name, items in by_level.items():
        items.sort(key=lambda t: (-t[1], t[0]))  # frequency first
        chosen = [w for w, _ in items[: CAPS[name]]]
        if name == "ADV":
            levels["C1"] = chosen[:C1_SHARE]
            levels["C2"] = chosen[C1_SHARE:]
        else:
            levels[name] = chosen

    data = {
        "source": "Words-CEFR-Dataset (CEFR-J based), MIT license",
        "source_url": "https://github.com/Maximax67/Words-CEFR-Dataset",
        "note": ("Most frequent words per CEFR level; caps chosen so "
                 "cumulative sizes track official list sizes."),
        "levels": levels,
    }
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=0),
                   encoding="utf-8")
    total = 0
    for name in ("A1", "A2", "B1", "B2", "C1", "C2"):
        total += len(levels[name])
        print(f"{name}: {len(levels[name]):>5} new words   (cumulative {total})")
    print(f"wrote {OUT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
