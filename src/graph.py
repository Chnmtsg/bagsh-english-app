"""StateGraph assembly. Topology is ADR-0001 (accepted) — change the ADR
before changing this file.

The distress gate is structural: when risk is `acute`, the route skips every
grammar node, so no downstream bug can leak grammar feedback into a crisis
reply. tutor / fluency / coach run as parallel branches writing disjoint
state keys and join at memory.
"""

from __future__ import annotations

from langgraph.graph import END, START, StateGraph

from .nodes.coach import coach
from .nodes.corrector import corrector
from .nodes.diff import diff
from .nodes.distress import distress
from .nodes.drills import drills
from .nodes.fluency import fluency
from .nodes.matcher import matcher
from .nodes.memory import memory
from .nodes.teacher import teacher
from .nodes.triage import triage
from .nodes.tutor import tutor
from .nodes.verify import verify
from .state import JournalState


def route_after_distress(state: JournalState) -> str:
    if state.get("distress", {}).get("risk") == "acute":
        return "coach"  # grammar path is skipped entirely
    return "matcher"


def route_after_verify(state: JournalState) -> list[str] | str:
    if state.get("verify", {}).get("over_rewrite"):
        return "corrector"  # one bounded retry; verify disarms after MAX_ATTEMPTS
    return ["tutor", "fluency", "coach"]


def route_after_memory(state: JournalState) -> str:
    if state.get("distress", {}).get("risk") == "acute":
        return END  # no teacher voice, no drills on an acute entry
    return "teacher"


def build_graph():
    builder = StateGraph(JournalState)

    builder.add_node("triage", triage)
    builder.add_node("distress", distress)
    builder.add_node("matcher", matcher)
    builder.add_node("corrector", corrector)
    builder.add_node("diff", diff)
    builder.add_node("verify", verify)
    builder.add_node("tutor", tutor)
    builder.add_node("fluency", fluency)
    builder.add_node("coach", coach)
    builder.add_node("memory", memory)
    builder.add_node("teacher", teacher)
    builder.add_node("drills", drills)

    builder.add_edge(START, "triage")
    builder.add_edge("triage", "distress")
    builder.add_conditional_edges("distress", route_after_distress, ["coach", "matcher"])
    builder.add_edge("matcher", "corrector")
    builder.add_edge("corrector", "diff")
    builder.add_edge("diff", "verify")
    builder.add_conditional_edges(
        "verify", route_after_verify, ["corrector", "tutor", "fluency", "coach"]
    )
    builder.add_edge("tutor", "memory")
    builder.add_edge("fluency", "memory")
    builder.add_edge("coach", "memory")
    builder.add_conditional_edges("memory", route_after_memory, ["teacher", END])
    builder.add_edge("teacher", "drills")
    builder.add_edge("drills", END)

    return builder.compile()
