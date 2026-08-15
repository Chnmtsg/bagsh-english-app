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

WORDLIST = REPO / "knowledge" / "cefr_wordlist.json"

from src.curriculum import category_examples, curriculum_order  # noqa: E402
from src.knowledge import (  # noqa: E402
    categories,
    cefr_bands,
    load_advanced_grammar,
    load_conversations,
    load_grammar_lessons,
    load_pseudowords,
)
from src.glossary import explain_all, load_glosses  # noqa: E402
from src.reading import glossary, load_readings  # noqa: E402
from src.quiz import (  # noqa: E402
    CONTRACTIONS,
    grammar_bank,
    talk_bank,
    vocab_bank,
)


def main() -> int:
    wordlist = json.loads(WORDLIST.read_text(encoding="utf-8"))
    cats = categories()
    lessons = load_grammar_lessons()
    bands = cefr_bands()
    data = {
        "version": 3,
        "curriculum_order": curriculum_order(),
        "categories": {
            name: {
                "priority": c["priority"],
                "cefr": bands[name],
                "blocking": c["blocking"],
                "rule_a2": c["rule_a2"],
                "rule_b1": c["rule_b1"],
                "bridge": c["bridge"],
                "guide_ref": c["guide_ref"],
                "examples": category_examples(name),
                "lesson": lessons.get(name, {}),
            }
            for name, c in cats.items()
        },
        "grammar": [
            {**q, "cefr": bands.get(q["category"], "B1")} for q in grammar_bank()
        ] + [
            # advanced (C1/C2) quiz items from the lesson topics
            {
                "id": f"{t['id']}_{i}",
                "category": t["id"],
                "prompt": item["wrong"],
                "answer": item["right"],
                "also_accept": item.get("also_accept", []),
                "explanation": item.get("explanation", ""),
                "bridge": t.get("bridge", ""),
                "cefr": t["cefr"],
            }
            for t in load_advanced_grammar()
            for i, item in enumerate(t.get("quiz", []))
        ],
        # single source of truth for the PWA's grader (src/quiz.py)
        "contractions": CONTRACTIONS,
        "advanced": load_advanced_grammar(),
        "vocab": vocab_bank(),
        "dialogues": load_conversations(),
        "talk": talk_bank(),
        "wordlist": wordlist,
        # every word the Coverage Check can offer, explained — so the
        # study list never has to say "look it up in a dictionary"
        "glosses": explain_all(sorted(
            {w.lower() for level in wordlist["levels"].values() for w in level}
            | set(load_glosses())
            | {w["word"].lower() for w in vocab_bank()}
            | {g.lower() for text in load_readings()
               for g in (text.get("glosses") or {})}
        )),
        # honesty anchors for the coverage check — never teachable content
        "pseudowords": load_pseudowords(),
        # the reading library, with each text's glossary resolved against
        # the deck so the PWA never has to do the lookup itself
        "readings": [
            {**text, "glossary": glossary(text)}
            for text in load_readings()
        ],
    }
    out = REPO / "webapp" / "data.json"
    out.parent.mkdir(exist_ok=True)
    out.write_text(json.dumps(data, ensure_ascii=False, indent=1),
                   encoding="utf-8")
    print(f"wrote {out} — {len(data['grammar'])} grammar items, "
          f"{len(data['vocab'])} words, {len(data['categories'])} categories, "
          f"{len(data['readings'])} texts, {len(data['glosses'])} glosses")
    return 0


if __name__ == "__main__":
    sys.exit(main())
