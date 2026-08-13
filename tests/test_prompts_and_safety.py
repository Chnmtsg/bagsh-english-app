from pathlib import Path

from src.knowledge import load_crisis_resources, verified_crisis_resources
from src.nodes.coach import _resources_block
from src.prompts import PROMPTS_DIR, load_prompt, render

EXPECTED_PROMPTS = {
    "corrector", "distress_classifier", "tutor", "fluency", "coach",
    "coach_wellbeing", "teacher", "drills", "level_estimator", "weekly_review",
}


def test_all_runtime_prompts_exist():
    found = {p.stem for p in PROMPTS_DIR.glob("*.md")}
    assert EXPECTED_PROMPTS <= found


def test_every_prompt_has_version_frontmatter():
    for path in Path(PROMPTS_DIR).glob("*.md"):
        meta, body = load_prompt(path.stem)
        assert meta.get("version"), f"{path.stem} missing version"
        assert body, f"{path.stem} has empty body"


def test_render_replaces_tokens():
    assert render("level {{level}} x", level="B1") == "level B1 x"


def test_coach_prompt_never_mentions_grammar_positively():
    _, body = load_prompt("coach")
    assert "Never mention English" in body or "never mention" in body.lower()


def test_wellbeing_prompt_forbids_model_generated_numbers():
    _, body = load_prompt("coach_wellbeing")
    assert "Never provide phone numbers" in body


def test_unverified_crisis_resources_are_never_shown():
    data = load_crisis_resources()
    assert data["resources"], "resources file must not be empty"
    # in the shipped state nothing is human-verified yet
    assert verified_crisis_resources() == []
    block = _resources_block()
    for r in data["resources"]:
        contact = str(r["contact"])
        assert contact not in block, (
            f"unverified resource {r['id']} leaked into the wellbeing reply"
        )
    # the human-written supportive message is still present
    assert data["supportive_message"]["en"] in block
