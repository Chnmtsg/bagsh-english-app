"""Offline stub LLM client, shared by tests and the regression runner's
--offline mode. Dispatches on the `tag` each node passes to complete()."""

from __future__ import annotations

import re
from typing import Callable

_ENTRY = re.compile(r"<entry>(.*?)</entry>", re.DOTALL)


class StubLLM:
    """Deterministic canned responses; per-tag overrides for tests.

    An override may be a string, a callable (system, user) -> str, or an
    Exception instance to raise.
    """

    def __init__(self, overrides: dict[str, object] | None = None) -> None:
        self.overrides = overrides or {}
        self.calls: list[dict] = []

    def complete(self, *, system: str, user: str, tier: str = "cheap",
                 tag: str = "", max_tokens: int = 4000) -> str:
        self.calls.append({"tag": tag, "tier": tier, "system": system, "user": user})
        if tag in self.overrides:
            override = self.overrides[tag]
            if isinstance(override, Exception):
                raise override
            if isinstance(override, Callable):  # type: ignore[arg-type]
                return override(system, user)  # type: ignore[operator]
            return str(override)
        return self._default(tag, user)

    @staticmethod
    def _default(tag: str, user: str) -> str:
        if tag == "distress_classifier":
            return '{"risk": "none", "signals": []}'
        if tag == "corrector":
            m = _ENTRY.search(user)
            text = m.group(1).strip() if m else ""
            return f"<corrected>{text}</corrected>"  # identity: no model edits
        if tag in ("tutor", "fluency", "drills"):
            return "[]"
        if tag in ("coach", "coach_wellbeing"):
            return "Thank you for writing today."
        if tag == "teacher":
            return "Feedback placeholder."
        return ""
