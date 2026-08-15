"""Tests for ADR-0007 — the criterion scheduler, the error-type queue, the
mixed session and the honest metrics. All deterministic: no LLM anywhere in
any of it."""

from datetime import date, timedelta

import pytest

from src import error_queue, metrics, session, srs
from src.knowledge import categories
from src.nodes.drills import drills

DAY = date(2026, 8, 14)


def _profile(**overrides) -> dict:
    base = {"learner_id": "t", "level": "B1", "weak_points": [],
            "error_counts": {}, "xp": 0, "streak_days": 0,
            "last_active_date": None, "badges": [],
            "quiz_correct": 0, "vocab_correct": 0,
            "accuracy_history": [], "length_history": []}
    base.update(overrides)
    return base


# ── the criterion scheduler ──────────────────────────────────────────

def test_mastery_needs_distinct_days_not_repeat_answers():
    store = {}
    for _ in range(5):                      # five right answers, all today
        srs.review(store, "g1", True, DAY)
    assert store["g1"]["streak"] == 1       # one day counted
    assert not srs.mastered(store["g1"])

    for extra in (1, 2):
        srs.review(store, "g1", True, DAY + timedelta(days=extra))
    assert store["g1"]["streak"] == srs.MASTERY_STREAK
    assert srs.mastered(store["g1"])


def test_lapse_relearns_and_keeps_history():
    store = {}
    srs.review(store, "g1", True, DAY)
    srs.review(store, "g1", True, DAY + timedelta(days=1))
    before_ease = store["g1"]["ease"]

    rec = srs.review(store, "g1", False, DAY + timedelta(days=4))
    assert rec["interval"] == 0                      # comes back today
    assert rec["due"] == (DAY + timedelta(days=4)).isoformat()
    assert rec["streak"] == 0 and rec["days"] == []  # criterion restarts
    assert rec["lapses"] == 1
    assert 1.3 <= rec["ease"] < before_ease          # history survives


def test_four_lapses_make_a_leech_and_it_leaves_rotation():
    store = {}
    for i in range(srs.LEECH_LAPSES):
        srs.review(store, "g1", False, DAY + timedelta(days=i))
    assert srs.is_leech(store["g1"])
    assert srs.due_ids(store, ["g1"], DAY + timedelta(days=9)) == []
    assert srs.pick_session(store, ["g1"], 5, DAY) == []
    assert srs.leeches(store, ["g1"]) == ["g1"]


def test_intervals_are_fuzzed_but_stay_deterministic():
    long_intervals = {}
    for item_id in [f"g{i}" for i in range(40)]:
        store = {item_id: {"ease": 2.5, "interval": 20, "reps": 5,
                           "streak": 3, "days": [], "lapses": 0}}
        rec = srs.review(store, item_id, True, DAY)
        long_intervals[item_id] = rec["due"]
    assert len(set(long_intervals.values())) > 1        # the cohort spreads
    # ... and the same item always lands on the same day
    store = {"g0": {"ease": 2.5, "interval": 20, "reps": 5,
                    "streak": 3, "days": [], "lapses": 0}}
    assert srs.review(store, "g0", True, DAY)["due"] == long_intervals["g0"]


def test_short_intervals_are_never_fuzzed():
    store = {}
    rec = srs.review(store, "anything", True, DAY)
    assert rec["due"] == (DAY + timedelta(days=1)).isoformat()


def test_a_wrong_pretest_guess_is_not_a_lapse():
    store = {}
    srs.introduce(store, "milk", DAY)          # guessed wrong, but never taught
    rec = store["milk"]
    assert rec["lapses"] == 0 and rec["streak"] == 0
    assert rec["ease"] == 2.5                  # nothing was punished
    assert rec["due"] == (DAY + timedelta(days=1)).isoformat()
    assert not srs.mastered(rec) and not srs.is_leech(rec)


def test_introducing_an_item_twice_does_not_move_it():
    store = {}
    srs.introduce(store, "milk", DAY)
    srs.review(store, "milk", True, DAY + timedelta(days=1))
    after = dict(store["milk"])
    srs.introduce(store, "milk", DAY + timedelta(days=2))
    assert store["milk"] == after              # only the first meeting counts


