"""Export the curated knowledge files to webapp/data.json for the PWA.

The web app is a pure client: it renders this data and keeps progress in
localStorage. Re-run this script whenever knowledge/*.yaml changes, then
commit the regenerated data.json.

    python scripts/build_webapp_data.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from src.curriculum import category_examples, curriculum_order  # noqa: E402
from src.knowledge import categories  # noqa: E402
from src.quiz import grammar_bank, vocab_bank  # noqa: E402


def main() -> int:
    cats = categories()
    data = {
        "version": 1,
        "curriculum_order": curriculum_order(),
        "categories": {
            name: {
                "priority": c["priority"],
                "blocking": c["blocking"],
                "rule_a2": c["rule_a2"],
                "rule_b1": c["rule_b1"],
                "bridge": c["bridge"],
                "guide_ref": c["guide_ref"],
                "examples": category_examples(name),
            }
            for name, c in cats.items()
        },
        "grammar": grammar_bank(),
        "vocab": vocab_bank(),
    }
    out = REPO / "webapp" / "data.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    print(f"wrote {out} — {len(data['grammar'])} grammar items, "
          f"{len(data['vocab'])} words, {len(data['categories'])} categories")
    return 0


if __name__ == "__main__":
    sys.exit(main())
