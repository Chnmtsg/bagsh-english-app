from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))

from src import llm  # noqa: E402
from src.testing import StubLLM  # noqa: E402


@pytest.fixture()
def stub_llm():
    """Install a StubLLM for the test; restore afterwards."""
    client = StubLLM()
    llm.set_client(client)
    yield client
    llm.set_client(None)  # type: ignore[arg-type]


@pytest.fixture(autouse=True)
def _isolated_profiles(tmp_path, monkeypatch):
    monkeypatch.setenv("BAGSH_DATA_DIR", str(tmp_path))
