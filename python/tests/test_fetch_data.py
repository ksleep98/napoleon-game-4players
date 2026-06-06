"""Unit tests for data.fetch_data (credentials guard + pagination)."""

from __future__ import annotations

import pandas as pd
import pytest

import data.fetch_data as fetch
from tests.factories import make_training_df

_ENV_VARS = (
    "SUPABASE_URL",
    "SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
)


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Never touch the real python/.env and start from a clean env."""
    monkeypatch.setattr(fetch, "_load_env", lambda: None)
    for var in _ENV_VARS:
        monkeypatch.delenv(var, raising=False)


def test_get_supabase_client_raises_without_credentials():
    with pytest.raises(RuntimeError, match="Missing Supabase credentials"):
        fetch.get_supabase_client()


def test_get_supabase_client_uses_public_env_fallback(monkeypatch):
    """NEXT_PUBLIC_* vars are accepted when the unprefixed ones are absent."""
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key-123")

    captured = {}

    def fake_create_client(url, key):
        captured["url"] = url
        captured["key"] = key
        return "CLIENT"

    monkeypatch.setattr(fetch, "create_client", fake_create_client)

    client = fetch.get_supabase_client()
    assert client == "CLIENT"
    assert captured == {"url": "https://example.supabase.co", "key": "anon-key-123"}


def test_get_supabase_client_prefers_unprefixed_env(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://primary.supabase.co")
    monkeypatch.setenv("SUPABASE_ANON_KEY", "primary-key")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://fallback.supabase.co")
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "fallback-key")

    captured = {}
    monkeypatch.setattr(
        fetch,
        "create_client",
        lambda url, key: captured.update(url=url, key=key) or "CLIENT",
    )

    fetch.get_supabase_client()
    assert captured["url"] == "https://primary.supabase.co"
    assert captured["key"] == "primary-key"


class _FakeResp:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    """Records the query-builder calls and serves paginated slices."""

    def __init__(self, data):
        self._data = data
        self._start = 0
        self._end = 0
        self.calls: list[str] = []

    def select(self, _cols):
        self.calls.append("select")
        return self

    @property
    def not_(self):
        self.calls.append("not_")
        return self

    def is_(self, col, val):
        self.calls.append(f"is_:{col}:{val}")
        return self

    def order(self, _col):
        self.calls.append("order")
        return self

    def range(self, start, end):
        self._start = start
        self._end = end
        return self

    def execute(self):
        # Supabase range() is inclusive on both ends.
        return _FakeResp(self._data[self._start : self._end + 1])


class _FakeClient:
    def __init__(self, query):
        self._query = query
        self.tables: list[str] = []

    def table(self, name):
        self.tables.append(name)
        return self._query


def _install_fake_client(monkeypatch, rows):
    query = _FakeQuery(rows)
    client = _FakeClient(query)
    monkeypatch.setattr(fetch, "get_supabase_client", lambda: client)
    return client, query


def test_fetch_training_data_paginates_until_short_batch(monkeypatch):
    rows = [{"game_id": f"g{i}", "n": i} for i in range(5)]
    _client, query = _install_fake_client(monkeypatch, rows)

    df = fetch.fetch_training_data(completed_only=False, page_size=2)

    assert isinstance(df, pd.DataFrame)
    assert len(df) == 5
    # 5 rows / page_size 2 => three execute() round-trips (2, 2, 1).
    assert query.calls.count("select") == 3


def test_fetch_training_data_applies_completed_only_filter(monkeypatch):
    rows = [{"game_id": "g0", "game_result": "napoleon_win"}]
    _client, query = _install_fake_client(monkeypatch, rows)

    fetch.fetch_training_data(completed_only=True, page_size=1000)
    assert "not_" in query.calls
    assert "is_:game_result:null" in query.calls


def test_fetch_training_data_skips_filter_when_not_completed_only(monkeypatch):
    rows = [{"game_id": "g0", "game_result": None}]
    _client, query = _install_fake_client(monkeypatch, rows)

    fetch.fetch_training_data(completed_only=False, page_size=1000)
    assert "not_" not in query.calls
    assert all(not c.startswith("is_:") for c in query.calls)


def test_fetch_training_data_empty_returns_empty_df(monkeypatch):
    _client, _query = _install_fake_client(monkeypatch, [])
    df = fetch.fetch_training_data(completed_only=False, page_size=1000)
    assert isinstance(df, pd.DataFrame)
    assert df.empty


def test_summarize_handles_empty_df():
    # Should log-and-return without raising on an empty frame.
    fetch.summarize(pd.DataFrame())


def test_summarize_handles_populated_df():
    df = make_training_df(n_games=2, rows_per_game=8)
    # Exercises every value_counts / .loc branch without raising.
    fetch.summarize(df)
