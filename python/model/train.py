"""Train a Random Forest card prediction model from Supabase data."""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any, cast

import numpy as np
import skops.io as sio
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, top_k_accuracy_score
from sklearn.model_selection import GroupShuffleSplit

from data.fetch_data import fetch_training_data
from model.features import FEATURE_NAMES, build_feature_matrix

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "card_predictor.skops"


def split_by_game(
    X: np.ndarray, y: np.ndarray, groups: np.ndarray, test_size: float = 0.2, seed: int = 42
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Split such that all rows from a given game stay on one side."""
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_idx, test_idx = next(splitter.split(X, y, groups))
    return X[train_idx], X[test_idx], y[train_idx], y[test_idx]


def main() -> int:
    logger.info("Fetching training data from Supabase...")
    df = fetch_training_data()
    logger.info("Loaded %d rows across %d games", len(df), df["game_id"].nunique())
    if len(df) < 50:
        logger.error("Not enough data to train (need >= 50 rows)")
        return 1

    X, y = build_feature_matrix(df)
    groups = df["game_id"].to_numpy()
    logger.info("Feature matrix: shape=%s, classes=%d", X.shape, len(np.unique(y)))

    # If we only have a handful of games, a group split may not leave any test rows.
    X_train: np.ndarray
    X_test: np.ndarray
    y_train: np.ndarray
    y_test: np.ndarray
    if df["game_id"].nunique() < 5:
        logger.warning(
            "Fewer than 5 games — splitting by row instead of by game. "
            "Accuracy may be optimistic."
        )
        from sklearn.model_selection import train_test_split

        # train_test_split's stub returns list[Unknown]; narrow to a tuple of ndarrays.
        X_train, X_test, y_train, y_test = cast(
            tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray],
            train_test_split(X, y, test_size=0.2, random_state=42, stratify=None),
        )
    else:
        X_train, X_test, y_train, y_test = split_by_game(X, y, groups)

    logger.info("Train: %d rows, Test: %d rows", X_train.shape[0], X_test.shape[0])

    # Random Forest を CalibratedClassifierCV(isotonic) でラップして確信度を再較正する。
    # 素の RF は 52 クラス分類で票が分散し、top-1 confidence が 0.10〜0.20 に張り付いて
    # しまうため (Phase 4.2 観察)、isotonic regression で確率を再マッピングし、適切な
    # 手については閾値 (0.2) を超えやすくする。cv=3 で fit 時間は約 3 倍になる。
    logger.info(
        "Training CalibratedClassifierCV(RF n_estimators=200, max_depth=12, cv=3, isotonic)..."
    )
    t0 = time.perf_counter()
    base_rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=2,
        n_jobs=-1,
        random_state=42,
    )
    model = CalibratedClassifierCV(
        estimator=base_rf,
        method="isotonic",
        cv=3,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    fit_seconds = time.perf_counter() - t0
    logger.info("Trained in %.2fs", fit_seconds)

    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    # predict_proba's stub returns a union; narrow to ndarray for shape/slice access.
    y_proba: np.ndarray = np.asarray(model.predict_proba(X_test))
    # top_k_accuracy needs the global label set; pass labels= for safety.
    labels = np.arange(52)
    proba_full = np.zeros((y_proba.shape[0], 52))
    for col_idx, cls in enumerate(model.classes_):
        proba_full[:, cls] = y_proba[:, col_idx]
    top3 = top_k_accuracy_score(y_test, proba_full, k=3, labels=labels)
    top5 = top_k_accuracy_score(y_test, proba_full, k=5, labels=labels)

    # 閾値 0.2 運用に対する効果を確認するため、テストセットの top-1 confidence の分布を出力する。
    top1_conf = y_proba.max(axis=1)
    pct_above_02 = float((top1_conf >= 0.2).mean()) * 100
    pct_above_03 = float((top1_conf >= 0.3).mean()) * 100

    logger.info("=== Evaluation ===")
    logger.info("Accuracy:       %.2f%%", accuracy * 100)
    logger.info("Top-3 Accuracy: %.2f%%", top3 * 100)
    logger.info("Top-5 Accuracy: %.2f%%", top5 * 100)
    logger.info("Baseline (random over 52): %.2f%%", (1 / 52) * 100)
    logger.info(
        "Top-1 confidence: mean=%.3f, median=%.3f, >=0.2=%.1f%%, >=0.3=%.1f%%",
        float(top1_conf.mean()),
        float(np.median(top1_conf)),
        pct_above_02,
        pct_above_03,
    )

    # CalibratedClassifierCV は feature_importances_ を持たないので、cv 分割した各
    # base RF の importances を平均する。sklearn の型スタブでは calibrated_classifiers_
    # の要素や .estimator が Optional 扱いになっており pyright が attribute access で
    # 文句を言うため、ランタイム上は常にセット済みであることを利用して Any で受ける。
    fitted_classifiers: Any = model.calibrated_classifiers_
    importance_vec = np.mean(
        [cc.estimator.feature_importances_ for cc in fitted_classifiers],
        axis=0,
    )
    importances = sorted(
        zip(FEATURE_NAMES, importance_vec, strict=True),
        key=lambda t: t[1],
        reverse=True,
    )
    top_importances = "\n".join(f"  {name:<28} {score:.4f}" for name, score in importances[:10])
    logger.info("Top 10 features by importance:\n%s", top_importances)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    sio.dump(
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
    logger.info("Saved model -> %s", MODEL_PATH)
    return 0


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    raise SystemExit(main())
