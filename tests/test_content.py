"""Integrity of the expanded lesson and conversation content (curated —
these tests are what 'curated' means in practice)."""

from src.knowledge import (
    categories,
    cefr_bands,
    load_advanced_grammar,
    load_conversations,
    load_grammar_lessons,
)

LEVELS = {"A1", "A2", "B1", "B2"}
ALL_LEVELS = {"A1", "A2", "B1", "B2", "C1", "C2"}


def test_supplementary_grammar_completes_b1_to_c2():
    topics = load_advanced_grammar()
    by_level = {}
    for t in topics:
        assert t["cefr"] in ("B1", "B2", "C1", "C2"), t["id"]
        assert t["id"].startswith("adv_"), "supplementary ids must not collide with categories"
        assert t["id"] not in categories(), "supplementary topics are not error categories"
        assert len(t.get("explain", "")) > 100, f"{t['id']}: explain too thin"
        assert t.get("bridge") and t.get("tip"), t["id"]
        assert len(t.get("how", [])) >= 3, f"{t['id']}: needs build steps"
        assert t.get("watch_out"), f"{t['id']}: needs a watch_out"
        assert len(t.get("examples", [])) >= 2, t["id"]
        for q in t.get("quiz", []):
            assert q["wrong"] != q["right"], t["id"]
            assert q.get("explanation"), t["id"]
        by_level.setdefault(t["cefr"], []).append(t["id"])
    assert len(by_level.get("B1", [])) >= 3   # narrative tenses, gerund/infinitive, passive
    assert len(by_level.get("B2", [])) >= 4   # deduction, wishes, causative, unreal conditionals
    assert len(by_level.get("C1", [])) >= 2   # participle clauses, hedging
    assert len(by_level.get("C2", [])) >= 3   # inversion, cleft, register shift
    # C1 is deliberately the thinnest band: the two topics that used to pad it
    # (passive, unreal conditionals) were mis-banded and now sit where learners
    # actually need them. Real C1 material is a content gap, not a tagging one.


def test_every_category_has_a_cefr_band():
    bands = cefr_bands()
    assert set(bands.keys()) == set(categories().keys())
    assert set(bands.values()) <= LEVELS
    # every band teaches something — no empty level
    for level in LEVELS:
        assert any(b == level for b in bands.values()), f"{level} band is empty"


def test_a1_band_holds_the_foundations():
    bands = cefr_bands()
    assert bands["copula"] == "A1"
    assert bands["word_order"] == "A1"
    assert bands["reported_speech"] == "B2"


def test_grammar_lessons_cover_all_24_categories():
    lessons = load_grammar_lessons()
    assert set(lessons.keys()) == set(categories().keys())


def test_every_grammar_lesson_is_complete():
    for name, lesson in load_grammar_lessons().items():
        assert len(lesson.get("explain_b1", "")) > 100, f"{name}: explain_b1 too thin"
        assert lesson.get("explain_a2"), f"{name}: missing explain_a2"
        assert len(lesson.get("how", [])) >= 3, f"{name}: needs build steps"
        assert lesson.get("watch_out"), f"{name}: needs a watch_out"
        assert len(lesson.get("extra_examples", [])) >= 2, f"{name}: needs examples"
        for ex in lesson["extra_examples"]:
            assert ex.get("wrong") and ex.get("right"), f"{name}: bad example"
        assert lesson.get("tip"), f"{name}: missing tip"


def test_dialogues_are_complete_and_leveled():
    dialogues = load_conversations()
    assert len(dialogues) >= 18
    ids = [d["id"] for d in dialogues]
    assert len(ids) == len(set(ids))
    for d in dialogues:
        assert d["level"] in ALL_LEVELS, f"{d['id']}: bad level"
        assert d.get("title_en") and d.get("title_mn") and d.get("situation")
        assert len(d["lines"]) >= 4, f"{d['id']}: dialogue too short"
        for line in d["lines"]:
            assert line["sp"] in ("A", "B")
            assert line.get("en") and line.get("mn"), f"{d['id']}: line missing en/mn"
        assert len(d.get("key_phrases", [])) >= 2
        practice = d["practice"]
        assert practice.get("situation")
        corrects = [o for o in practice["options"] if o.get("correct")]
        assert len(corrects) == 1, f"{d['id']}: exactly one correct option required"
        for option in practice["options"]:
            assert option.get("why"), f"{d['id']}: every option needs a 'why'"


def test_dialogue_levels_span_all_bands():
    levels = {d["level"] for d in load_conversations()}
    assert ALL_LEVELS <= levels  # every level A1–C2 has talks


# ── pseudoword anchors (ADR-0008) ────────────────────────────────────
#
# A "fake" word that turns out to be real would punish an honest advanced
# learner for knowing English — the exact failure the anchors exist to
# prevent. These tests are the guard, and they are why the list may only be
# extended by someone who runs them.

def test_pseudowords_are_never_real_words():
    import json
    import re

    from src.knowledge import KNOWLEDGE_DIR, load_pseudowords
    from src.quiz import geology_bank, vocab_bank

    fake = load_pseudowords()
    assert len(fake) >= 30, "too few anchors: rounds would repeat them"
    assert len(set(fake)) == len(fake), "duplicate anchor"

    wordlist = json.loads(
        (KNOWLEDGE_DIR / "cefr_wordlist.json").read_text(encoding="utf-8"))
    real = {w.lower() for level in wordlist["levels"].values() for w in level}
    real |= {w["word"].lower() for w in vocab_bank()}
    real |= {w["word"].lower() for w in geology_bank()}
    assert not (set(fake) & real), "an anchor is a real word"

    # nor may one appear in any curated English the learner is ever shown
    text = " ".join(
        path.read_text(encoding="utf-8")
        for path in KNOWLEDGE_DIR.glob("*.yaml")
        if path.name != "pseudowords.yaml"
    )
    corpus = set(re.findall(r"[a-z]+", text.lower()))
    assert not (set(fake) & corpus), "an anchor appears in curated content"


def test_pseudowords_look_like_english():
    from src.knowledge import load_pseudowords

    for word in load_pseudowords():
        assert word.islower() and word.isalpha(), word
        assert 5 <= len(word) <= 9, f"{word}: implausible length"
        assert any(v in word for v in "aeiou"), f"{word}: unpronounceable"
