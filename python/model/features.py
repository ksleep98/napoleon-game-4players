"""Feature engineering for the Napoleon card prediction model.

Two formulations live here:

1. **Legacy 52-class** (`build_feature_matrix`) — predicts an absolute card id
   out of 52. It is kept only so older saved models and their tests still work.
   It cannot work well: the feature vector never says *which* cards are in hand
   (only per-suit counts and J/Q/K/A counts), so the target is not a function of
   the input. That is the reason accuracy sat at ~27% no matter how much data was
   collected.

2. **Candidate scoring** (`build_candidate_dataset` / `build_candidate_features`)
   — one row per *legal* card, binary label "was this the card played". Inference
   scores only legal candidates and renormalizes, so the reported confidence is a
   probability over legal moves rather than over all 52 cards.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

SUITS = ("spades", "hearts", "diamonds", "clubs")
HIGH_RANKS = ("J", "Q", "K", "A")
ROLES = ("napoleon", "adjutant", "allied")
SUIT_TO_IDX = {suit: i for i, suit in enumerate(SUITS)}
RANK_TO_IDX = {
    "2": 0,
    "3": 1,
    "4": 2,
    "5": 3,
    "6": 4,
    "7": 5,
    "8": 6,
    "9": 7,
    "10": 8,
    "J": 9,
    "Q": 10,
    "K": 11,
    "A": 12,
}


def card_id(card: dict) -> str:
    return f"{card['suit']}-{card['rank']}"


def card_class_index(card: dict) -> int:
    """Return a stable 0..51 class index for a card."""
    return SUIT_TO_IDX[card["suit"]] * 13 + RANK_TO_IDX[card["rank"]]


def class_index_to_card_id(idx: int) -> str:
    suit_idx, rank_idx = divmod(idx, 13)
    suit = SUITS[suit_idx]
    rank = list(RANK_TO_IDX.keys())[rank_idx]
    return f"{suit}-{rank}"


def _row_features(row: pd.Series) -> np.ndarray:
    # Materialize as a plain dict so downstream values are `Any`, not pandas
    # union types (Series | ndarray | ...) that confuse the type checker.
    data = row.to_dict()
    hand: list[dict] = data.get("hand") or []
    table_cards: list[dict] = data.get("table_cards") or []
    current_suit: str | None = data.get("current_suit")
    trump_suit: str | None = data.get("trump_suit")
    role: str = data["role"]
    is_napoleon_team_flag: bool = bool(data.get("is_napoleon_team"))
    trick_number_value: int = int(data["trick_number"])

    hand_size = len(hand)
    suit_counts = [0, 0, 0, 0]
    high_counts = {r: 0 for r in HIGH_RANKS}
    max_value = 0
    min_value = 15
    for c in hand:
        suit_counts[SUIT_TO_IDX[c["suit"]]] += 1
        if c["rank"] in high_counts:
            high_counts[c["rank"]] += 1
        v = c.get("value", 0)
        max_value = max(max_value, v)
        min_value = min(min_value, v)
    if hand_size == 0:
        min_value = 0

    table_size = len(table_cards)
    table_max = 0
    table_lead_max = 0
    for c in table_cards:
        v = c.get("value", 0)
        table_max = max(table_max, v)
        if current_suit and c["suit"] == current_suit:
            table_lead_max = max(table_lead_max, v)

    current_suit_one_hot = [1 if current_suit == s else 0 for s in SUITS]
    current_suit_is_null = 1 if current_suit is None else 0
    trump_suit_one_hot = [1 if trump_suit == s else 0 for s in SUITS]
    trump_suit_is_null = 1 if trump_suit is None else 0

    has_lead_suit_in_hand = 0
    if current_suit:
        has_lead_suit_in_hand = 1 if any(c["suit"] == current_suit for c in hand) else 0

    role_one_hot = [1 if role == r else 0 for r in ROLES]
    is_napoleon_team = 1 if is_napoleon_team_flag else 0

    return np.array(
        [
            hand_size,
            *suit_counts,
            *high_counts.values(),
            max_value,
            min_value,
            table_size,
            table_max,
            table_lead_max,
            *current_suit_one_hot,
            current_suit_is_null,
            *trump_suit_one_hot,
            trump_suit_is_null,
            has_lead_suit_in_hand,
            *role_one_hot,
            is_napoleon_team,
            trick_number_value,
        ],
        dtype=np.float32,
    )


FEATURE_NAMES = [
    "hand_size",
    *[f"hand_count_{s}" for s in SUITS],
    *[f"hand_count_{r}" for r in HIGH_RANKS],
    "hand_max_value",
    "hand_min_value",
    "table_size",
    "table_max_value",
    "table_lead_max_value",
    *[f"current_suit_{s}" for s in SUITS],
    "current_suit_null",
    *[f"trump_suit_{s}" for s in SUITS],
    "trump_suit_null",
    "has_lead_suit_in_hand",
    *[f"role_{r}" for r in ROLES],
    "is_napoleon_team",
    "trick_number",
]


def build_feature_matrix(df: pd.DataFrame) -> tuple[np.ndarray, np.ndarray]:
    """Return (X, y) where y is the 0..51 class index of the selected card.

    Legacy 52-class formulation. Superseded by `build_candidate_dataset` (see the
    module docstring above); kept so historical models and tests still load.
    """
    X = np.stack([_row_features(row) for _, row in df.iterrows()])
    y = np.array([card_class_index(c) for c in df["selected_card"]], dtype=np.int64)
    return X, y


# ---------------------------------------------------------------------------
# Candidate scoring (learning-to-rank) formulation
# ---------------------------------------------------------------------------
# 52 クラス分類は「どのカードを持っているか」を特徴量が一切表現できないため
# (上の _row_features はスート枚数と J/Q/K/A の枚数しか見ない) 構造的に解けない。
# ここでは「合法手 1 枚ごとに 1 行」を作り、その手が実際に選ばれたかを 2 値分類
# する形に組み替える。推論時は合法手だけをスコアリングして正規化するので、
# 非合法カードに確率が漏れることがなく、confidence がそのまま「合法手の中での
# 選択確率」になる。

MIGHTY_SUIT = "spades"
MIGHTY_RANK = "A"
JACK_RANK = "J"
HEART_QUEEN_SUIT = "hearts"
HEART_QUEEN_RANK = "Q"
SAME_TWO_RANK = "2"
# 得点札 (絵札): 10/J/Q/K/A
POINT_RANKS = frozenset({"10", "J", "Q", "K", "A"})

# src/lib/constants.ts COUNTER_SUITS と同一の裏スート対応
COUNTER_SUITS = {
    "spades": "clubs",
    "clubs": "spades",
    "hearts": "diamonds",
    "diamonds": "hearts",
}

# src/lib/constants.ts CARD_STRENGTH と同一の強さ基底値
STRENGTH_MIGHTY = 1000
STRENGTH_TRUMP_JACK = 900
STRENGTH_COUNTER_JACK = 800
STRENGTH_TRUMP_BASE = 700
STRENGTH_LEADING_BASE = 600
STRENGTH_SCALE = 1000.0


def normalize_suit(value: object) -> str | None:
    """Coerce a possibly-missing suit (None / NaN / unknown string) to a suit or None.

    Supabase 由来の DataFrame では NULL が float('nan') として入るため、
    素朴に dict のキーに使うと KeyError になる。ここで一元的に潰す。
    """
    return value if isinstance(value, str) and value in SUITS else None


def card_strength(
    card: dict,
    trump_suit: str | None,
    leading_suit: str | None,
    is_first_trick: bool,
) -> int:
    """Port of `getCardStrength` in src/lib/napoleonCardRules.ts.

    同じ序列を Python 側でも持たないと、特徴量が「その手がトリックを取れるか」を
    表現できない。TypeScript 側を変更したらここも合わせること。
    """
    suit = card["suit"]
    rank = card["rank"]
    value = int(card.get("value", 0))

    if suit == MIGHTY_SUIT and rank == MIGHTY_RANK:
        return STRENGTH_MIGHTY
    if trump_suit is not None and suit == trump_suit and rank == JACK_RANK:
        return STRENGTH_TRUMP_JACK
    if trump_suit is not None and suit == COUNTER_SUITS[trump_suit] and rank == JACK_RANK:
        return STRENGTH_COUNTER_JACK

    # J は切り札 J / 裏 J 以外では最弱扱い (TypeScript 側と同じ)
    effective_value = 1 if rank == JACK_RANK else value

    if is_first_trick:
        if leading_suit is not None and suit == leading_suit:
            return STRENGTH_LEADING_BASE + effective_value
        return value

    if trump_suit is not None and suit == trump_suit:
        return STRENGTH_TRUMP_BASE + effective_value
    if leading_suit is not None and suit == leading_suit:
        return STRENGTH_LEADING_BASE + effective_value
    return value


def leading_suit_of(table_cards: list[dict]) -> str | None:
    """Lead suit implied by the cards already on the table (None when leading)."""
    return table_cards[0]["suit"] if table_cards else None


def legal_cards(hand: list[dict], table_cards: list[dict]) -> list[dict]:
    """Port of `getPlayableCards` in src/lib/ai/gameSimulator.ts.

    リードなら手札すべて、そうでなければリードスートがあればフォロー必須。
    保存済みの current_suit ではなく table_cards から導出する (トリック確定時に
    leadingSuit が undefined に戻るため、空テーブルなのに current_suit が残った
    行と食い違わないようにする)。
    """
    lead = leading_suit_of(table_cards)
    if lead is None:
        return list(hand)
    follow = [c for c in hand if c["suit"] == lead]
    return follow if follow else list(hand)


CANDIDATE_FEATURE_NAMES = [
    # --- state ---
    "hand_size",
    *[f"hand_count_{s}" for s in SUITS],
    "hand_max_value",
    "hand_min_value",
    "table_size",
    "table_best_strength",
    "trick_number",
    *[f"role_{r}" for r in ROLES],
    "is_napoleon_team",
    "legal_count",
    "is_leading",
    "has_lead_suit_in_hand",
    *[f"trump_suit_{s}" for s in SUITS],
    # --- candidate card ---
    "cand_value",
    "cand_rank_index",
    "cand_strength",
    "cand_is_trump",
    "cand_is_lead_suit",
    "cand_is_mighty",
    "cand_is_trump_jack",
    "cand_is_counter_jack",
    "cand_is_heart_queen",
    "cand_is_same_two",
    "cand_is_point_card",
    "cand_strength_rank_in_legal",
    "cand_value_rank_in_legal",
    "cand_is_weakest_legal",
    "cand_is_strongest_legal",
    "cand_beats_table_best",
    "cand_strength_minus_table_best",
    "cand_suit_count_in_hand",
    "cand_is_lowest_of_suit_in_hand",
    "cand_is_highest_of_suit_in_hand",
]


def build_candidate_features(
    hand: list[dict],
    table_cards: list[dict],
    trump_suit: str | None,
    role: str,
    is_napoleon_team: bool,
    trick_number: int,
) -> tuple[np.ndarray, list[dict]]:
    """Return (X, candidates) with one feature row per legal card.

    推論時 (app.py) と学習時 (build_candidate_dataset) で同じ関数を通すことで、
    train/serve skew を構造的に防ぐ。
    """
    candidates = legal_cards(hand, table_cards)
    if not candidates:
        return np.zeros((0, len(CANDIDATE_FEATURE_NAMES)), dtype=np.float32), []

    lead = leading_suit_of(table_cards)
    is_first_trick = trick_number == 0
    n_legal = len(candidates)

    suit_counts = [0, 0, 0, 0]
    suit_min: dict[str, int] = {}
    suit_max: dict[str, int] = {}
    for c in hand:
        suit = c["suit"]
        suit_counts[SUIT_TO_IDX[suit]] += 1
        value = int(c.get("value", 0))
        suit_min[suit] = min(suit_min.get(suit, value), value)
        suit_max[suit] = max(suit_max.get(suit, value), value)

    hand_values = [int(c.get("value", 0)) for c in hand] or [0]
    table_best = max(
        (card_strength(c, trump_suit, lead, is_first_trick) for c in table_cards),
        default=-1,
    )

    strengths = [card_strength(c, trump_suit, lead, is_first_trick) for c in candidates]
    values = [int(c.get("value", 0)) for c in candidates]
    # argsort(argsort(x)) で「昇順での順位」を得る (0 = 最弱)
    strength_ranks = np.argsort(np.argsort(strengths))
    value_ranks = np.argsort(np.argsort(values))
    denom = float(max(n_legal - 1, 1))

    counter_of_trump = COUNTER_SUITS[trump_suit] if trump_suit is not None else None
    state = [
        float(len(hand)),
        *[float(v) for v in suit_counts],
        float(max(hand_values)),
        float(min(hand_values)),
        float(len(table_cards)),
        table_best / STRENGTH_SCALE,
        float(trick_number),
        *[1.0 if role == r else 0.0 for r in ROLES],
        1.0 if is_napoleon_team else 0.0,
        float(n_legal),
        1.0 if lead is None else 0.0,
        1.0 if (lead is not None and any(c["suit"] == lead for c in hand)) else 0.0,
        *[1.0 if trump_suit == s else 0.0 for s in SUITS],
    ]

    rows = []
    for j, c in enumerate(candidates):
        suit = c["suit"]
        rank = c["rank"]
        value = values[j]
        strength = strengths[j]
        rows.append(
            [
                *state,
                float(value),
                float(RANK_TO_IDX[rank]),
                strength / STRENGTH_SCALE,
                1.0 if suit == trump_suit else 0.0,
                1.0 if suit == lead else 0.0,
                1.0 if (suit == MIGHTY_SUIT and rank == MIGHTY_RANK) else 0.0,
                1.0 if (suit == trump_suit and rank == JACK_RANK) else 0.0,
                1.0 if (suit == counter_of_trump and rank == JACK_RANK) else 0.0,
                1.0 if (suit == HEART_QUEEN_SUIT and rank == HEART_QUEEN_RANK) else 0.0,
                1.0 if (suit == lead and rank == SAME_TWO_RANK) else 0.0,
                1.0 if rank in POINT_RANKS else 0.0,
                float(strength_ranks[j]) / denom,
                float(value_ranks[j]) / denom,
                1.0 if strength_ranks[j] == 0 else 0.0,
                1.0 if strength_ranks[j] == n_legal - 1 else 0.0,
                1.0 if strength > table_best else 0.0,
                (strength - table_best) / STRENGTH_SCALE,
                float(suit_counts[SUIT_TO_IDX[suit]]),
                1.0 if value == suit_min.get(suit, value) else 0.0,
                1.0 if value == suit_max.get(suit, value) else 0.0,
            ]
        )

    return np.array(rows, dtype=np.float32), candidates


def build_candidate_dataset(
    df: pd.DataFrame,
) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """Expand each decision row into one row per legal card.

    Returns (X, y, decision_ids, groups) where
      - y[i] == 1 iff that candidate is the card the player actually played
      - decision_ids[i] identifies the originating decision (for per-decision eval)
      - groups[i] is the game id (for leak-free GroupShuffleSplit)

    Rows that cannot be used are dropped and *counted* — a silent drop would hide a
    regression in the recording side (`src/lib/ml/dataExtractor.ts`) until the model
    quietly degraded.
    """
    feature_rows: list[np.ndarray] = []
    labels: list[int] = []
    decision_ids: list[int] = []
    groups: list[str] = []
    dropped_no_candidates = 0
    dropped_illegal_selection = 0

    for decision_id, (_, row) in enumerate(df.iterrows()):
        hand = row.get("hand") or []
        table_cards = row.get("table_cards") or []
        selected = row["selected_card"]
        selected_id = card_id(selected)

        X_row, candidates = build_candidate_features(
            hand=hand,
            table_cards=table_cards,
            trump_suit=normalize_suit(row.get("trump_suit")),
            role=row["role"],
            is_napoleon_team=bool(row.get("is_napoleon_team")),
            trick_number=int(row["trick_number"]),
        )
        if len(candidates) == 0:
            dropped_no_candidates += 1
            continue
        # 選択カードが合法手に含まれない行は記録の破損なので捨てる。
        # 手札に同じカードが重複していても正例は必ず 1 件になるよう index で決める。
        positive_index = next(
            (j for j, c in enumerate(candidates) if card_id(c) == selected_id), None
        )
        if positive_index is None:
            dropped_illegal_selection += 1
            continue

        for j in range(len(candidates)):
            feature_rows.append(X_row[j])
            labels.append(1 if j == positive_index else 0)
            decision_ids.append(decision_id)
            groups.append(str(row["game_id"]))

    dropped = dropped_no_candidates + dropped_illegal_selection
    if dropped:
        logger.warning(
            "Dropped %d/%d rows (%.2f%%): %d with no legal moves (empty hand), "
            "%d whose selected_card was not a legal move. "
            "A non-trivial share here means the recording side is broken.",
            dropped,
            len(df),
            dropped / len(df) * 100 if len(df) else 0.0,
            dropped_no_candidates,
            dropped_illegal_selection,
        )

    if not feature_rows:
        return (
            np.zeros((0, len(CANDIDATE_FEATURE_NAMES)), dtype=np.float32),
            np.zeros(0, dtype=np.int64),
            np.zeros(0, dtype=np.int64),
            np.zeros(0, dtype=object),
        )

    return (
        np.stack(feature_rows).astype(np.float32),
        np.array(labels, dtype=np.int64),
        np.array(decision_ids, dtype=np.int64),
        np.array(groups, dtype=object),
    )
