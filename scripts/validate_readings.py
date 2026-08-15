"""Is every reading text actually graded? (ADR-0009)

    python scripts/validate_readings.py
    python scripts/validate_readings.py --level A2      # one band
    python scripts/validate_readings.py --explain deposit

"Graded" is a measurable property, not a label a curator applies to their own
prose. A text passes when a learner at its level already knows at least 95% of
its running words (Hu & Nation 2000, assisted comprehension) AND every word
outside that band carries a gloss — so the effective coverage at the moment of
reading is 100%.

Exit code 1 on any failure, so this can gate a commit the way
validate_patterns.py does for the pattern file.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from src.console import utf8_output  # noqa: E402
from src.reading import (  # noqa: E402
    MIN_COVERAGE,
    stems,
    coverage,
    glossary,
    load_readings,
    tokenize,
    word_level,
)

MIN_QUESTIONS = 2
MIN_WORDS = 80


def check(text: dict) -> list[str]:
    problems: list[str] = []
    level = text["level"]
    report = coverage(text["body"], level)
    glossed = {w.lower() for w in (text.get("glosses") or {})}

    if report["coverage"] < MIN_COVERAGE:
        problems.append(
            f"coverage {report['coverage']:.1%} is under {MIN_COVERAGE:.0%} "
            f"for {level} — simplify the wording, do not add more glosses")

    ungossed = sorted(w for w in report["unknown"] if w not in glossed)
    if ungossed:
        problems.append("above {} and not glossed: {}".format(
            level, ", ".join(ungossed[:12]) + ("…" if len(ungossed) > 12 else "")))

    body_words = {w.lower() for w in tokenize(text["body"])}
    body_stems = {form for w in body_words for form in stems(w)}
    for word in glossed:
        # an inflection counts (`apples` glosses `apple`), a coincidence does
        # not: matching on substrings let `zebra` pass because the text had `a`
        if word not in body_stems and not any(
                word in stems(w) for w in body_words):
            problems.append(f"gloss for '{word}' but it is not in the text")

    if len(text.get("questions") or []) < MIN_QUESTIONS:
        problems.append(f"needs {MIN_QUESTIONS} comprehension questions")
    for question in text.get("questions") or []:
        options = question.get("options") or []
        correct = [o for o in options if o.get("correct")]
        if len(options) < 3:
            problems.append(f"question '{question['q'][:40]}' needs 3+ options")
        if len(correct) != 1:
            problems.append(f"question '{question['q'][:40]}' needs exactly one correct option")

    if report["tokens"] < MIN_WORDS:
        problems.append(f"only {report['tokens']} words — too short to be reading")
    return problems


def main() -> int:
    utf8_output()
    parser = argparse.ArgumentParser(description="Grade the reading library")
    parser.add_argument("--level", help="check one band only")
    parser.add_argument("--explain", help="show what level a word is judged at")
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="list the unknown words in every text")
    args = parser.parse_args()

    if args.explain:
        found = word_level(args.explain)
        print(f"{args.explain}: {found or 'not in the deck or the frequency list'}")
        return 0

    texts = [t for t in load_readings()
             if not args.level or t["level"] == args.level]
    if not texts:
        print("no texts to check")
        return 1

    failures = 0
    by_level: dict[str, int] = {}
    for text in texts:
        report = coverage(text["body"], text["level"])
        problems = check(text)
        by_level[text["level"]] = by_level.get(text["level"], 0) + 1
        mark = "ok  " if not problems else "FAIL"
        print(f"[{mark}] {text['level']} {text['id']:<22} "
              f"{report['tokens']:>4}w  coverage {report['coverage']:.1%}  "
              f"{len(glossary(text))} glosses")
        for problem in problems:
            print(f"        - {problem}")
            failures += 1
        if args.verbose and report["unknown"]:
            print(f"        unknown: {', '.join(report['unknown'])}")

    print()
    print("library: " + ", ".join(f"{level} ×{n}" for level, n in sorted(by_level.items())))
    total_words = sum(coverage(t["body"], t["level"])["tokens"] for t in texts)
    print(f"{len(texts)} texts, {total_words} running words")
    print("all texts graded" if not failures else f"{failures} PROBLEM(S)")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
