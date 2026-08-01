"""Unit tests for model.train (splitting + the training entrypoint)."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

import model.train as train
from tests.factories import make_training_df


def _toy_grouped_data():
    """6 rows across 3 games, 2 rows each."""
    X = np.arange(12, dtype=np.float64).reshape(6, 2)
    y = np.array([0, 1, 0, 1, 0, 1])
    groups = np.array(["g0", "g0", "g1", "g1", "g2", "g2"])
    return X, y, groups


def test_split_by_game_keeps_games_on_one_side():
    X, y, groups = _toy_grouped_data()
    X_train, X_test, y_train, y_test = train.split_by_game(X, y, groups, test_size=0.34)

    # Map each row back to its game via the first feature column (0..11 step 2).
    def games_of(rows):
        return {groups[int(r[0]) // 2] for r in rows}

    train_games = games_of(X_train)
    test_games = games_of(X_test)
    assert train_games.isdisjoint(test_games)
    assert train_games | test_games == {"g0", "g1", "g2"}


def test_split_by_game_preserves_row_count():
    X, y, groups = _toy_grouped_data()
    X_train, X_test, y_train, y_test = train.split_by_game(X, y, groups)
    assert X_train.shape[0] + X_test.shape[0] == X.shape[0]
    assert y_train.shape[0] + y_test.shape[0] == y.shape[0]
    assert X_train.shape[1] == X.shape[1]


def test_split_by_game_is_deterministic():
    X, y, groups = _toy_grouped_data()
    a = train.split_by_game(X, y, groups, seed=7)
    b = train.split_by_game(X, y, groups, seed=7)
    for left, right in zip(a, b, strict=True):
        np.testing.assert_array_equal(left, right)


def test_main_returns_error_on_insufficient_data(monkeypatch):
    """Fewer than 50 rows must abort early with exit code 1."""
    small = make_training_df(n_games=1, rows_per_game=10)  # 10 rows
    assert len(small) < 50
    monkeypatch.setattr(train, "fetch_training_data", lambda: small)
    dumped: list = []
    monkeypatch.setattr(train.sio, "dump", lambda *a, **k: dumped.append(a))

    assert train.main() == 1
    assert dumped == []  # never reached the save step


def test_main_trains_and_saves_model(monkeypatch):
    """Happy path: enough data -> trains, evaluates, saves with metadata."""
    df = make_training_df(n_games=8, rows_per_game=16)  # 128 decisions
    monkeypatch.setattr(train, "fetch_training_data", lambda: df)

    captured: dict = {}

    def fake_dump(obj, path):
        captured["obj"] = obj
        captured["path"] = path

    monkeypatch.setattr(train.sio, "dump", fake_dump)

    rc = train.main()
    assert rc == 0

    payload = captured["obj"]
    # Metadata contract consumed by app.py at inference time.
    for key in (
        "model",
        "model_type",
        "schema_version",
        "feature_names",
        "trained_rows",
        "test_rows",
        "accuracy",
        "top3_accuracy",
        "accuracy_non_forced",
        "random_legal_baseline",
    ):
        assert key in payload
    assert payload["model_type"] == train.MODEL_TYPE_CANDIDATE_SCORER
    assert payload["feature_names"] == train.CANDIDATE_FEATURE_NAMES
    assert 0.0 <= payload["accuracy"] <= 1.0
    assert 0.0 <= payload["top3_accuracy"] <= 1.0
    assert payload["trained_rows"] > 0
    assert payload["test_rows"] > 0
    # The fitted model scores the candidate matrix it was trained on.
    X, _, _, _ = train.build_candidate_dataset(df)
    assert payload["model"].predict_proba(X).shape == (X.shape[0], 2)


def test_main_refuses_single_game(monkeypatch):
    """One game cannot be split without leaking; refuse rather than report a fake score."""
    df = make_training_df(n_games=1, rows_per_game=60)
    monkeypatch.setattr(train, "fetch_training_data", lambda: df)
    dumped: list = []
    monkeypatch.setattr(train.sio, "dump", lambda *a, **k: dumped.append(a))

    assert train.main() == 1
    assert dumped == []


def test_build_feature_matrix_reexported_from_train():
    """train re-exports the legacy 52-class builder; sanity check the wiring."""
    df = pd.DataFrame(make_training_df(n_games=1, rows_per_game=4))
    X, y = train.build_feature_matrix(df)
    assert X.shape[0] == 4
    assert y.shape[0] == 4


def test_normalize_scores_sums_to_one():
    out = train.normalize_scores(np.array([0.1, 0.3, 0.6]))
    assert out.sum() == pytest.approx(1.0)
    assert out.argmax() == 2


def test_normalize_scores_falls_back_to_uniform_when_all_zero():
    """A degenerate all-zero score vector must not produce NaNs."""
    out = train.normalize_scores(np.zeros(4))
    assert out.sum() == pytest.approx(1.0)
    assert np.allclose(out, 0.25)


def test_evaluate_decisions_perfect_and_forced():
    """Two decisions: one free (3 candidates) and one forced (1 candidate)."""
    decision_ids = np.array([0, 0, 0, 1])
    labels = np.array([0, 1, 0, 1])
    scores = np.array([0.1, 0.8, 0.1, 0.5])

    m = train.evaluate_decisions(scores, decision_ids, labels)

    assert m["decisions"] == 2
    assert m["accuracy"] == pytest.approx(1.0)
    assert m["accuracy_non_forced"] == pytest.approx(1.0)
    assert m["forced_share"] == pytest.approx(0.5)
    # 合法手が 1 枚の局面は正規化後 confidence が必ず 1.0 になる
    assert m["confidence_mean"] == pytest.approx((0.8 + 1.0) / 2)


def test_evaluate_decisions_counts_misses():
    decision_ids = np.array([0, 0, 0])
    labels = np.array([1, 0, 0])
    scores = np.array([0.1, 0.7, 0.2])

    m = train.evaluate_decisions(scores, decision_ids, labels)

    assert m["accuracy"] == pytest.approx(0.0)
    # 正解は 3 候補中 3 位なので top-3 には入る
    assert m["top3_accuracy"] == pytest.approx(1.0)
    assert m["accuracy_at_0.6"] == pytest.approx(0.0)


def test_random_legal_baseline():
    """Uniform-over-legal baseline: 1/3 for a 3-way choice, 1.0 for a forced move."""
    decision_ids = np.array([0, 0, 0, 1])
    assert train.random_legal_baseline(decision_ids) == pytest.approx((1 / 3 + 1.0) / 2)


def test_split_indices_by_game_is_leak_free():
    X = np.arange(12, dtype=np.float64).reshape(6, 2)
    y = np.array([0, 1, 0, 1, 0, 1])
    groups = np.array(["g0", "g0", "g1", "g1", "g2", "g2"])

    train_idx, test_idx = train.split_indices_by_game(X, y, groups, test_size=0.34)

    assert set(groups[train_idx]).isdisjoint(set(groups[test_idx]))
    assert len(train_idx) + len(test_idx) == len(X)
