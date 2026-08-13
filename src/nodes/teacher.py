"""Teacher voice (llm, strong tier): the final feedback the learner reads.

Detection and display are separate (Bagsh v2 §6.1): every error is detected
upstream; how many are DISPLAYED follows learner.strictness —
    low    → errors that block meaning, + 1 pattern error
    normal → up to 3, by the §7.3 priority rule (the default)
    high   → all detected errors, grouped by pattern (the learner asked
             to be pushed — suppressing errors from them is a bug)

Selection follows v2 §7.3: blocking first, then fossilised, then category
frequency, then one-per-system (distinct categories fill the slots first).
Pattern groups are counted in CODE and handed to the model to format.
On LLM failure the feedback is assembled from taxonomy wording directly.
"""

from __future__ import annotations

import logging
from collections import Counter

from ..knowledge import categories
from ..llm import LLMError, get_client
from ..prompts import load_prompt, render
from ..state import SEVERITY_RANK, Edit, JournalState

logger = logging.getLogger(__name__)

MAX_DISPLAYED_NORMAL = 3

# Bagsh v2 §4 — response budget per level (explanation words).
_BUDGET = {"A0": 120, "A1": 120, "A2": 200, "B1": 400, "B2": 600, "C1": 0}

_LANGUAGE_POLICY = {
    "A0": "Write almost entirely in Mongolian; English appears only as the items being taught. Plain sentences, no tables.",
    "A1": "Write almost entirely in Mongolian; English appears only as the items being taught. Plain sentences, no tables.",
    "A2": "Write about 70% in Mongolian; keep English sentences short and gloss each one. Plain sentences, no tables.",
    "B1": "Write in English first, with a Mongolian gloss for the key idea only.",
    "B2": "Write in English only; use Mongolian only for interference traps.",
    "C1": "Write in English only.",
}


def _fossil_key(category: str, original: str) -> str:
    return f"{category}:{' '.join(original.lower().split())}"


def _sorted_by_priority(edits: list[Edit], profile: dict) -> list[Edit]:
    """Bagsh v2 §7.3: blocking → fossilised → frequency → position."""
    counts = profile.get("error_counts", {})
    fossilised = set(profile.get("fossilised", []))

    def sort_key(e: Edit) -> tuple:
        return (
            SEVERITY_RANK.get(e.get("severity", "low"), 2),
            0 if _fossil_key(e.get("category", ""), e.get("original", "")) in fossilised else 1,
            -counts.get(e.get("category", ""), 0),
            e.get("start", 0),
        )

    return sorted(edits, key=sort_key)


def select_edits(edits: list[Edit], profile: dict,
                 strictness: str = "normal") -> list[Edit]:
    ranked = _sorted_by_priority(edits, profile)
    if strictness == "high":
        return ranked  # all detected errors are displayed, grouped by pattern
    if strictness == "low":
        blocking = [e for e in ranked if e.get("severity") == "high"]
        rest = [e for e in ranked if e.get("severity") != "high"]
        return blocking + rest[:1]
    # normal: fill 3 slots preferring distinct categories (teach the family,
    # not the same symptom twice), then top up from the remainder
    chosen: list[Edit] = []
    seen_categories: set[str] = set()
    for e in ranked:
        if len(chosen) == MAX_DISPLAYED_NORMAL:
            break
        if e.get("category", "") not in seen_categories:
            chosen.append(e)
            seen_categories.add(e.get("category", ""))
    for e in ranked:
        if len(chosen) == MAX_DISPLAYED_NORMAL:
            break
        if e not in chosen:
            chosen.append(e)
    return chosen


def pattern_groups(edits: list[Edit]) -> str:
    """Category counts computed in code (determinism boundary): the model
    formats the grouping, it never counts."""
    taxonomy = categories()
    counts = Counter(e.get("category", "") for e in edits if e.get("category"))
    lines = []
    for cat, n in counts.most_common():
        if n < 2:
            continue
        bridge = taxonomy.get(cat, {}).get("bridge", "")
        lines.append(f"- {cat} ×{n} — {bridge}")
    return "\n".join(lines)


def teacher(state: JournalState) -> dict:
    edits = list(state.get("labelled_edits", []))
    profile = state.get("learner", {})
    level = profile.get("level", "B1")
    strictness = profile.get("strictness", "normal")
    rule_key = "rule_a2" if level in ("A0", "A1", "A2") else "rule_b1"
    taxonomy = categories()

    selected = select_edits(edits, profile, strictness)
    for edit in edits:
        edit["displayed"] = False
    for edit in selected:
        edit["displayed"] = True

    fossilised = set(profile.get("fossilised", []))
    recurrence = profile.get("error_recurrence", {})
    todays_keys = {
        _fossil_key(e.get("category", ""), e.get("original", "")) for e in edits
    }
    fossil_hits = sorted(k for k in todays_keys if k in fossilised)
    fossil_clear = sorted(fossilised - todays_keys)[:2]

    def edit_line(e: Edit) -> str:
        cat = e.get("category", "")
        rule = taxonomy.get(cat, {}).get(rule_key, "")
        bridge = taxonomy.get(cat, {}).get("bridge", "")
        expl = e.get("explanation") or rule
        return (
            f"- \"{e.get('original', '')}\" → \"{e.get('corrected', '')}\" "
            f"[{cat or 'unlabelled'}] rule: {expl} bridge: {bridge}"
        )

    edits_block = "\n".join(edit_line(e) for e in selected) or "(no errors today)"
    fossils_block = "\n".join(
        f"- RECURRED (x{recurrence.get(k, '?')}): {k}" for k in fossil_hits
    ) + ("\n" if fossil_hits and fossil_clear else "") + "\n".join(
        f"- ABSENT today (was fossilised): {k}" for k in fossil_clear
    )

    budget = _BUDGET.get(level, 400)
    meta, body = load_prompt("teacher")
    system = render(
        body,
        level=level,
        domain=profile.get("domain") or "everyday life",
        strictness=strictness,
        budget=(f"Keep the explanation under {budget} words."
                if budget else "No fixed word limit."),
        language_policy=_LANGUAGE_POLICY.get(level, _LANGUAGE_POLICY["B1"]),
    )
    user = render(
        "Entry:\n{{text}}\n\nCorrected version:\n{{corrected}}\n\n"
        "Corrections to present (already chosen by strictness "
        "'{{strictness}}' — present ONLY these):\n{{edits}}\n\n"
        "Pattern groups (counted by the system):\n{{patterns}}\n\n"
        "Fossilisation notes:\n{{fossils}}",
        text=state.get("text", ""),
        corrected=state.get("corrected_text", state.get("text", "")),
        strictness=strictness,
        edits=edits_block,
        patterns=pattern_groups(selected) or "(no repeated system)",
        fossils=fossils_block or "(none)",
    )

    try:
        feedback = get_client().complete(
            system=system, user=user, tier="strong", tag="teacher",
        )
    except LLMError as exc:
        logger.warning("teacher failed, using taxonomy template: %s", exc)
        lines = ["Here is today's feedback:"]
        for e in selected:
            cat = e.get("category", "")
            rule = taxonomy.get(cat, {}).get(rule_key, e.get("explanation", ""))
            lines.append(f'- "{e.get("original")}" → "{e.get("corrected")}". {rule}')
        if not selected:
            lines.append("No errors found in this entry.")
        feedback = "\n".join(lines)

    return {
        "teacher_feedback": feedback,
        "labelled_edits": edits,
        "prompt_versions": {"teacher": str(meta["version"])},
    }
