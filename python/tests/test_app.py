"""Tests for the inference API surface (`app.py`).

セキュリティレビューで指摘された入力検証の穴に対する回帰テスト。
FastAPI は pydantic の ValidationError を 422 に変換するので、ここでは
モデル定義レベルで「弾かれること」を確認し、HTTP ステータスへの写像は
TestClient のテスト 1 本で押さえる。
"""

from __future__ import annotations

import numpy as np
import pytest
from pydantic import ValidationError

import app as app_module
from app import MAX_HAND_SIZE, MAX_TABLE_CARDS, Card, PredictRequest
from model.train import MODEL_TYPE_CANDIDATE_SCORER

VALID_CARD = {"id": "hearts-A", "rank": "A", "suit": "hearts", "value": 14}


def make_request(**overrides) -> PredictRequest:
    body = {
        "hand": [VALID_CARD],
        "table_cards": [],
        "current_suit": None,
        "trump_suit": "spades",
        "role": "allied",
        "is_napoleon_team": False,
        "trick_number": 0,
    }
    body.update(overrides)
    return PredictRequest(**body)


# --- Card field validation -------------------------------------------------


def test_valid_card_is_accepted():
    card = Card(**VALID_CARD)
    assert card.rank == "A"
    assert card.suit == "hearts"


@pytest.mark.parametrize("rank", ["ZZ", "", "1", "11", "j", "__proto__"])
def test_unknown_rank_is_rejected(rank):
    """rank は features.RANK_TO_IDX の dict キーになるので Literal で閉じる。

    素の str だと未知のランクが KeyError -> 500 になっていた。
    """
    with pytest.raises(ValidationError):
        Card(**{**VALID_CARD, "rank": rank})


@pytest.mark.parametrize("rank", ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"])
def test_every_real_rank_is_accepted(rank):
    assert Card(**{**VALID_CARD, "rank": rank}).rank == rank


@pytest.mark.parametrize("value", [0, -1, 15, 10**39, 10**400])
def test_out_of_range_value_is_rejected(value):
    """value は float32 の特徴量に入る。範囲外は inf / OverflowError で 500 になっていた。"""
    with pytest.raises(ValidationError):
        Card(**{**VALID_CARD, "value": value})


@pytest.mark.parametrize("suit", ["ZZ", "", "Spades"])
def test_unknown_suit_is_rejected(suit):
    with pytest.raises(ValidationError):
        Card(**{**VALID_CARD, "suit": suit})


# --- Request size limits ---------------------------------------------------


def test_hand_at_rule_limit_is_accepted():
    request = make_request(hand=[VALID_CARD] * MAX_HAND_SIZE)
    assert len(request.hand) == MAX_HAND_SIZE


def test_oversized_hand_is_rejected():
    """推論コストは手札の長さに比例する。無認証なので上限を明示する。"""
    with pytest.raises(ValidationError):
        make_request(hand=[VALID_CARD] * (MAX_HAND_SIZE + 1))


def test_table_cards_at_limit_and_over():
    assert len(make_request(table_cards=[VALID_CARD] * MAX_TABLE_CARDS).table_cards) == 4
    with pytest.raises(ValidationError):
        make_request(table_cards=[VALID_CARD] * (MAX_TABLE_CARDS + 1))


def test_trick_number_range():
    assert make_request(trick_number=12).trick_number == 12
    with pytest.raises(ValidationError):
        make_request(trick_number=13)
    with pytest.raises(ValidationError):
        make_request(trick_number=-1)


# --- _predict behaviour ----------------------------------------------------


class _StubModel:
    """Scores every candidate identically so probabilities split evenly."""

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        scores = np.full(len(X), 0.5)
        return np.column_stack([1 - scores, scores])


@pytest.fixture
def stub_model(monkeypatch):
    payload = {"model": _StubModel(), "model_type": MODEL_TYPE_CANDIDATE_SCORER}
    monkeypatch.setattr(app_module.MODEL, "load", lambda: payload)
    return payload


def test_predict_restricts_to_legal_moves_and_normalizes(stub_model):
    """フォロー義務があるとき、出せないカードは top_k に現れない。"""
    hand = [
        {"id": "hearts-K", "rank": "K", "suit": "hearts", "value": 13},
        {"id": "hearts-3", "rank": "3", "suit": "hearts", "value": 3},
        {"id": "spades-A", "rank": "A", "suit": "spades", "value": 14},
    ]
    table = [{"id": "hearts-9", "rank": "9", "suit": "hearts", "value": 9}]
    response = app_module._predict(
        make_request(hand=hand, table_cards=table, current_suit="hearts")
    )

    card_ids = [entry["card_id"] for entry in response.top_k]
    assert set(card_ids) == {"hearts-K", "hearts-3"}
    assert sum(entry["confidence"] for entry in response.top_k) == pytest.approx(1.0)


def test_predict_forced_move_has_full_confidence(stub_model):
    response = app_module._predict(make_request(hand=[VALID_CARD]))
    assert response.predicted_card_id == "hearts-A"
    assert response.confidence == pytest.approx(1.0)


def test_predict_rejects_legacy_model(monkeypatch):
    """旧 52 クラス形式が置かれていたら 503 (mlClient はソフトミス扱いにする)。"""
    monkeypatch.setattr(app_module.MODEL, "load", lambda: {"model": _StubModel()})
    with pytest.raises(app_module.HTTPException) as excinfo:
        app_module._predict(make_request())
    assert excinfo.value.status_code == 503


def test_predict_rejects_empty_hand(stub_model):
    with pytest.raises(app_module.HTTPException) as excinfo:
        app_module._predict(make_request(hand=[]))
    assert excinfo.value.status_code == 400


# --- skops allow-list ------------------------------------------------------


def test_trusted_model_types_is_empty():
    """get_untrusted_types() の結果をそのまま信頼すると安全機構が無効化される。

    model.train が保存するのは scikit-learn / 標準ライブラリの既知型だけなので、
    許可リストは空のままで読める。
    """
    assert app_module.TRUSTED_MODEL_TYPES == []


# --- HTTP status mapping ---------------------------------------------------


def test_invalid_payload_maps_to_422_not_500():
    """pydantic の検証失敗が 500 ではなく 422 になることを一度だけ実地で確認する。"""
    pytest.importorskip("httpx")
    from fastapi.testclient import TestClient

    # TrustedHostMiddleware は既定の "testserver" ホストを 400 で弾く
    client = TestClient(app_module.app, base_url="http://localhost")
    body = {
        "hand": [{**VALID_CARD, "rank": "ZZ"}],
        "table_cards": [],
        "trump_suit": "spades",
        "role": "allied",
        "is_napoleon_team": False,
        "trick_number": 0,
    }
    assert client.post("/api/predict-card", json=body).status_code == 422

    body["hand"] = [VALID_CARD] * (MAX_HAND_SIZE + 1)
    body["hand"][0] = VALID_CARD
    assert client.post("/api/predict-card", json=body).status_code == 422
