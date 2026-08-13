"""Provider adapter: tier routing, retries, prompt caching, JSON parsing.

Every LLM call in the pipeline goes through `get_client().complete(...)`.
Tests inject a fake via `set_client()`. Nodes never construct API clients.

API rules honoured here (see Bagsh v2 Appendix C):
- no temperature/top_p/top_k (rejected on claude-opus-5); steer via prompt
- system prompt sent with cache_control for prompt caching
- stop_reason == "refusal" checked before reading content
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from typing import Any, Literal

logger = logging.getLogger(__name__)

Tier = Literal["cheap", "strong"]

CHEAP_MODEL = os.environ.get("BAGSH_CHEAP_MODEL", "claude-haiku-4-5-20251001")
STRONG_MODEL = os.environ.get("BAGSH_STRONG_MODEL", "claude-opus-5")

_MAX_RETRIES = 3
_BACKOFF_S = 2.0


class LLMError(Exception):
    """Raised after retries are exhausted or on refusal."""


class AnthropicClient:
    """Thin adapter over the Anthropic SDK."""

    def __init__(self) -> None:
        import anthropic  # imported lazily so tests need no SDK/key

        self._client = anthropic.Anthropic()

    def complete(
        self,
        *,
        system: str,
        user: str,
        tier: Tier = "cheap",
        tag: str = "",
        max_tokens: int = 8000,  # covers thinking + output (Bagsh v2 App. C)
    ) -> str:
        model = STRONG_MODEL if tier == "strong" else CHEAP_MODEL
        last_err: Exception | None = None
        for attempt in range(_MAX_RETRIES):
            try:
                resp = self._client.messages.create(
                    model=model,
                    max_tokens=max_tokens,
                    system=[{
                        "type": "text",
                        "text": system,
                        "cache_control": {"type": "ephemeral"},
                    }],
                    messages=[{"role": "user", "content": user}],
                )
                if getattr(resp, "stop_reason", None) == "refusal":
                    raise LLMError(f"model refused ({tag})")
                parts = [b.text for b in resp.content if getattr(b, "type", "") == "text"]
                return "".join(parts).strip()
            except LLMError:
                raise
            except Exception as exc:  # noqa: BLE001 — provider errors are opaque
                last_err = exc
                logger.warning("llm call failed (%s, attempt %d): %s", tag, attempt + 1, exc)
                time.sleep(_BACKOFF_S * (attempt + 1))
        raise LLMError(f"llm call failed after {_MAX_RETRIES} attempts ({tag}): {last_err}")


_client: Any | None = None


def get_client() -> Any:
    global _client
    if _client is None:
        try:
            _client = AnthropicClient()
        except Exception as exc:  # missing SDK or API key
            raise LLMError(f"no LLM client available: {exc}") from exc
    return _client


def set_client(client: Any) -> None:
    """Inject a client (tests use a fake)."""
    global _client
    _client = client


def parse_json(text: str) -> Any:
    """Parse JSON out of a model reply, tolerating code fences and prose."""
    text = text.strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", text, re.DOTALL)
    if fence:
        text = fence.group(1).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    # fall back to the first balanced object/array in the text
    for opener, closer in (("{", "}"), ("[", "]")):
        start = text.find(opener)
        if start == -1:
            continue
        depth = 0
        for i in range(start, len(text)):
            if text[i] == opener:
                depth += 1
            elif text[i] == closer:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(text[start : i + 1])
                    except json.JSONDecodeError:
                        break
    raise ValueError(f"no JSON found in model reply: {text[:200]!r}")
