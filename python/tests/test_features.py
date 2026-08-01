"""Unit tests for model.features (feature engineering)."""

from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from model.features import (
    CANDIDATE_FEATURE_NAMES,
    FEATURE_NAMES,
    HIGH_RANKS,
    RANK_TO_IDX,
    ROLES,
    STRENGTH_COUNTER_JACK,
    STRENGTH_LEADING_BASE,
    STRENGTH_MIGHTY,
    STRENGTH_TRUMP_BASE,
    STRENGTH_TRUMP_JACK,
    SUITS,
    build_candidate_dataset,
    build_candidate_features,
    build_feature_matrix,
    card_class_index,
    card_id,
    card_strength,
    class_index_to_card_id,
    leading_suit_of,
    legal_cards,
    normalize_suit,
)
from tests.factories import CARD_HEARTS_K, CARD_SPADES_A, make_row, make_training_df


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


# ---------------------------------------------------------------------------
# Candidate scoring formulation
# ---------------------------------------------------------------------------

CARD_SPADES_J = {"suit": "spades", "rank": "J", "value": 11}
CARD_CLUBS_J = {"suit": "clubs", "rank": "J", "value": 11}
CARD_SPADES_5 = {"suit": "spades", "rank": "5", "value": 5}
CARD_HEARTS_3 = {"suit": "hearts", "rank": "3", "value": 3}
CARD_HEARTS_9 = {"suit": "hearts", "rank": "9", "value": 9}


@pytest.mark.parametrize("value", [None, float("nan"), "not-a-suit", 3])
def test_normalize_suit_rejects_non_suits(value):
    """Supabase NULL arrives as float('nan'); it must not reach a dict lookup."""
    assert normalize_suit(value) is None


@pytest.mark.parametrize("suit", SUITS)
def test_normalize_suit_passes_through_real_suits(suit):
    assert normalize_suit(suit) == suit


def test_card_strength_special_cards_outrank_everything():
    # ♠A (Mighty) > 切り札 J > 裏 J > 通常の切り札 > リードスート
    assert card_strength(CARD_SPADES_A, "spades", "hearts", False) == STRENGTH_MIGHTY
    assert card_strength(CARD_SPADES_J, "spades", "hearts", False) == STRENGTH_TRUMP_JACK
    assert card_strength(CARD_CLUBS_J, "spades", "hearts", False) == STRENGTH_COUNTER_JACK
    assert card_strength(CARD_SPADES_5, "spades", "hearts", False) == STRENGTH_TRUMP_BASE + 5
    assert card_strength(CARD_HEARTS_9, "spades", "hearts", False) == STRENGTH_LEADING_BASE + 9
    # 切り札でもリードスートでもないカードは素の値のまま
    assert card_strength(CARD_HEARTS_3, "spades", "diamonds", False) == 3


def test_card_strength_first_trick_disables_ordinary_trumps():
    """1 トリック目は Mighty / 正 J / 裏 J 以外の切り札特権が働かない。"""
    assert card_strength(CARD_SPADES_5, "spades", "hearts", True) == 5
    # 特殊カードは 1 トリック目でも有効
    assert card_strength(CARD_SPADES_A, "spades", "hearts", True) == STRENGTH_MIGHTY
    assert card_strength(CARD_SPADES_J, "spades", "hearts", True) == STRENGTH_TRUMP_JACK


def test_card_strength_without_trump_suit():
    """trump_suit が未設定 (None) でも例外にならず、リードスート基準で評価される。"""
    assert card_strength(CARD_HEARTS_9, None, "hearts", False) == STRENGTH_LEADING_BASE + 9
    assert card_strength(CARD_HEARTS_9, None, "spades", False) == 9


def test_leading_suit_of():
    assert leading_suit_of([]) is None
    assert leading_suit_of([CARD_HEARTS_K, CARD_SPADES_A]) == "hearts"


def test_legal_cards_leading_allows_whole_hand():
    hand = [CARD_SPADES_A, CARD_HEARTS_K]
    assert legal_cards(hand, []) == hand


def test_legal_cards_must_follow_suit_when_possible():
    hand = [CARD_SPADES_A, CARD_HEARTS_K, CARD_HEARTS_3]
    legal = legal_cards(hand, [CARD_HEARTS_9])
    assert legal == [CARD_HEARTS_K, CARD_HEARTS_3]


def test_legal_cards_falls_back_to_whole_hand_when_void():
    hand = [CARD_SPADES_A, CARD_SPADES_5]
    assert legal_cards(hand, [CARD_HEARTS_9]) == hand


