"""Prompt loading. Prompts are NOT code: they live in prompts/*.md with
versioned frontmatter and are loaded at runtime. Never inline a prompt
string in a node.

Template variables use {{name}} tokens (str.format would collide with the
JSON braces that appear inside prompt bodies).
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
PROMPTS_DIR = REPO_ROOT / "prompts"

_FRONTMATTER = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.DOTALL)


@lru_cache(maxsize=None)
def load_prompt(name: str) -> tuple[dict, str]:
    """Return (frontmatter dict, body) for prompts/<name>.md."""
    path = PROMPTS_DIR / f"{name}.md"
    raw = path.read_text(encoding="utf-8")
    m = _FRONTMATTER.match(raw)
    if not m:
        raise ValueError(f"prompt {name} has no frontmatter (version is mandatory)")
    meta = yaml.safe_load(m.group(1)) or {}
    if "version" not in meta:
        raise ValueError(f"prompt {name} frontmatter is missing 'version'")
    return meta, raw[m.end():].strip()


def render(body: str, **vars: object) -> str:
    for key, value in vars.items():
        body = body.replace("{{" + key + "}}", str(value))
    return body
