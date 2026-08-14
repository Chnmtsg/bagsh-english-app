"""Validate knowledge/top_100_patterns.yaml.

Checks, in order of importance:
1. FALSE POSITIVES — every deterministic pattern is run against a corpus of
   correct English. ANY hit fails the run: the pattern must be demoted to
   contextual. A pattern that fires on correct English teaches the learner
   their correct English was wrong.
2. Round-trip — re.sub(find, replace, wrong) == right for every
   deterministic pattern. A pattern whose own example does not round-trip
   is broken.
3. Hygiene — regexes compile, ids unique, categories exist in the taxonomy.

Usage:
    python scripts/validate_patterns.py --corpus data/clean_english.txt
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from src.knowledge import categories, load_patterns  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", default="data/clean_english.txt")
    args = parser.parse_args()

    patterns = load_patterns()
    valid_categories = set(categories().keys())
    corpus_path = Path(args.corpus)
    corpus_lines = (
        corpus_path.read_text(encoding="utf-8").splitlines()
        if corpus_path.exists() else []
    )
    if not corpus_lines:
        print(f"WARNING: corpus {corpus_path} missing or empty — "
              "false-positive check skipped", file=sys.stderr)

    failures: list[str] = []
    seen_ids: set[int] = set()
    deterministic = 0

    for p in patterns:
        pid = p.get("id")
        if pid in seen_ids:
            failures.append(f"[{pid}] duplicate id")
        seen_ids.add(pid)

        if p.get("category") not in valid_categories:
            failures.append(f"[{pid}] unknown category {p.get('category')!r}")
        if p.get("tier") not in ("deterministic", "contextual", "professional"):
            failures.append(f"[{pid}] unknown tier {p.get('tier')!r}")

        alt = p.get("also_accept")
        if alt is not None:
            if not isinstance(alt, list) or not all(
                    isinstance(a, str) and a.strip() for a in alt):
                failures.append(f"[{pid}] also_accept must be a list of strings")
            else:
                for a in alt:
                    if a == p.get("wrong"):
                        failures.append(
                            f"[{pid}] also_accept contains the item's own error "
                            f"{a!r} — that would mark wrong English correct")
                    if a == p.get("right"):
                        failures.append(
                            f"[{pid}] also_accept repeats `right` {a!r}")

        if p.get("tier") != "deterministic":
            continue
        deterministic += 1

        find, replace = p.get("find"), p.get("replace")
        if not find or replace is None:
            failures.append(f"[{pid}] deterministic but missing find/replace")
            continue
        flags = 0 if p.get("case_sensitive") else re.IGNORECASE
        try:
            regex = re.compile(find, flags)
        except re.error as exc:
            failures.append(f"[{pid}] regex does not compile: {exc}")
            continue

        # round-trip: the pattern's own example must fix itself
        result = regex.sub(lambda m: m.expand(replace), p["wrong"])
        if result != p["right"]:
            failures.append(
                f"[{pid}] round-trip failed: {p['wrong']!r} -> {result!r} "
                f"(expected {p['right']!r})"
            )

        # the pattern must not touch its own `right` form
        if regex.search(p["right"]):
            failures.append(f"[{pid}] pattern matches its own corrected form")

        # zero tolerance on the clean corpus
        for line_no, line in enumerate(corpus_lines, 1):
            m = regex.search(line)
            if m:
                failures.append(
                    f"[{pid}] FALSE POSITIVE on clean corpus line {line_no}: "
                    f"matched {m.group(0)!r} in {line.strip()!r} — demote to contextual"
                )

    print(f"patterns: {len(patterns)} total, {deterministic} deterministic, "
          f"corpus lines: {len(corpus_lines)}")
    if failures:
        print(f"\n{len(failures)} FAILURE(S):")
        for f in failures:
            print(f"  {f}")
        return 1
    print("all checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