def _candidate_dicts(X, candidates):
    return [dict(zip(CANDIDATE_FEATURE_NAMES, row, strict=True)) for row in X]


def test_candidate_features_one_row_per_legal_card():
    hand = [CARD_SPADES_A, CARD_HEARTS_K, CARD_HEARTS_3]
    X, candidates = build_candidate_features(
        hand=hand,
        table_cards=[CARD_HEARTS_9],
        trump_suit="spades",
        role="napoleon",
        is_napoleon_team=True,
        trick_number=3,
    )
    # フォロー義務があるので ♥ の 2 枚だけが候補になる
    assert [card_id(c) for c in candidates] == ["hearts-K", "hearts-3"]
    assert X.shape == (2, len(CANDIDATE_FEATURE_NAMES))
    assert X.dtype == np.float32


def test_candidate_features_rank_and_beat_flags():
    hand = [CARD_HEARTS_K, CARD_HEARTS_3]
    X, candidates = build_candidate_features(
        hand=hand,
        table_cards=[CARD_HEARTS_9],
        trump_suit="spades",
        role="allied",
        is_napoleon_team=False,
        trick_number=3,
    )
    rows = _candidate_dicts(X, candidates)
    king, three = rows[0], rows[1]

    assert king["cand_is_strongest_legal"] == 1
    assert three["cand_is_weakest_legal"] == 1
    # ♥K は場の ♥9 に勝てるが ♥3 は勝てない
    assert king["cand_beats_table_best"] == 1
    assert three["cand_beats_table_best"] == 0
    assert king["legal_count"] == 2
    assert king["is_leading"] == 0
    assert king["has_lead_suit_in_hand"] == 1


def test_candidate_features_flags_special_cards():
    hand = [
        CARD_SPADES_A,
        CARD_SPADES_J,
        CARD_CLUBS_J,
        {"suit": "hearts", "rank": "Q", "value": 12},
    ]
    X, candidates = build_candidate_features(
        hand=hand,
        table_cards=[],
        trump_suit="spades",
        role="napoleon",
        is_napoleon_team=True,
        trick_number=4,
    )
    rows = dict(zip([card_id(c) for c in candidates], _candidate_dicts(X, candidates), strict=True))
    assert rows["spades-A"]["cand_is_mighty"] == 1
    assert rows["spades-J"]["cand_is_trump_jack"] == 1
    assert rows["clubs-J"]["cand_is_counter_jack"] == 1
    assert rows["hearts-Q"]["cand_is_heart_queen"] == 1
    # リード局面では is_leading が立ち、リードスート判定は全て 0
    assert all(r["is_leading"] == 1 for r in rows.values())
    assert all(r["cand_is_lead_suit"] == 0 for r in rows.values())


def test_candidate_features_empty_hand_returns_no_rows():
    X, candidates = build_candidate_features(
        hand=[],
        table_cards=[],
        trump_suit="spades",
        role="allied",
        is_napoleon_team=False,
        trick_number=0,
    )
    assert candidates == []
    assert X.shape == (0, len(CANDIDATE_FEATURE_NAMES))


@pytest.mark.parametrize("position", [0, 1, 2])
def test_build_candidate_dataset_marks_the_positive_wherever_it_sits(position):
    """正例は「常に先頭」ではない。位置を決め打ちする実装バグを落とすための回帰。

    ファクトリの既定データは正解カードが index 0 に来がちなので、明示的に
    全ての位置を試す。
    """
    others = [CARD_HEARTS_3, CARD_HEARTS_9]
    target = CARD_HEARTS_K
    hand = [*others[:position], target, *others[position:]]
    row = make_row(hand=hand, table_cards=[], selected_card=target, trick_number=3)

    _, y, decision_ids, _ = build_candidate_dataset(pd.DataFrame([row]))

    assert len(np.unique(decision_ids)) == 1
    assert y.sum() == 1
    assert int(np.argmax(y)) == position


def test_build_candidate_dataset_positive_index_follows_legal_filtering():
    """フォローで手札が絞られると、正例の index は手札上の位置とズレる。"""
    hand = [CARD_SPADES_A, CARD_HEARTS_3, CARD_SPADES_5, CARD_HEARTS_K]
    row = make_row(
        hand=hand,
        table_cards=[CARD_HEARTS_9],
        selected_card=CARD_HEARTS_K,
        trick_number=4,
    )

    _, y, _, _ = build_candidate_dataset(pd.DataFrame([row]))

    # 合法手は [hearts-3, hearts-K] の 2 枚。正解は手札では index 3 だが候補では 1。
    assert len(y) == 2
    assert list(y) == [0, 1]


