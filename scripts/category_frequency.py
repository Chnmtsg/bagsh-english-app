"""Recompute category priority from real learner data.

The taxonomy's `priority` values are predicted from typology — a starting
hypothesis. Once enough entries exist, rank by measured incidence instead.

Two traps (see linguistics-curator brief):
1. The Top-100 counts distinct error TYPES, not occurrences. Rank by
   incidence per entry, never by checklist structure.
2. A category can look "solved" because learners avoid the structure
   entirely. This script cannot see avoidance — treat low counts for
   high-frequency categories (articles, agreement) with suspicion.

Usage:
    python scripts/category_frequency.py --min-entries 200
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from src.knowledge import categories  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-entries", type=int, default=200)
    parser.add_argument("--profiles", default=str(REPO / "data" / "profiles"))
    args = parser.parse_args()

    profiles_dir = Path(args.profiles)
    totals: dict[str, int] = {}
    entries = 0
    for path in sorted(profiles_dir.glob("*.json")):
        profile = json.loads(path.read_text(encoding="utf-8"))
        entries += int(profile.get("entries_count", 0))
        for cat, n in profile.get("error_counts", {}).items():
            totals[cat] = totals.get(cat, 0) + int(n)

    if entries < args.min_entries:
        print(f"only {entries} entries across profiles; need {args.min_entries} "
              "before recomputing priorities — predicted typology ordering stands")
        return 0

    taxonomy = categories()
    print(f"{entries} entries, {sum(totals.values())} labelled errors\n")
    print(f"{'category':24} {'count':>7} {'per-100-entries':>16}   predicted_priority")
    ranked = sorted(totals.items(), key=lambda kv: -kv[1])
    for cat, n in ranked:
        predicted = taxonomy.get(cat, {}).get("priority", "?")
        print(f"{cat:24} {n:>7} {100.0 * n / entries:>16.1f}   {predicted}")

    unseen = set(taxonomy) - set(totals)
    if unseen:
        print("\ncategories with zero incidence (check for avoidance, not mastery):")
        for cat in sorted(unseen):
            print(f"  {cat}")
    print("\nSuggested new priority = the ranking above; update "
          "knowledge/error_taxonomy.yaml via linguistics-curator.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
