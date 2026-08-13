"""Curriculum (code): the step-by-step lesson path.

The order is the taxonomy's `priority` (guide §1.8 — frequency × impact),
never a model's idea of the day. Status per category comes from the learner
profile; the journal pipeline and the lesson path share that profile, so
real errors pull their category's lesson forward.
"""

from __future__ import annotations

from .knowledge import categories, load_patterns
from .state import LearnerProfile


def curriculum_order() -> list[str]:
    cats = categories()
    return sorted(cats, key=lambda name: cats[name]["priority"])


def category_status(profile: LearnerProfile, name: str) -> str:
    if name in profile.get("weak_points", []):
        return "weak"
    if name in (profile.get("lessons_done") or []):
        return "done"
    if profile.get("error_counts", {}).get(name, 0) > 0:
        return "seen"
    return "new"


def next_category(profile: LearnerProfile) -> str:
    order = curriculum_order()
    by_status: dict[str, list[str]] = {"weak": [], "seen": [], "new": [], "done": []}
    for name in order:
        by_status[category_status(profile, name)].append(name)
    # weak first (real errors outrank the syllabus), then untouched syllabus,
    # then categories seen in errors but never studied, then review from the top
    for bucket in ("weak", "new", "seen"):
        if by_status[bucket]:
            return by_status[bucket][0]
    return order[0]


def curriculum_map(profile: LearnerProfile) -> list[dict]:
    cats = categories()
    return [
        {
            "category": name,
            "priority": cats[name]["priority"],
            "status": category_status(profile, name),
            "blocking": cats[name]["blocking"],
            "errors_so_far": profile.get("error_counts", {}).get(name, 0),
        }
        for name in curriculum_order()
    ]


def category_examples(name: str, limit: int = 3) -> list[dict]:
    """Wrong/right pairs for this category — the taxonomy's own example
    first, then the Top-100 checklist. Curated material, never generated."""
    tax_example = categories()[name].get("example", {})
    out = [{"wrong": tax_example.get("wrong", ""),
            "right": tax_example.get("right", ""),
            "explanation": ""}] if tax_example else []
    for p in load_patterns():
        if len(out) >= limit:
            break
        if p.get("category") != name or p.get("tier") == "professional":
            continue
        if p["wrong"] == tax_example.get("wrong"):
            continue  # already covered by the taxonomy example
        out.append({"wrong": p["wrong"], "right": p["right"],
                    "explanation": p.get("explanation", "")})
    return out


def mark_lesson_done(profile: LearnerProfile, name: str) -> None:
    done = list(profile.get("lessons_done") or [])
    if name not in done:
        done.append(name)
    profile["lessons_done"] = done
