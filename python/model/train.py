"""Train a Random Forest card prediction model from Supabase data."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, top_k_accuracy_score
from sklearn.model_selection import GroupShuffleSplit

# Allow `python -m model.train` or `python model/train.py` from python/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data.fetch_data import fetch_training_data  # noqa: E402
from model.features import FEATURE_NAMES, build_feature_matrix  # noqa: E402

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "card_predictor.joblib"


def split_by_game(
    X: np.ndarray, y: np.ndarray, groups: np.ndarray, test_size: float = 0.2, seed: int = 42
):
    """Split such that all rows from a given game stay on one side."""
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_idx, test_idx = next(splitter.split(X, y, groups))
    return X[train_idx], X[test_idx], y[train_idx], y[test_idx]


def main() -> int:
    print("Fetching training data from Supabase...")
    df = fetch_training_data()
    print(f"Loaded {len(df)} rows across {df['game_id'].nunique()} games")
    if len(df) < 50:
        print("ERROR: Not enough data to train (need >= 50 rows)")
        return 1

    X, y = build_feature_matrix(df)
    groups = df["game_id"].to_numpy()
    print(f"Feature matrix: shape={X.shape}, classes={len(np.unique(y))}")

    # If we only have a handful of games, a group split may not leave any test rows.
    if df["game_id"].nunique() < 5:
        print(
            "WARN: Fewer than 5 games — splitting by row instead of by game. "
            "Accuracy may be optimistic."
        )
        from sklearn.model_selection import train_test_split

        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=None
        )
    else:
        X_train, X_test, y_train, y_test = split_by_game(X, y, groups)

    print(f"Train: {X_train.shape[0]} rows, Test: {X_test.shape[0]} rows")

    print("Training RandomForestClassifier(n_estimators=200, max_depth=12)...")
    t0 = time.perf_counter()
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
    )
    model.fit(X_train, y_train)
    fit_seconds = time.perf_counter() - t0
    print(f"Trained in {fit_seconds:.2f}s")

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    y_proba = model.predict_proba(X_test)
    # top_k_accuracy needs the global label set; pass labels= for safety.
    labels = np.arange(52)
    proba_full = np.zeros((y_proba.shape[0], 52))
    for col_idx, cls in enumerate(model.classes_):
        proba_full[:, cls] = y_proba[:, col_idx]
    top3 = top_k_accuracy_score(y_test, proba_full, k=3, labels=labels)
    top5 = top_k_accuracy_score(y_test, proba_full, k=5, labels=labels)

    print("\n=== Evaluation ===")
    print(f"Accuracy:       {accuracy:.2%}")
    print(f"Top-3 Accuracy: {top3:.2%}")
    print(f"Top-5 Accuracy: {top5:.2%}")
    print(f"Baseline (random over 52): {1 / 52:.2%}")

    # Feature importance
    importances = sorted(
        zip(FEATURE_NAMES, model.feature_importances_, strict=True),
        key=lambda t: t[1],
        reverse=True,
    )
    print("\nTop 10 features by importance:")
    for name, score in importances[:10]:
        print(f"  {name:<28} {score:.4f}")

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    joblib.dump(
        {
            "model": model,
            "feature_names": FEATURE_NAMES,
            "trained_rows": int(X_train.shape[0]),
            "test_rows": int(X_test.shape[0]),
            "accuracy": float(accuracy),
            "top3_accuracy": float(top3),
        },
        MODEL_PATH,
    )
    print(f"\nSaved model -> {MODEL_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