def test_a_pretested_item_still_needs_three_days_to_master():
    store = {}
    srs.introduce(store, "milk", DAY)
    for day in (1, 2, 3):
        srs.review(store, "milk", True, DAY + timedelta(days=day))
    assert srs.mastered(store["milk"])
    assert store["milk"]["reps"] == 4          # the meeting counted as exposure


def test_new_material_stops_when_the_backlog_is_deep():
    ids = [f"g{i}" for i in range(60)]
    store = {i: {"ease": 2.5, "interval": 1, "reps": 1, "streak": 1,
                 "days": [], "lapses": 0, "due": DAY.isoformat()}
             for i in ids[:srs.BACKLOG_CAP + 5]}
    session_ids = srs.pick_session(store, ids, 5, DAY)
    assert all(i in store for i in session_ids)   # nothing new was added


# ── the error-type queue ─────────────────────────────────────────────

TEXT = "I am geologist. Yesterday I go to the site."
EDITS = [
    {"category": "articles", "original": "am geologist",
     "corrected": "am a geologist", "start": 2, "end": 14},
    {"category": "tense_aspect", "original": "go", "corrected": "went",
     "start": 28, "end": 30},
]


def _queue_with_entry(entry_id="e1", edits=None, day=DAY):
    store = error_queue._blank_store()
    error_queue.fold(store, edits if edits is not None else EDITS,
                     entry_id, TEXT, day)
    return store


def test_repair_blanks_the_learners_own_sentence():
    repair = error_queue.build_repair(TEXT, EDITS[0])
    assert repair["mode"] == "chunk"
    assert repair["sentence"] == "I am geologist."
    assert repair["prompt"] == "I _____."
    assert repair["answer"] == "am a geologist"
    # the answer is what the corrector produced — never assembled text
    assert repair["answer"] == EDITS[0]["corrected"]


def test_repair_handles_a_pure_deletion():
    text = "I did not went there."
    edit = {"category": "verb_form", "original": "did not went",
            "corrected": "did not go", "start": 2, "end": 14}
    assert error_queue.build_repair(text, edit)["mode"] == "chunk"

    deletion = {"category": "determiners", "original": "the ", "corrected": "",
                "start": 0, "end": 4}
    repair = error_queue.build_repair("the everyone came.", deletion)
    assert repair["mode"] == "sentence"
    assert "⟦the ⟧" in repair["prompt"]
    assert repair["answer"] == "everyone came."


def test_new_errors_are_due_tomorrow_never_today():
    store = _queue_with_entry()
    assert error_queue.due(store, today=DAY) == []
    tomorrow = [i["key"] for i in error_queue.due(store, today=DAY + timedelta(days=1))]
    assert "articles:am geologist" in tomorrow


def test_untreatable_errors_are_never_drilled():
    store = _queue_with_entry()
    assert not categories()["tense_aspect"]["treatable"]
    keys = [i["key"] for i in error_queue.due(store, today=DAY + timedelta(days=5))]
    assert "tense_aspect:go" not in keys


def test_untreatable_errors_come_back_as_something_to_read():
    store = _queue_with_entry()
    later = DAY + timedelta(days=1)
    shown = error_queue.exposures(store, n=2, today=later)
    assert [i["key"] for i in shown] == ["tense_aspect:go"]

    note = error_queue.to_exposure(shown[0])
    assert note["kind"] == "exposure"
    assert note["yours"] == "go" and note["natural"] == "went"
    assert "answer" not in note and "prompt" not in note   # nothing to type

    error_queue.mark_shown(store, "tense_aspect:go", later)
    item = store["items"]["tense_aspect:go"]
    assert item["shown"] == 1
    assert item["streak"] == 0        # reading is not retrieval — never mastery
    assert item["due"] > later.isoformat()
    assert error_queue.exposures(store, today=later) == []   # not twice in a day


def test_an_exposure_is_never_scored_as_a_drill():
    store = _queue_with_entry()
    assert error_queue.due(store, n=5, today=DAY + timedelta(days=1)) != []
    assert all(i["treatable"] for i in
               error_queue.due(store, n=5, today=DAY + timedelta(days=1)))


