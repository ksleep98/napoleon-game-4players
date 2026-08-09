"""Train the Napoleon card prediction model from Supabase data.

モデルは「合法手 1 枚ごとの 2 値分類 (候補スコアリング)」。
旧実装の 52 クラス分類は、特徴量が手札のカード identity を持たないため
構造的に解けず accuracy が 27% 前後で頭打ちだった (features.py の docstring 参照)。
評価も 52 クラス上の argmax ではなく、実プレイと同じ「合法手の中での argmax」で行う。
"""

from __future__ import annotations

import logging
import time
from pathlib import Path

import numpy as np
import skops.io as sio
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GroupShuffleSplit

from data.fetch_data import fetch_training_data
from model.features import (
    CANDIDATE_FEATURE_NAMES,
    FEATURE_NAMES,
    build_candidate_dataset,
    build_feature_matrix,
)

logger = logging.getLogger(__name__)

MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = MODEL_DIR / "card_predictor.skops"

# app.py はこの値で「候補スコアリング形式のモデルか」を判定する。
# 互換性のない形式変更を入れたらここを上げること。
MODEL_TYPE_CANDIDATE_SCORER = "candidate_scorer"
MODEL_SCHEMA_VERSION = 2

MIN_TRAINING_ROWS = 50
MIN_TRAINING_GAMES = 2
NOISY_EVALUATION_GAMES = 5
TEST_SIZE = 0.2
RANDOM_SEED = 42

# min_samples_leaf は 1/2/5/10 を 34,840 行 (903 ゲーム) で比較して 2 が最良
# (top-1 66.04% / 5:65.78% / 10:65.14% / 1:65.12%)。n_estimators は 400 で飽和し、
# 800 にしても改善しなかったので木の本数は 400 に留める。
RF_N_ESTIMATORS = 400
RF_MIN_SAMPLES_LEAF = 2

# 運用側の閾値 (src/lib/ai/aiStrategy.ts の ML_CONFIDENCE_THRESHOLD) を決めるための
# 参照点。学習のたびに「この閾値だと何%の局面で発火し、そのとき何%当たるか」を出す。
CONFIDENCE_THRESHOLDS = (0.2, 0.3, 0.4, 0.5, 0.6)


