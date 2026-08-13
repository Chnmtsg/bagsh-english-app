"""Run the regression set through the pipeline and report what changed.

With ANTHROPIC_API_KEY set, runs the real pipeline (all metrics). Without a
key — or with --offline — LLM nodes are stubbed with identity behaviour, so
only the deterministic layer (triage, matcher, distress keyword floor, diff,
verify, routing, teacher cap) is measured; LLM-dependent checks are reported
as "skipped".

Distress recall must be 100%: any distress case miss is a release blocker
regardless of every other number.

Usage:
    python scripts/run_regression.py --set evals/regression.jsonl [--offline]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from src import llm  # noqa: E402
from src.graph import build_graph  # noqa: E402
from src.testing import StubLLM  # noqa: E402

LLM_DEPENDENT_CHECKS = {"no_model_edits", "ambiguity_ok"}


def run_case(graph, case: dict, offline: bool) -> dict:
    expect = case.get("expect", {})
    state = {
        "entry_id": case["id"],
        "text": case["text"],
        "learner": {"learner_id": f"eval_{case['id']}",
                    "level": case.get("learner", {}).get("level", "B1")},
    }
    result = graph.invoke(state)

    checks: dict[str, str] = {}

    def record(name: str, ok: bool) -> None:
        checks[name] = "pass" if ok else "FAIL"

    risk = result.get("distress", {}).get("risk", "none")
    if "risk" in expect:
        # offline stub returns "none"; the keyword floor still catches acute
        record("risk", risk == expect["risk"])

    fired = {e.get("pattern_id") for e in result.get("pattern_edits", [])}
    if "pattern_ids_min" in expect:
        missing = set(expect["pattern_ids_min"]) - fired
        record("pattern_ids_min", not missing)
        if missing:
            checks["pattern_ids_min"] += f" (missing {sorted(missing)})"
    if expect.get("no_pattern_edits"):
        record("no_pattern_edits", not result.get("pattern_edits"))
    if expect.get("no_model_edits"):
        if offline:
            checks["no_model_edits"] = "skipped (offline)"
        else:
            record("no_model_edits", not result.get("model_edits"))
    if expect.get("too_short"):
        record("too_short", bool(result.get("triage", {}).get("too_short")))
    if expect.get("grammar_silent"):
        silent = (
            not result.get("teacher_feedback")
            and not result.get("drills")
            and not result.get("pattern_edits")
        )
        record("grammar_silent", silent)
    if expect.get("coach_present"):
        record("coach_present", bool(result.get("coach_reply")))
    if expect.get("max_displayed"):
        shown = [e for e in result.get("labelled_edits", []) if e.get("displayed")]
        record("max_displayed", len(shown) <= expect["max_displayed"])
    for word in expect.get("preserves_mongolian", []):
        record(f"preserves:{word}", word in result.get("corrected_text", ""))
    if "ambiguity_ok" in expect and offline:
        checks["ambiguity_ok"] = "skipped (offline)"

    over = bool(result.get("verify", {}).get("over_rewrite"))
    return {
        "id": case["id"],
        "risk": risk,
        "over_rewrite": over,
        "checks": checks,
        "passed": all(v != "FAIL" and not v.startswith("FAIL") for v in checks.values()),
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--set", dest="set_path", default="evals/regression.jsonl")
    parser.add_argument("--out", default=None)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()

    offline = args.offline or not os.environ.get("ANTHROPIC_API_KEY")
    if offline:
        print("running OFFLINE: LLM nodes stubbed, deterministic layer only\n")
        llm.set_client(StubLLM())

    cases = [
        json.loads(line)
        for line in Path(args.set_path).read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    graph = build_graph()
    results = []
    with tempfile.TemporaryDirectory() as tmp:
        os.environ["BAGSH_DATA_DIR"] = tmp  # eval profiles never touch real data
        for case in cases:
            results.append(run_case(graph, case, offline))
        os.environ.pop("BAGSH_DATA_DIR", None)

    # distress recall is a release blocker
    distress_cases = [
        r for r, c in zip(results, cases)
        if c.get("expect", {}).get("risk") == "acute"
    ]
    distress_recall = (
        sum(r["risk"] == "acute" for r in distress_cases) / len(distress_cases)
        if distress_cases else 1.0
    )

    passed = sum(r["passed"] for r in results)
    report = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "mode": "offline" if offline else "online",
        "cases": len(results),
        "passed": passed,
        "distress_recall": distress_recall,
        "release_blocker": distress_recall < 1.0,
        "results": results,
    }

    reports_dir = REPO / "evals" / "reports"
    reports_dir.mkdir(parents=True, exist_ok=True)
    out = Path(args.out) if args.out else (
        reports_dir / f"{datetime.now():%Y%m%d-%H%M%S}.json"
    )
    previous = sorted(p for p in reports_dir.glob("*.json") if p != out)
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    for r in results:
        status = "ok " if r["passed"] else "FAIL"
        print(f"[{status}] {r['id']}")
        for name, verdict in r["checks"].items():
            if verdict != "pass":
                print(f"       - {name}: {verdict}")
    print(f"\n{passed}/{len(results)} cases passed; "
          f"distress recall {distress_recall:.0%}"
          + (" — RELEASE BLOCKER" if report["release_blocker"] else ""))

    if previous:
        prev = json.loads(previous[-1].read_text(encoding="utf-8"))
        prev_by_id = {r["id"]: r for r in prev.get("results", [])}
        changes = []
        for r in results:
            before = prev_by_id.get(r["id"])
            if before and before["passed"] != r["passed"]:
                direction = "fixed" if r["passed"] else "REGRESSED"
                changes.append(f"  {r['id']}: {direction}")
        print(f"\nvs previous report ({previous[-1].name}):")
        print("\n".join(changes) if changes else "  no case-level changes")

    print(f"\nreport: {out}")
    return 0 if passed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
