"""Unit tests for model.train (splitting + the training entrypoint)."""

from __future__ import annotations

import numpy as np
import pandas as pd

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
    df = make_training_df(n_games=4, rows_per_game=16)  # 64 rows, 4 classes
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
        "feature_names",
        "trained_rows",
        "test_rows",
        "accuracy",
        "top3_accuracy",
    ):
        assert key in payload
    assert payload["feature_names"] == train.FEATURE_NAMES
    assert 0.0 <= payload["accuracy"] <= 1.0
    assert 0.0 <= payload["top3_accuracy"] <= 1.0
    assert payload["trained_rows"] > 0
    assert payload["test_rows"] > 0
    # The fitted model can score the feature matrix it was trained on.
    X, _ = train.build_feature_matrix(df)
    assert payload["model"].predict(X).shape == (len(df),)


def test_main_handles_few_games_with_row_split(monkeypatch):
    """With <5 games the code falls back to a row-wise split (still trains)."""
    df = make_training_df(n_games=2, rows_per_game=30)  # 60 rows, 2 games
    assert df["game_id"].nunique() < 5
    monkeypatch.setattr(train, "fetch_training_data", lambda: df)
    monkeypatch.setattr(train.sio, "dump", lambda *a, **k: None)

    assert train.main() == 0


def test_build_feature_matrix_reexported_from_train():
    """train re-uses features.build_feature_matrix; sanity check the wiring."""
    df = pd.DataFrame(make_training_df(n_games=1, rows_per_game=4))
    X, y = train.build_feature_matrix(df)
    assert X.shape[0] == 4
    assert y.shape[0] == 4