def test_untreatable_errors_graduate_by_absence_alone():
    store = _queue_with_entry()
    for i in range(error_queue.CLEAN_UNTREATABLE):
        error_queue.fold(store, [], f"clean{i}", "A clean entry.", DAY)
    assert store["items"]["tense_aspect:go"]["state"] == "graduated"


def test_graduation_needs_the_criterion_and_a_clean_entry():
    store = _queue_with_entry()
    key = "articles:am geologist"
    for i in range(srs.MASTERY_STREAK):     # repaired on three distinct days
        error_queue.record(store, key, True, DAY + timedelta(days=i + 1))
    assert store["items"][key]["state"] == "drilling"   # drilled, not proven

    error_queue.fold(store, [], "e2", "A clean entry.", DAY + timedelta(days=5))
    error_queue.fold(store, [], "e3", "Another clean one.", DAY + timedelta(days=6))
    assert store["items"][key]["state"] == "graduated"


def test_a_fossilised_error_cannot_graduate_by_absence_alone():
    store = error_queue._blank_store()
    for i in range(error_queue.FOSSIL_SEEN):       # written three times
        error_queue.fold(store, EDITS[:1], f"e{i}", TEXT, DAY)
    key = "articles:am geologist"
    assert store["items"][key]["seen"] == error_queue.FOSSIL_SEEN

    for i in range(error_queue.FADE_ENTRIES + 2):  # then never again
        error_queue.fold(store, [], f"clean{i}", "A clean entry.", DAY)
    assert store["items"][key]["state"] == "queued"   # still owes a repair


