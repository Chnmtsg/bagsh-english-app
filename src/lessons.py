"""Lesson path entry point (ADR-0002).

    python -m src.lessons                 # show level, path, and today's lesson
    python -m src.lessons --list          # show the path only
    python -m src.lessons --topic articles
    python -m src.lessons --done articles # mark a lesson studied

Curriculum order and progress are code; the LLM only renders the curated
material at the learner's level, and a failed call degrades to a
deterministic template — a lesson is never skipped because the API was down.
"""

from __future__ import annotations

import argparse
import json
import logging

from .curriculum import (
    category_examples,
    curriculum_map,
    mark_lesson_done,
    next_category,
)
from .knowledge import categories
from .llm import LLMError, get_client
from .prompts import load_prompt, render
from .state import LearnerProfile

logger = logging.getLogger(__name__)

_STATUS_ICON = {"weak": "❗", "new": "·", "seen": "○", "done": "✓"}


def _fallback_lesson(name: str, cat: dict, rule: str, examples: list[dict]) -> str:
    lines = [
        f"Lesson: {name} (priority {cat['priority']})",
        "",
        f"Rule: {rule}",
        f"Bridge: {cat['bridge']}",
        "",
        "Examples:",
    ]
    for ex in examples:
        lines.append(f"  ❌ {ex['wrong']}  →  ✅ {ex['right']}")
    lines += [
        "",
        "Practice: rewrite each ❌ sentence correctly, out loud and on paper.",
    ]
    return "\n".join(lines)


def build_lesson(profile: LearnerProfile, name: str) -> str:
    cat = categories()[name]
    level = profile.get("level", "B1")
    rule_key = "rule_a2" if level in ("A0", "A1", "A2") else "rule_b1"
    rule = cat[rule_key]
    examples = category_examples(name)

    meta, body = load_prompt("lesson")
    system = render(body, level=level, domain=profile.get("domain") or "everyday life")
    user = render(
        "Topic: {{name}}\nApproved rule: {{rule}}\nMongolian bridge: {{bridge}}\n"
        "Curated examples (wrong -> right): {{examples}}\n"
        "Learner has made {{count}} errors in this category so far.",
        name=name,
        rule=rule,
        bridge=cat["bridge"],
        examples=json.dumps(examples, ensure_ascii=False),
        count=profile.get("error_counts", {}).get(name, 0),
    )
    try:
        return get_client().complete(system=system, user=user, tier="strong", tag="lesson")
    except LLMError as exc:
        logger.warning("lesson render failed, using template: %s", exc)
        return _fallback_lesson(name, cat, rule, examples)


def format_path(profile: LearnerProfile) -> str:
    lines = [f"Level: {profile.get('level', 'B1')}   "
             f"(entries: {profile.get('entries_count', 0)}, "
             f"lessons done: {len(profile.get('lessons_done') or [])}/24)", ""]
    for row in curriculum_map(profile):
        icon = _STATUS_ICON.get(row["status"], "·")
        errors = f"  errors: {row['errors_so_far']}" if row["errors_so_far"] else ""
        lines.append(
            f"{row['priority']:>2}. {icon} {row['category']:<20} "
            f"[{row['status']}]{errors}"
        )
    lines.append("")
    lines.append("❗ weak (your journal errors)  · not studied yet  "
                 "○ seen in errors  ✓ done")
    return "\n".join(lines)


def main() -> None:
    from .nodes.memory import load_profile, memory as _  # noqa: F401
    from .nodes import memory as memory_module

    parser = argparse.ArgumentParser(description="Bagsh lesson path")
    parser.add_argument("--learner", default="default")
    parser.add_argument("--list", action="store_true", help="show the path only")
    parser.add_argument("--topic", default=None, help="study a specific category")
    parser.add_argument("--done", default=None, help="mark a category studied")
    args = parser.parse_args()

    profile = load_profile(args.learner)

    if args.done:
        if args.done not in categories():
            parser.error(f"unknown category {args.done!r}")
        from .game import XP, record_activity
        mark_lesson_done(profile, args.done)
        for badge in record_activity(profile, XP["lesson_done"]):
            print(f"🏅 New badge: {badge['icon']} {badge['name']}")
        directory = memory_module._data_dir()
        directory.mkdir(parents=True, exist_ok=True)
        with open(directory / f"{args.learner}.json", "w", encoding="utf-8") as fh:
            json.dump(profile, fh, ensure_ascii=False, indent=2)
        print(f"marked done: {args.done}")

    print("=== Your path ===")
    print(format_path(profile))

    if args.list or args.done:
        return

    topic = args.topic or next_category(profile)
    if topic not in categories():
        parser.error(f"unknown category {topic!r}")
    print(f"\n=== Today's lesson: {topic} ===\n")
    print(build_lesson(profile, topic))
    print(f"\nWhen finished: python -m src.lessons --done {topic}")
    print("Then write a journal entry using it — retrieval builds memory.")


if __name__ == "__main__":
    main()
