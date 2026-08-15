"""The error-type scheduler (code) — ADR-0007, spec in
`docs/learning-engine.md` Part 4.

The journal already knew *which* errors a learner makes: `error_counts`,
`error_recurrence` and `fossilised` are recomputed every entry. What it had no
way to do was bring one back. This module gives every error a due date.

Three rules carry the design:

**Errors are keyed by category + normalised form**, the same key shape
`nodes/memory.py` already uses for fossilisation. The same mistake made twice
lands on the same item — that *is* the signal.

**A repair is a prompt, not a recast.** The drill shows the learner's own
sentence with the error span blanked and asks them to fix it; the target is
revealed after the attempt. Recasts draw the lowest uptake of any feedback
move (Lyster & Ranta 1997), and reading a correction is not retrieval. The
blank is a substring operation on text the learner wrote — no model involved,
so no model text can ever reach an answer key.

**Graduation needs free production, not a passed drill.** A treatable error
graduates when the criterion is met on distinct days *and* the form has been
absent from recent entries. Untreatable ones (word choice, collocation,
register) are never drilled and never scored — there is no rule to look up, and
drilling them mostly teaches a learner they are bad at English (Ferris 1999).

Store: `data/srs/<learner>_errors.json`, beside the three practice decks.
"""

from __future__ import annotations

import json
import re
from datetime import date, timedelta

from . import srs
from .knowledge import categories

DECK = "errors"
VERSION = 1

CLEAN_ENTRIES = 2        # entries with no recurrence before a drilled item graduates
CLEAN_UNTREATABLE = 3    # untreatable items graduate by absence alone
FADE_ENTRIES = 5         # a one-off slip fades without ever being drilled
FOSSIL_SEEN = 3          # produced this many times -> must be drilled to graduate
MAX_ENTRY_IDS = 20
_BLOCKING_WEIGHT = {"high": 3, "medium": 2, "low": 1}


# ── store ────────────────────────────────────────────────────────────

def _blank_store() -> dict:
    return {"version": VERSION, "items": {}, "categories": {},
            "entries": [], "entry_count": 0}


def load(learner_id: str) -> dict:
    store = srs.load_store(learner_id, DECK) or _blank_store()
    for key, value in _blank_store().items():
        store.setdefault(key, value)
    return store


def save(learner_id: str, store: dict) -> None:
    srs.save_store(learner_id, DECK, store)


def key_for(category: str, original: str) -> str:
    """Identical to `_fossil_key` in nodes/memory.py — deliberately, so the
    queue and the fossilisation counter agree on what "the same error" means."""
    return f"{category}:{' '.join(original.lower().split())}"


# ── building a repair out of an edit (pure string work) ──────────────

_SENTENCE_END = re.compile(r"[.!?]\s")


def _sentence_bounds(text: str, start: int, end: int) -> tuple[int, int]:
    """The sentence containing [start, end), as offsets into `text`."""
    left = 0
    for match in _SENTENCE_END.finditer(text, 0, start):
        left = match.end()
    right = len(text)
    match = _SENTENCE_END.search(text, max(end - 1, 0))
    if match:
        right = match.end()
    while left < start and text[left].isspace():
        left += 1
    return left, right


def build_repair(text: str, edit: dict) -> dict | None:
    """The learner's own sentence, with the error span removed. Returns the
    prompt/answer pair, or None when the edit cannot be located in the text
    (a span is always a real substring — `verify` guarantees it — but a
    profile loaded from an older run may carry an edit without offsets)."""
    original = edit.get("original", "")
    corrected = edit.get("corrected", "")
    start, end = edit.get("start"), edit.get("end")
    if start is None or end is None or text[start:end] != original:
        found = text.find(original) if original else -1
        if found < 0:
            return None
        start, end = found, found + len(original)

    left, right = _sentence_bounds(text, start, end)
    sentence = text[left:right].strip()
    a, b = start - left, end - left
    if not 0 <= a <= b <= len(sentence):
        return None

    if corrected.strip():
        return {"mode": "chunk",
                "sentence": sentence,
                "prompt": sentence[:a] + "_____" + sentence[b:],
                "answer": corrected}
    # a pure deletion has nothing to type into a blank: mark the extra words
    # and ask for the sentence without them
    fixed = re.sub(r"\s+", " ", sentence[:a] + sentence[b:]).strip()
    return {"mode": "sentence",
            "sentence": sentence,
            "prompt": sentence[:a] + "⟦" + original + "⟧" + sentence[b:],
            "answer": fixed}


# ── folding an entry in ──────────────────────────────────────────────