def test_a_relapse_re_enters_with_its_history():
    store = _queue_with_entry()
    key = "articles:am geologist"
    for i in range(srs.MASTERY_STREAK):
        error_queue.record(store, key, True, DAY + timedelta(days=i + 1))
    error_queue.fold(store, [], "e2", "Clean.", DAY)
    error_queue.fold(store, [], "e3", "Clean.", DAY)
    assert store["items"][key]["state"] == "graduated"
    interval = store["items"][key]["interval"]

    error_queue.fold(store, EDITS[:1], "e4", TEXT, DAY + timedelta(days=10))
    item = store["items"][key]
    assert item["state"] == "queued"
    assert item["lapses"] == 1
    assert item["interval"] == max(1, interval // 2)   # halved, not erased
    assert item["seen"] == 2                           # the history is kept


def test_repeated_failure_stops_the_drill_and_asks_for_the_lesson():
    store = _queue_with_entry()
    key = "articles:am geologist"
    for i in range(srs.LEECH_LAPSES):
        error_queue.record(store, key, False, DAY + timedelta(days=i + 1))
    assert store["items"][key]["state"] == "leech"
    assert error_queue.due(store, today=DAY + timedelta(days=30)) == []
    assert error_queue.summary(store)["leeches"] == 1

    error_queue.clear_leech(store, key, DAY + timedelta(days=31))
    assert store["items"][key]["state"] == "queued"
    assert store["items"][key]["lapses_before_lesson"] == srs.LEECH_LAPSES


def test_one_item_per_category_per_session():
    edits = [
        {"category": "articles", "original": "am geologist",
         "corrected": "am a geologist", "start": 2, "end": 14},
        {"category": "articles", "original": "go to site",
         "corrected": "go to the site", "start": 0, "end": 0},
    ]
    text = "I am geologist. Yesterday I go to site."
    store = error_queue._blank_store()
    error_queue.fold(store, edits, "e1", text, DAY)
    picked = error_queue.due(store, n=3, today=DAY + timedelta(days=1))
    assert len(picked) == 1


def test_blocking_errors_outrank_cosmetic_ones():
    text = "i am geologist."
    edits = [
        {"category": "capitalization", "original": "i", "corrected": "I",
         "start": 0, "end": 1},
        {"category": "copula", "original": "am geologist",
         "corrected": "am a geologist", "start": 2, "end": 14},
    ]
    store = error_queue._blank_store()
    error_queue.fold(store, edits, "e1", text, DAY)
    picked = error_queue.due(store, n=2, today=DAY + timedelta(days=1))
    assert picked[0]["category"] == "copula"   # blocking: high beats low


def test_the_queue_key_matches_the_fossilisation_key():
    from src.nodes.memory import _fossil_key
    assert (error_queue.key_for("articles", "Am  Geologist")
            == _fossil_key("articles", "Am  Geologist"))


# ── the mixed session ────────────────────────────────────────────────

def test_review_is_interleaved_across_decks():
    mixed = session.interleave([["a1", "a2", "a3"], ["b1", "b2"], ["c1"]])
    assert [i for _, i in mixed] == ["a1", "b1", "c1", "a2", "b2", "a3"]


def test_a_miss_comes_back_later_in_the_same_session():
    items = [{"deck": "grammar", "id": f"g{i}", "kind": "review"} for i in range(6)]
    after = session.requeue(items, 0)
    assert len(after) == 7
    assert after[0]["id"] == "g0" and after[0]["kind"] == "review"
    assert after[session.LAG + 1]["id"] == "g0"
    assert after[session.LAG + 1]["kind"] == "relearn"   # and is not requeued again


def test_a_miss_near_the_end_still_comes_back():
    items = [{"deck": "vocab", "id": "w1", "kind": "review"}]
    after = session.requeue(items, 0)
    assert [i["kind"] for i in after] == ["review", "relearn"]


def test_plan_mixes_decks_and_blocks_new_material():
    profile = _profile()
    plan = session.plan(profile, n=8, today=DAY)
    assert plan["items"], "a fresh learner should still get a session"
    assert all(i["kind"] == "new" for i in plan["new"])
    assert len({i["deck"] for i in plan["new"]}) <= 1   # new material is blocked
    # day one has no reviews to crowd, so it may meet more than the daily cap
    assert len(plan["new"]) == srs.NEW_WHEN_IDLE


def test_new_material_returns_to_the_daily_cap_once_reviews_exist():
    profile = _profile()
    from src.quiz import grammar_items_for
    ids = [i["id"] for i in grammar_items_for(profile)]
    srs.save_store("t", "grammar", {
        ids[0]: {"ease": 2.5, "interval": 1, "reps": 1, "streak": 1,
                 "days": [], "lapses": 0, "due": DAY.isoformat()}})
    plan = session.plan(profile, n=12, today=DAY)
    assert plan["backlog"] == 1
    assert len(plan["new"]) == srs.NEW_PER_SESSION


def test_plan_serves_review_only_when_the_backlog_is_deep():
    profile = _profile()
    store = {}
    ids = [i["id"] for i in
           __import__("src.quiz", fromlist=["x"]).grammar_items_for(profile)]
    for item_id in ids[:srs.BACKLOG_CAP + 2]:
        store[item_id] = {"ease": 2.5, "interval": 1, "reps": 1, "streak": 1,
                          "days": [], "lapses": 0, "due": DAY.isoformat()}
    srs.save_store("t", "grammar", store)
    plan = session.plan(profile, n=10, today=DAY)
    assert plan["capped"] is True
    assert plan["new"] == []


# ── the fluency minute ───────────────────────────────────────────────

def _master(deck: str, item_id: str) -> None:
    store = srs.load_store("t", deck)
    for day in range(srs.MASTERY_STREAK):
        srs.review(store, item_id, True, DAY + timedelta(days=day * 3))
    srs.save_store("t", deck, store)


def test_the_fluency_pool_holds_only_mastered_typed_items():
    from src.quiz import grammar_items_for, talk_bank
    profile = _profile()
    assert session.fluency_pool(profile) == []      # nothing mastered yet

    grammar_id = grammar_items_for(profile)[0]["id"]
    _master("grammar", grammar_id)
    # a half-learned item does not qualify
    store = srs.load_store("t", "grammar")
    srs.review(store, grammar_items_for(profile)[1]["id"], True, DAY)
    srs.save_store("t", "grammar", store)

    pool = session.fluency_pool(profile)
    assert [i["id"] for i in pool] == [grammar_id]
    assert pool[0]["kind"] == "fluency"

    # a mastered multiple-choice talk item is still excluded: you cannot get
    # faster at producing something you only ever picked from a list
    reply = next(i["id"] for i in talk_bank() if i["kind"] == "reply")
    _master("talk", reply)
    assert reply not in [i["id"] for i in session.fluency_pool(profile)]


def test_a_fluency_round_never_counts_as_recall():
    attempts = [
        {"d": "2026-08-14", "deck": "grammar", "id": "g1", "iv": 30,
         "ok": True, "prod": True, "ms": 2400, "fl": 1},
        {"d": "2026-08-14", "deck": "grammar", "id": "g2", "iv": 30,
         "ok": False, "prod": True, "ms": 5000, "fl": 1},
    ]
    assert metrics.delayed_accuracy(attempts) == {"n": 0, "pct": None}
    assert metrics.first_attempts(attempts) == []


def test_the_fluency_metric_compares_the_last_two_rounds():
    attempts = [
        {"d": "2026-08-10", "deck": "grammar", "id": "g1", "iv": 0,
         "ok": True, "prod": True, "ms": 5000, "fl": 1},
        {"d": "2026-08-10", "deck": "grammar", "id": "g2", "iv": 0,
         "ok": True, "prod": True, "ms": 7000, "fl": 1},
        {"d": "2026-08-14", "deck": "grammar", "id": "g1", "iv": 0,
         "ok": True, "prod": True, "ms": 3000, "fl": 1},
        {"d": "2026-08-14", "deck": "grammar", "id": "g3", "iv": 0,
         "ok": False, "prod": True, "ms": 900, "fl": 1},   # wrong: not timed
    ]
    report = metrics.fluency(attempts)
    assert report == {"n": 1, "median_ms": 3000, "previous_ms": 6000, "rounds": 2}


# ── the honest metrics ───────────────────────────────────────────────

def test_delayed_accuracy_ignores_items_that_were_not_away_long():
    attempts = [
        {"d": "2026-08-14", "deck": "grammar", "id": "g1", "iv": 1, "ok": False, "prod": True},
        {"d": "2026-08-14", "deck": "grammar", "id": "g2", "iv": 10, "ok": True, "prod": True},
        {"d": "2026-08-14", "deck": "grammar", "id": "g3", "iv": 21, "ok": False, "prod": True},
    ]
    assert metrics.delayed_accuracy(attempts) == {"n": 2, "pct": 50}


def test_a_retry_in_the_same_session_is_not_new_evidence():
    attempts = [
        {"d": "2026-08-14", "deck": "grammar", "id": "g1", "iv": 9, "ok": False, "prod": True},
        {"d": "2026-08-14", "deck": "grammar", "id": "g1", "iv": 0, "ok": True, "prod": True},
    ]
    assert metrics.delayed_accuracy(attempts) == {"n": 1, "pct": 0}


def test_only_typed_answers_count_as_production():
    srs.save_store("t", "grammar", {
        "g1": {"ease": 2.5, "interval": 30, "reps": 4, "streak": 3,
               "days": [], "lapses": 0, "due": "2026-09-01"},
        "g2": {"ease": 2.5, "interval": 40, "reps": 4, "streak": 3,
               "days": [], "lapses": 0, "due": "2026-09-01"},
    })
    attempts = [
        {"d": "2026-08-14", "deck": "grammar", "id": "g1", "iv": 21, "ok": True, "prod": True},
        {"d": "2026-08-14", "deck": "grammar", "id": "g2", "iv": 21, "ok": True, "prod": False},
    ]
    assert metrics.productive_mature("t", attempts) == {"mature": 2, "productive": 1}


def test_the_error_rate_is_never_reported_without_entry_length():
    profile = _profile(accuracy_history=[10, 10, 10, 10, 10, 4, 4, 4, 4, 4],
                       length_history=[100] * 5 + [30] * 5)
    rate = metrics.error_rate(profile)
    assert rate["recent"] == 4 and rate["previous"] == 10
    assert rate["shorter_entries"] is True   # improvement is avoidance here


def test_the_report_separates_progress_from_habit():
    profile = _profile(xp=900, streak_days=40)
    report = metrics.report(profile)
    assert report["habit"]["xp"] == 900
    assert "xp" not in report["error_rate"]
    text = metrics.format_report(report)
    assert "Habit (not progress)" in text
    assert text.index("What you can do") < text.index("Habit (not progress)")


def test_an_attempt_log_round_trips():
    metrics.log_attempt("t", "grammar", "g1", 8, True, produced=True, today=DAY)
    metrics.log_attempt("t", "vocab", "milk", 0, False, produced=False, today=DAY)
    log = metrics.load_log("t")
    assert [a["id"] for a in log] == ["g1", "milk"]
    assert log[0] == {"d": DAY.isoformat(), "deck": "grammar", "id": "g1",
                      "iv": 8, "ok": True, "prod": True}


# ── the drills node: repair first, model last ────────────────────────

def _state_with_edits(risk: str = "none"):
    return {
        "text": TEXT,
        "learner": _profile(),
        "distress": {"risk": risk, "signals": []},
        "labelled_edits": [dict(e, displayed=True, severity="high")
                           for e in EDITS],
    }


def test_drills_are_repairs_of_the_learners_own_sentence():
    result = drills(_state_with_edits())
    items = result["drills"]
    assert items and all(d["source"] == "today" for d in items)
    assert items[0]["prompt"] == "I _____."
    assert items[0]["answer"] == "am a geologist"
    assert "prompt_versions" not in result      # no LLM call was made


def test_untreatable_categories_are_not_drilled():
    items = drills(_state_with_edits())["drills"]
    drilled = [d for d in items if d.get("kind") != "exposure"]
    assert all(d["category"] != "tense_aspect" for d in drilled)


def test_the_drills_node_carries_the_exposure_note():
    # an untreatable error from an earlier entry — today's is already in the
    # teacher's own feedback, the queue is what brings it back later
    store = error_queue._blank_store()
    error_queue.fold(store, EDITS, "old", TEXT, date.today() - timedelta(days=3))
    error_queue.save("t", store)

    state = _state_with_edits()
    notes = [d for d in drills(state)["drills"] if d.get("kind") == "exposure"]
    assert [n["category"] for n in notes] == ["tense_aspect"]
    assert notes[0]["natural"] == "went"


def test_drills_fall_back_to_generation_when_there_is_nothing_to_repair(stub_llm):
    state = {"text": "", "learner": _profile(), "labelled_edits": [
        {"category": "articles", "original": "x", "corrected": "y",
         "displayed": True}]}
    result = drills(state)
    assert "prompt_versions" in result          # the model path ran
    assert all(d.get("source") == "model" for d in result["drills"])


def test_no_errors_means_no_drills():
    assert drills({"text": "All fine.", "learner": _profile(),
                   "distress": {"risk": "none"},
                   "labelled_edits": []})["drills"] == []


def test_a_distressed_entry_is_never_handed_back_as_an_exercise(stub_llm):
    """The teacher still corrects an `elevated` entry — it quotes the span.
    A repair quotes the whole sentence, so that path stays shut."""
    result = drills(_state_with_edits("elevated"))
    assert all(d.get("source") != "today" for d in result["drills"])
    assert all("your_version" not in d for d in result["drills"])


# ── retention: whose sentences may be replayed ───────────────────────

def _memory_state(risk: str) -> dict:
    return {"entry_id": "e1", "text": TEXT, "learner": _profile(),
            "triage": {"word_count": 9},
            "distress": {"risk": risk, "signals": []},
            "labelled_edits": [dict(EDITS[0], displayed=True, severity="high")]}


def test_a_calm_entry_is_stored_for_repair():
    from src.nodes.memory import memory
    memory(_memory_state("none"))
    assert "articles:am geologist" in error_queue.load("t")["items"]


def test_a_distressed_entry_is_counted_but_never_replayed():
    from src.nodes.memory import memory
    result = memory(_memory_state("elevated"))
    # the error still counts towards weak points and fossilisation ...
    assert result["learner"]["error_counts"]["articles"] == 1
    # ... but its sentence is never stored to be shown back as an exercise
    assert error_queue.load("t")["items"] == {}


# ── the taxonomy gained one field, and it is complete ────────────────

def test_every_category_declares_whether_it_is_treatable():
    for name, cat in categories().items():
        assert isinstance(cat.get("treatable"), bool), f"{name} has no treatable flag"


def test_the_untreatable_set_is_the_documented_one():
    untreatable = {n for n, c in categories().items() if not c["treatable"]}
    assert untreatable == {"prepositions", "collocation", "word_choice",
                           "register", "tense_aspect"}


@pytest.mark.parametrize("name", ["copula", "articles", "verb_agreement",
                                  "plurals", "word_order"])
def test_the_high_frequency_systems_stay_drillable(name):
    assert categories()[name]["treatable"] is True