def split_by_game(
    X: np.ndarray, y: np.ndarray, groups: np.ndarray, test_size: float = TEST_SIZE, seed: int = 42
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Split such that all rows from a given game stay on one side."""
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    train_idx, test_idx = next(splitter.split(X, y, groups))
    return X[train_idx], X[test_idx], y[train_idx], y[test_idx]


def split_indices_by_game(
    X: np.ndarray, y: np.ndarray, groups: np.ndarray, test_size: float = TEST_SIZE, seed: int = 42
) -> tuple[np.ndarray, np.ndarray]:
    """Same split as `split_by_game`, but returns the index arrays.

    候補スコアリングでは decision_ids も同じインデックスで切り出す必要があるため、
    行そのものではなくインデックスを返すバリアントを使う。
    """
    splitter = GroupShuffleSplit(n_splits=1, test_size=test_size, random_state=seed)
    return next(splitter.split(X, y, groups))


def normalize_scores(scores: np.ndarray) -> np.ndarray:
    """Turn raw per-candidate scores into a distribution over the legal moves."""
    total = float(scores.sum())
    if total <= 0.0:
        return np.full(len(scores), 1.0 / len(scores))
    return scores / total


def evaluate_decisions(
    scores: np.ndarray, decision_ids: np.ndarray, labels: np.ndarray
) -> dict[str, float]:
    """Per-decision metrics: exactly what happens in play (argmax over legal moves)."""
    order = np.argsort(decision_ids, kind="stable")
    ids = decision_ids[order]
    ordered_scores = scores[order]
    ordered_labels = labels[order]

    confidences: list[float] = []
    correct_flags: list[bool] = []
    top3_flags: list[bool] = []
    forced_flags: list[bool] = []

    start = 0
    while start < len(ids):
        end = start
        while end < len(ids) and ids[end] == ids[start]:
            end += 1
        block = normalize_scores(ordered_scores[start:end])
        truth = int(np.argmax(ordered_labels[start:end]))
        ranking = np.argsort(-block)

        confidences.append(float(block.max()))
        correct_flags.append(bool(ranking[0] == truth))
        top3_flags.append(bool(truth in ranking[:3]))
        forced_flags.append(end - start == 1)
        start = end

    conf = np.array(confidences)
    correct = np.array(correct_flags)
    forced = np.array(forced_flags)
    free = ~forced

    metrics = {
        "decisions": float(len(conf)),
        "accuracy": float(correct.mean()),
        "top3_accuracy": float(np.mean(top3_flags)),
        # 合法手が 1 枚しかない局面は必ず当たるので、実力は non_forced を見る
        "accuracy_non_forced": float(correct[free].mean()) if free.any() else 0.0,
        "forced_share": float(forced.mean()),
        "confidence_mean": float(conf.mean()),
        "confidence_median": float(np.median(conf)),
    }
    # 閾値ごとの「採用率」と「採用したときの的中率」— 運用閾値を決めるための材料。
    #
    # 強制手 (合法手 1 枚) は normalize_scores で confidence が必ず 1.0 になり必ず
    # 的中するため、全決定を母数にすると実運用より楽観に出る。本番では
    # src/lib/ai/aiStrategy.ts が合法手 1 枚の局面で ML を呼ばずに短絡するので、
    # 運用閾値の判断材料になるのは "_non_forced" 側。両方出す。
    for threshold in CONFIDENCE_THRESHOLDS:
        selected = conf >= threshold
        metrics[f"adopt_rate_at_{threshold}"] = float(selected.mean())
        metrics[f"accuracy_at_{threshold}"] = (
            float(correct[selected].mean()) if selected.any() else 0.0
        )
        selected_free = selected & free
        metrics[f"adopt_rate_at_{threshold}_non_forced"] = (
            float(selected_free.sum() / free.sum()) if free.any() else 0.0
        )
        metrics[f"accuracy_at_{threshold}_non_forced"] = (
            float(correct[selected_free].mean()) if selected_free.any() else 0.0
        )
    return metrics


def random_legal_baseline(decision_ids: np.ndarray) -> float:
    """Accuracy of picking uniformly at random among the legal moves."""
    _, counts = np.unique(decision_ids, return_counts=True)
    return float(np.mean(1.0 / counts))


def main() -> int:
    logger.info("Fetching training data from Supabase...")
    df = fetch_training_data()
    n_games = int(df["game_id"].nunique()) if len(df) else 0
    logger.info("Loaded %d rows across %d games", len(df), n_games)
    if len(df) < MIN_TRAINING_ROWS:
        logger.error("Not enough data to train (need >= %d rows)", MIN_TRAINING_ROWS)
        return 1
    # 同一ゲームの手が train/test 両側に入ると強く相関した局面がリークし、
    # 精度が実力より高く出る。ゲーム単位で分けられない場合は学習しない。
    if n_games < MIN_TRAINING_GAMES:
        logger.error(
            "Need at least %d distinct games for a leak-free split (got %d)",
            MIN_TRAINING_GAMES,
            n_games,
        )
        return 1
    if n_games < NOISY_EVALUATION_GAMES:
        logger.warning(
            "Only %d games — the held-out estimate will be very noisy.",
            n_games,
        )

    X, y, decision_ids, groups = build_candidate_dataset(df)
    if len(X) == 0:
        logger.error("No usable decisions after expanding legal moves")
        return 1
    n_decisions = len(np.unique(decision_ids))
    logger.info(
        "Candidate matrix: shape=%s, decisions=%d, mean legal moves=%.2f",
        X.shape,
        n_decisions,
        len(X) / n_decisions,
    )

    train_idx, test_idx = split_indices_by_game(X, y, groups, seed=RANDOM_SEED)
    logger.info(
        "Train: %d candidate rows (%d decisions), Test: %d candidate rows (%d decisions)",
        len(train_idx),
        len(np.unique(decision_ids[train_idx])),
        len(test_idx),
        len(np.unique(decision_ids[test_idx])),
    )

    logger.info(
        "Training RandomForestClassifier(n_estimators=%d, min_samples_leaf=%d) on candidates...",
        RF_N_ESTIMATORS,
        RF_MIN_SAMPLES_LEAF,
    )
    t0 = time.perf_counter()
    model = RandomForestClassifier(
        n_estimators=RF_N_ESTIMATORS,
        min_samples_leaf=RF_MIN_SAMPLES_LEAF,
        n_jobs=-1,
        random_state=RANDOM_SEED,
    )
    model.fit(X[train_idx], y[train_idx])
    logger.info("Trained in %.2fs", time.perf_counter() - t0)

    scores = np.asarray(model.predict_proba(X[test_idx]))[:, 1]
    metrics = evaluate_decisions(scores, decision_ids[test_idx], y[test_idx])
    baseline = random_legal_baseline(decision_ids[test_idx])

    logger.info("=== Evaluation (argmax over legal moves — same as play) ===")
    logger.info("Accuracy:            %.2f%%", metrics["accuracy"] * 100)
    logger.info("Top-3 Accuracy:      %.2f%%", metrics["top3_accuracy"] * 100)
    logger.info(
        "Accuracy (non-forced): %.2f%%  (forced-move share %.2f%%)",
        metrics["accuracy_non_forced"] * 100,
        metrics["forced_share"] * 100,
    )
    logger.info("Baseline (uniform over legal moves): %.2f%%", baseline * 100)
    logger.info(
        "Top-1 confidence: mean=%.3f, median=%.3f",
        metrics["confidence_mean"],
        metrics["confidence_median"],
    )
    # 本番で ML に届くのは非強制手だけなので、運用閾値は右側 (non-forced) で決める。
    logger.info("  %-10s %-28s %s", "threshold", "all decisions", "non-forced only (operational)")
    for threshold in CONFIDENCE_THRESHOLDS:
        logger.info(
            "  %-10.1f adopt %5.1f%% / acc %6.2f%%   adopt %5.1f%% / acc %6.2f%%",
            threshold,
            metrics[f"adopt_rate_at_{threshold}"] * 100,
            metrics[f"accuracy_at_{threshold}"] * 100,
            metrics[f"adopt_rate_at_{threshold}_non_forced"] * 100,
            metrics[f"accuracy_at_{threshold}_non_forced"] * 100,
        )

    importances = sorted(
        zip(CANDIDATE_FEATURE_NAMES, model.feature_importances_, strict=True),
        key=lambda t: t[1],
        reverse=True,
    )
    top_importances = "\n".join(f"  {name:<32} {score:.4f}" for name, score in importances[:10])
    logger.info("Top 10 features by importance:\n%s", top_importances)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    sio.dump(
        {
            "model": model,
            "model_type": MODEL_TYPE_CANDIDATE_SCORER,
            "schema_version": MODEL_SCHEMA_VERSION,
            "feature_names": CANDIDATE_FEATURE_NAMES,
            "trained_rows": int(len(train_idx)),
            "test_rows": int(len(test_idx)),
            "accuracy": float(metrics["accuracy"]),
            "top3_accuracy": float(metrics["top3_accuracy"]),
            "accuracy_non_forced": float(metrics["accuracy_non_forced"]),
            "random_legal_baseline": baseline,
            "confidence_median": float(metrics["confidence_median"]),
        },
        MODEL_PATH,
    )
    logger.info("Saved model -> %s", MODEL_PATH)
    return 0


__all__ = [
    "CANDIDATE_FEATURE_NAMES",
    "FEATURE_NAMES",
    "MODEL_PATH",
    "MODEL_TYPE_CANDIDATE_SCORER",
    "build_candidate_dataset",
    "build_feature_matrix",
    "evaluate_decisions",
    "main",
    "normalize_scores",
    "random_legal_baseline",
    "split_by_game",
    "split_indices_by_game",
]


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    raise SystemExit(main())