def _new_item(key: str, category: str, edit: dict, repair: dict,
              today: date) -> dict:
    cat = categories().get(category, {})
    return {
        "key": key,
        "category": category,
        "treatable": bool(cat.get("treatable", True)),
        "form": edit.get("original", ""),
        "target": edit.get("corrected", ""),
        "sentence": repair["sentence"],
        "prompt": repair["prompt"],
        "answer": repair["answer"],
        "mode": repair["mode"],
        "entry_ids": [],
        "seen": 0,
        "first_seen": today.isoformat(),
        "last_seen": today.isoformat(),
        "seen_at": 0,
        "state": "queued",
        # scheduling fields — the same shape srs.review reads and writes
        "streak": 0, "days": [], "lapses": 0, "reps": 0,
        "ease": 2.5, "interval": 0, "due": today.isoformat(),
    }


def fold(store: dict, edits: list[dict], entry_id: str, text: str,
         today: date | None = None) -> dict:
    """Add one entry's errors to the queue. Deterministic; called by
    nodes/memory.py, where every other per-entry count already lives."""
    today = today or date.today()
    tomorrow = (today.toordinal() + 1)
    due_tomorrow = date.fromordinal(tomorrow).isoformat()

    if entry_id not in store["entries"]:
        store["entries"] = (store["entries"] + [entry_id])[-50:]
        store["entry_count"] = store.get("entry_count", 0) + 1
    count = store["entry_count"]

    for edit in edits:
        category = edit.get("category") or ""
        if not category:
            continue
        repair = build_repair(text, edit)
        if repair is None:
            continue
        key = key_for(category, edit.get("original", ""))
        item = store["items"].get(key)
        if item is None:
            item = _new_item(key, category, edit, repair, today)
            store["items"][key] = item
            # new errors are due TOMORROW: re-drilling an error the learner
            # has just had explained is massed practice against an
            # explanation still sitting in working memory
            item["due"] = due_tomorrow
        else:
            if item["state"] == "graduated":     # relapse — keep the history
                item["lapses"] = item.get("lapses", 0) + 1
                item["interval"] = max(1, int(item.get("interval", 1)) // 2)
            item["state"] = "queued"
            item["streak"] = 0
            item["days"] = []
            item["due"] = due_tomorrow
            item["form"] = edit.get("original", item["form"])
            item["target"] = edit.get("corrected", item["target"])
            item.update({k: repair[k] for k in ("sentence", "prompt",
                                                "answer", "mode")})

        item["seen"] = item.get("seen", 0) + 1
        item["last_seen"] = today.isoformat()
        item["seen_at"] = count
        if entry_id not in item["entry_ids"]:
            item["entry_ids"] = (item["entry_ids"] + [entry_id])[-MAX_ENTRY_IDS:]

        cat_row = store["categories"].setdefault(
            category, {"seen": 0, "graduated": 0, "last_seen": None})
        cat_row["seen"] += 1
        cat_row["last_seen"] = today.isoformat()

    _settle(store)
    return store


# ── graduation ───────────────────────────────────────────────────────

def entries_since(store: dict, item: dict) -> int:
    """Journal entries written since this error was last produced."""
    return max(0, store.get("entry_count", 0) - int(item.get("seen_at", 0)))


def graduates(store: dict, item: dict) -> bool:
    clean = entries_since(store, item)
    if not item.get("treatable", True):
        return clean >= CLEAN_UNTREATABLE
    criterion = item.get("streak", 0) >= srs.MASTERY_STREAK
    if item.get("seen", 0) >= FOSSIL_SEEN:
        # a fossilised form has to be both repaired to criterion AND absent:
        # it has already proved it comes back on its own
        return criterion and clean >= CLEAN_ENTRIES
    return (criterion and clean >= CLEAN_ENTRIES) or clean >= FADE_ENTRIES


def _settle(store: dict) -> None:
    """Move every item to the state its evidence supports."""
    for item in store["items"].values():
        if item["state"] == "leech":
            continue
        if srs.is_leech(item):
            item["state"] = "leech"
        elif graduates(store, item):
            if item["state"] != "graduated":
                row = store["categories"].setdefault(
                    item["category"], {"seen": 0, "graduated": 0, "last_seen": None})
                row["graduated"] = row.get("graduated", 0) + 1
            item["state"] = "graduated"


# ── selecting what to drill ──────────────────────────────────────────

def _score(item: dict, today: date) -> float:
    cat = categories().get(item["category"], {})
    weight = _BLOCKING_WEIGHT.get(cat.get("blocking", "low"), 1)
    overdue = (today - date.fromisoformat(item["due"])).days
    return weight * min(item.get("seen", 1), 5) * (1 + max(0, overdue) / 7.0)


def due(store: dict, n: int = 3, today: date | None = None) -> list[dict]:
    """The items to drill now: due, treatable, not leeches, highest priority
    first, and at most one per category — spending a whole session on articles
    is neither interleaving nor kind."""
    today = today or date.today()
    stamp = today.isoformat()
    ready = [
        item for item in store["items"].values()
        if item["state"] in ("queued", "drilling")
        and item.get("treatable", True)
        and item["due"] <= stamp
    ]
    ready.sort(key=lambda i: (-_score(i, today), i["key"]))
    chosen: list[dict] = []
    seen_categories: set[str] = set()
    for item in ready:
        if len(chosen) >= n:
            break
        if item["category"] in seen_categories:
            continue
        chosen.append(item)
        seen_categories.add(item["category"])
    return chosen


def exposures(store: dict, n: int = 1, today: date | None = None) -> list[dict]:
    """Untreatable errors — word choice, collocation, register — are never
    drilled: there is no rule to look up, and turning them into a quiz mostly
    teaches a learner they are bad at English (Ferris 1999). They still have
    to be *met* again, so they come back as a read-only note showing the more
    natural version. Nothing is scored, so nothing is scheduled either: the
    item is shown when it is due and pushed out by a fixed step."""
    today = today or date.today()
    stamp = today.isoformat()
    ready = [
        item for item in store["items"].values()
        if item["state"] in ("queued", "drilling")
        and not item.get("treatable", True)
        and item["due"] <= stamp
    ]
    ready.sort(key=lambda i: (-i.get("seen", 1), i["key"]))
    return ready[:n]


def mark_shown(store: dict, key: str, today: date | None = None,
               step: int = 4) -> dict | None:
    """Record that an exposure was displayed. Expanding, but gently — an
    exposure is not a retrieval and must never move an item towards
    'mastered', so `streak` and `days` are left alone."""
    item = store["items"].get(key)
    if item is None:
        return None
    today = today or date.today()
    item["shown"] = item.get("shown", 0) + 1
    item["state"] = "drilling"
    item["interval"] = min(30, max(step, int(item.get("interval", 0)) + step))
    item["due"] = (today + timedelta(days=item["interval"])).isoformat()
    return item


def to_exposure(item: dict) -> dict:
    """One untreatable item, as something to read rather than answer."""
    cat = categories().get(item["category"], {})
    return {
        "source": "error_queue",
        "kind": "exposure",
        "key": item["key"],
        "category": item["category"],
        "your_version": item["sentence"],
        "yours": item["form"],
        "natural": item["target"],
        "rule": cat.get("rule_b1", ""),
        "rule_a2": cat.get("rule_a2", ""),
        "bridge": cat.get("bridge", ""),
        "seen": item.get("seen", 1),
    }


def to_drill(item: dict) -> dict:
    """Render one queued item as a drill for `nodes/drills.py` / `src.play`."""
    cat = categories().get(item["category"], {})
    ask = ("Type the missing words." if item["mode"] == "chunk"
           else "Type the sentence without the marked words.")
    return {
        "source": "error_queue",
        "key": item["key"],
        "category": item["category"],
        "question": f"{ask}\n{item['prompt']}",
        "prompt": item["prompt"],
        "answer": item["answer"],
        "mode": item["mode"],
        "your_version": item["sentence"],
        "rule": cat.get("rule_b1", ""),
        "rule_a2": cat.get("rule_a2", ""),
        "bridge": cat.get("bridge", ""),
        "seen": item.get("seen", 1),
    }


# ── recording an attempt ─────────────────────────────────────────────

def record(store: dict, key: str, correct: bool,
           today: date | None = None) -> dict | None:
    """Fold one repair attempt in. The item record is a superset of an SRS
    record, so the criterion scheduler in src/srs.py does the arithmetic and
    the two cannot drift."""
    item = store["items"].get(key)
    if item is None:
        return None
    srs.review(store["items"], key, correct, today)
    item["state"] = "leech" if srs.is_leech(item) else "drilling"
    _settle(store)
    return item


def clear_leech(store: dict, key: str, today: date | None = None) -> dict | None:
    """Re-teaching happened: put a leech back in rotation with a clean slate
    (its lapse history stays visible in `lapses_before_lesson`)."""
    item = store["items"].get(key)
    if item is None or item["state"] != "leech":
        return None
    today = today or date.today()
    item["lapses_before_lesson"] = item.get("lapses", 0)
    item["lapses"] = 0
    item["streak"] = 0
    item["days"] = []
    item["reps"] = 0
    item["interval"] = 0
    item["state"] = "queued"
    item["due"] = today.isoformat()
    return item


# ── reporting ────────────────────────────────────────────────────────

def summary(store: dict) -> dict:
    items = list(store["items"].values())
    by_state: dict[str, int] = {}
    for item in items:
        by_state[item["state"]] = by_state.get(item["state"], 0) + 1
    graduated_categories = sorted(
        c for c in {i["category"] for i in items}
        if all(i["state"] == "graduated"
               for i in items if i["category"] == c)
    )
    return {
        "tracked": len(items),
        "queued": by_state.get("queued", 0) + by_state.get("drilling", 0),
        "graduated": by_state.get("graduated", 0),
        "leeches": by_state.get("leech", 0),
        "categories_graduated": graduated_categories,
        "leech_keys": sorted(i["key"] for i in items if i["state"] == "leech"),
        "entries": store.get("entry_count", 0),
    }


def dumps(store: dict) -> str:
    return json.dumps(store, ensure_ascii=False, indent=2)
