"""Feature engineering for Napoleon card prediction model."""

from __future__ import annotations

import numpy as np
import pandas as pd

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
    """Return (X, y) where y is the 0..51 class index of the selected card."""
    X = np.stack([_row_features(row) for _, row in df.iterrows()])
    y = np.array([card_class_index(c) for c in df["selected_card"]], dtype=np.int64)
    return X, y
