"""Unit tests for model.features (feature engineering)."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from model.features import (
    FEATURE_NAMES,
    HIGH_RANKS,
    RANK_TO_IDX,
    ROLES,
    SUITS,
    build_feature_matrix,
    card_class_index,
    card_id,
    class_index_to_card_id,
)
from tests.factories import CARD_HEARTS_K, CARD_SPADES_A, make_row


def test_card_id_format():
    assert card_id({"suit": "spades", "rank": "A"}) == "spades-A"
    assert card_id({"suit": "clubs", "rank": "10"}) == "clubs-10"


def test_card_class_index_range_and_uniqueness():
    """Every (suit, rank) maps to a distinct index in 0..51."""
    seen = set()
    for suit in SUITS:
        for rank in RANK_TO_IDX:
            idx = card_class_index({"suit": suit, "rank": rank})
            assert 0 <= idx < 52
            seen.add(idx)
    assert len(seen) == 52


def test_card_class_index_known_values():
    # spades is suit 0, rank "2" is rank 0 -> index 0.
    assert card_class_index({"suit": "spades", "rank": "2"}) == 0
    # clubs is suit 3, rank "A" is rank 12 -> 3*13 + 12 = 51.
    assert card_class_index({"suit": "clubs", "rank": "A"}) == 51


def test_class_index_round_trip():
    """card_class_index and class_index_to_card_id are inverse for all 52."""
    for suit in SUITS:
        for rank in RANK_TO_IDX:
            idx = card_class_index({"suit": suit, "rank": rank})
            assert class_index_to_card_id(idx) == f"{suit}-{rank}"


def test_feature_names_length_matches_vector():
    """The produced feature vector width equals len(FEATURE_NAMES)."""
    df = pd.DataFrame([make_row()])
    X, _ = build_feature_matrix(df)
    assert X.shape == (1, len(FEATURE_NAMES))


def test_build_feature_matrix_shape_dtype_and_labels():
    rows = [
        make_row(selected_card=CARD_SPADES_A),
        make_row(selected_card=CARD_HEARTS_K),
    ]
    df = pd.DataFrame(rows)
    X, y = build_feature_matrix(df)

    assert X.shape == (2, len(FEATURE_NAMES))
    assert X.dtype == np.float32
    assert y.dtype == np.int64
    assert y[0] == card_class_index(CARD_SPADES_A)
    assert y[1] == card_class_index(CARD_HEARTS_K)


def _features_as_dict(row: dict) -> dict:
    df = pd.DataFrame([row])
    X, _ = build_feature_matrix(df)
    return dict(zip(FEATURE_NAMES, X[0], strict=True))


def test_hand_suit_and_high_counts():
    hand = [
        {"suit": "spades", "rank": "A", "value": 14},
        {"suit": "spades", "rank": "K", "value": 13},
        {"suit": "hearts", "rank": "Q", "value": 12},
    ]
    feats = _features_as_dict(make_row(hand=hand))
    assert feats["hand_size"] == 3
    assert feats["hand_count_spades"] == 2
    assert feats["hand_count_hearts"] == 1
    assert feats["hand_count_diamonds"] == 0
    # High-card counts (J/Q/K/A).
    assert feats["hand_count_A"] == 1
    assert feats["hand_count_K"] == 1
    assert feats["hand_count_Q"] == 1
    assert feats["hand_count_J"] == 0
    assert feats["hand_max_value"] == 14
    assert feats["hand_min_value"] == 12


def test_empty_hand_sets_min_value_zero():
    feats = _features_as_dict(make_row(hand=[]))
    assert feats["hand_size"] == 0
    assert feats["hand_min_value"] == 0
    assert feats["hand_max_value"] == 0


def test_role_one_hot_is_exclusive():
    for role in ROLES:
        feats = _features_as_dict(make_row(role=role))
        active = [feats[f"role_{r}"] for r in ROLES]
        assert sum(active) == 1
        assert feats[f"role_{role}"] == 1


def test_null_suit_flags_and_one_hot():
    feats = _features_as_dict(make_row(current_suit=None, trump_suit=None))
    assert feats["current_suit_null"] == 1
    assert feats["trump_suit_null"] == 1
    assert all(feats[f"current_suit_{s}"] == 0 for s in SUITS)
    assert all(feats[f"trump_suit_{s}"] == 0 for s in SUITS)


def test_current_suit_one_hot_and_null_flag_when_set():
    feats = _features_as_dict(make_row(current_suit="hearts"))
    assert feats["current_suit_null"] == 0
    assert feats["current_suit_hearts"] == 1
    assert feats["current_suit_spades"] == 0


def test_has_lead_suit_in_hand():
    hand = [{"suit": "hearts", "rank": "5", "value": 5}]
    assert (
        _features_as_dict(make_row(hand=hand, current_suit="hearts"))["has_lead_suit_in_hand"] == 1
    )
    assert (
        _features_as_dict(make_row(hand=hand, current_suit="spades"))["has_lead_suit_in_hand"] == 0
    )
    # With no lead suit, the flag is 0 regardless of hand.
    assert _features_as_dict(make_row(hand=hand, current_suit=None))["has_lead_suit_in_hand"] == 0


def test_table_lead_max_only_counts_lead_suit():
    table = [
        {"suit": "spades", "rank": "K", "value": 13},
        {"suit": "hearts", "rank": "A", "value": 14},
    ]
    feats = _features_as_dict(make_row(table_cards=table, current_suit="spades"))
    assert feats["table_size"] == 2
    # Highest overall value on the table is the off-suit hearts A (14)...
    assert feats["table_max_value"] == 14
    # ...but the lead-suit (spades) max is only the spades K (13).
    assert feats["table_lead_max_value"] == 13


def test_is_napoleon_team_and_trick_number_passthrough():
    feats = _features_as_dict(make_row(is_napoleon_team=True, trick_number=7))
    assert feats["is_napoleon_team"] == 1
    assert feats["trick_number"] == 7
    feats2 = _features_as_dict(make_row(is_napoleon_team=False))
    assert feats2["is_napoleon_team"] == 0


@pytest.mark.parametrize("rank", HIGH_RANKS)
def test_each_high_rank_counted(rank):
    hand = [{"suit": "spades", "rank": rank, "value": 10}]
    feats = _features_as_dict(make_row(hand=hand))
    assert feats[f"hand_count_{rank}"] == 1