def test_first_trick_is_trick_number_zero_not_one():
    """trick_number は「完了したトリック数」なので 1 トリック目は 0。

    src/lib/ml/dataExtractor.ts が完了トリック数を記録しており、スキーマも >= 0。
    0 起点/1 起点を取り違えると、通常の切り札特権を無効化する局面が 1 つズレる。
    """
    trump_five = {"suit": "spades", "rank": "5", "value": 5}
    lead_nine = {"suit": "hearts", "rank": "9", "value": 9}

    def strength_of_trump(trick_number: int) -> float:
        X, candidates = build_candidate_features(
            hand=[trump_five],
            table_cards=[lead_nine],
            trump_suit="spades",
            role="allied",
            is_napoleon_team=False,
            trick_number=trick_number,
        )
        assert [card_id(c) for c in candidates] == ["spades-5"]
        feats = dict(zip(CANDIDATE_FEATURE_NAMES, X[0], strict=True))
        return feats["cand_strength"]

    # trick 0 = 1 トリック目: 通常の切り札特権は効かず、素の値 5 のまま
    assert strength_of_trump(0) == pytest.approx(5 / 1000)
    # trick 1 = 2 トリック目以降: 切り札として 700 + 5
    assert strength_of_trump(1) == pytest.approx((STRENGTH_TRUMP_BASE + 5) / 1000)


def test_non_trump_jack_is_weakest_in_its_suit():
    """切り札 J・裏 J 以外の J は最弱扱い (NAPOLEON_RULES.md)。

    この規則を落とすと J が値 11 として扱われ、リードスートの 10 より強くなる。
    """
    lead_jack = {"suit": "hearts", "rank": "J", "value": 11}
    lead_ten = {"suit": "hearts", "rank": "10", "value": 10}
    lead_two = {"suit": "hearts", "rank": "2", "value": 2}

    # 切り札はスペード、裏スートはクラブ。♥J はどちらでもないので最弱。
    jack_strength = card_strength(lead_jack, "spades", "hearts", False)
    assert jack_strength == STRENGTH_LEADING_BASE + 1
    assert jack_strength < card_strength(lead_two, "spades", "hearts", False)
    assert jack_strength < card_strength(lead_ten, "spades", "hearts", False)

    # リードスートでも切り札でもない J も、素の値ではなく最弱として扱われない点に注意:
    # その他スートは value をそのまま返す (TypeScript 側と同じ)。
    off_suit_jack = {"suit": "clubs", "rank": "J", "value": 11}
    assert card_strength(off_suit_jack, "diamonds", "hearts", False) == 11

    # 参考: 切り札スートの J は必ず先に TRUMP_JACK 判定に吸われるので、
    # 切り札分岐側の J 特例には到達しない (TypeScript 側も同じ構造)。
    assert card_strength(
        {"suit": "diamonds", "rank": "J", "value": 11}, "diamonds", "hearts", False
    ) == (STRENGTH_TRUMP_JACK)


def test_build_candidate_dataset_labels_exactly_one_positive_per_decision():
    df = make_training_df(n_games=2, rows_per_game=5)
    X, y, decision_ids, groups = build_candidate_dataset(df)

    assert X.shape == (len(y), len(CANDIDATE_FEATURE_NAMES))
    assert len(decision_ids) == len(y) == len(groups)
    for decision in np.unique(decision_ids):
        assert y[decision_ids == decision].sum() == 1


def test_build_candidate_dataset_drops_rows_whose_selection_is_illegal():
    """壊れた記録 (選択カードが合法手にない) は静かに捨てる。"""
    good = make_row(hand=[CARD_HEARTS_K, CARD_HEARTS_3], selected_card=CARD_HEARTS_K)
    bad = make_row(hand=[CARD_HEARTS_K, CARD_HEARTS_3], selected_card=CARD_SPADES_A)
    X, y, decision_ids, _ = build_candidate_dataset(pd.DataFrame([good, bad]))

    assert len(np.unique(decision_ids)) == 1
    assert y.sum() == 1


def test_build_candidate_dataset_handles_missing_trump_suit():
    """trump_suit が NaN の行でも例外にならない (Supabase の NULL 経路)。"""
    row = make_row(trump_suit=float("nan"), hand=[CARD_HEARTS_K, CARD_HEARTS_3])
    row["selected_card"] = CARD_HEARTS_K
    X, y, _, _ = build_candidate_dataset(pd.DataFrame([row]))
    assert X.shape == (2, len(CANDIDATE_FEATURE_NAMES))
    assert y.sum() == 1
