"""Hugging Face Spaces entrypoint: Gradio UI + FastAPI inference endpoint.

Run locally:
    cd python && uv run python app.py

Hugging Face Spaces auto-detects this file when `app_file: app.py` is set in
the Space's README.md front-matter.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Literal

import gradio as gr
import numpy as np
import skops.io as sio
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from model.features import (
    SUITS,
    build_candidate_features,
    card_id,
    normalize_suit,
)
from model.train import MODEL_PATH, MODEL_TYPE_CANDIDATE_SCORER, normalize_scores
from model.train import main as train_main

logger = logging.getLogger(__name__)

Role = Literal["napoleon", "adjutant", "allied"]
Suit = Literal["spades", "hearts", "diamonds", "clubs"]
# rank は features.RANK_TO_IDX の dict キーとして使われるため、Literal で閉じる。
# 素の str のままだと未知のランクが KeyError -> 500 になる (suit は元から Literal で
# 弾けていたのに rank だけ検証が無かった)。
Rank = Literal["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]

# 4 人ナポレオンのルール上の上限。1 人 10 枚 + 埋め札の受け取りで最大 13 枚、
# トリックには 4 枚しか出ない。無認証エンドポイントなので、推論コストが
# 手札の長さに比例する (合法手 1 枚 = 1 行を predict する) 以上、境界を明示する。
MAX_HAND_SIZE = 13
MAX_TABLE_CARDS = 4
MIN_CARD_VALUE = 1
MAX_CARD_VALUE = 14
MAX_TRICK_NUMBER = 12

# skops の許可リスト。空 = scikit-learn / 標準ライブラリの既知型しか受け付けない。
# model.train が保存する payload はこの範囲に収まる (ModelHolder.load 参照)。
TRUSTED_MODEL_TYPES: list[str] = []


class Card(BaseModel):
    id: str
    rank: Rank
    suit: Suit
    # value は float32 の特徴量に入るので、ルール上の範囲外は 422 で弾く。
    # 無制限だと 10**400 が OverflowError、10**39 が float32 の inf になって
    # どちらも 500 になる。
    value: int = Field(..., ge=MIN_CARD_VALUE, le=MAX_CARD_VALUE)


class PredictRequest(BaseModel):
    hand: list[Card] = Field(..., max_length=MAX_HAND_SIZE, description="Player's current hand")
    table_cards: list[Card] = Field(
        default_factory=list,
        max_length=MAX_TABLE_CARDS,
        description="Cards on the table",
    )
    current_suit: Suit | None = None
    trump_suit: Suit | None = None
    role: Role = "allied"
    is_napoleon_team: bool = False
    trick_number: int = Field(0, ge=0, le=MAX_TRICK_NUMBER)


class PredictResponse(BaseModel):
    predicted_card_id: str
    confidence: float
    top_k: list[dict]


class ModelHolder:
    """Lazy-loaded model holder; reloads when MODEL_PATH mtime changes."""

    def __init__(self) -> None:
        self._payload: dict | None = None
        self._mtime: float | None = None

    def load(self) -> dict:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model not found at {MODEL_PATH}. Train a model first via the UI or "
                "`uv run python -m model.train`."
            )
        mtime = MODEL_PATH.stat().st_mtime
        payload = self._payload
        if payload is None or self._mtime != mtime:
            logger.info("Loading model from %s", MODEL_PATH)
            # skops は scikit-learn / 標準ライブラリ以外の型を含むファイルの読み込みを
            # 拒否する。旧実装は get_untrusted_types() の結果をそのまま trusted に
            # 渡していたが、これは「そのファイルが要求する型を全て信頼する」であり
            # 安全機構を無効化しているのと同じ (任意コード実行の入口になる)。
            #
            # model.train が保存するのは RandomForestClassifier と素の Python/NumPy
            # 値だけで、実測でも get_untrusted_types() は [] を返す。したがって
            # trusted=[] に固定しても現行モデルは読める。将来モデルを外部ストレージ
            # から取得するようにしても、ここが壁として残る。
            payload = sio.load(MODEL_PATH, trusted=TRUSTED_MODEL_TYPES)
            self._payload = payload
            self._mtime = mtime
        return payload

    def info(self) -> dict:
        if not MODEL_PATH.exists():
            return {"status": "no_model"}
        p = self.load()
        return {
            "status": "loaded",
            "model_type": p.get("model_type", "legacy_52class"),
            "schema_version": p.get("schema_version", 1),
            "trained_rows": p.get("trained_rows"),
            "test_rows": p.get("test_rows"),
            "accuracy": p.get("accuracy"),
            "top3_accuracy": p.get("top3_accuracy"),
            "accuracy_non_forced": p.get("accuracy_non_forced"),
            "random_legal_baseline": p.get("random_legal_baseline"),
        }


MODEL = ModelHolder()


def _predict(request: PredictRequest, top_k: int = 5) -> PredictResponse:
    """Score only the legal moves and renormalize over them.

    合法手 (フォロー義務を満たすカード) だけを候補にしてスコアリングし、その中で
    正規化するので、返す confidence は「合法手の中でこの手が選ばれる確率」になる。
    旧実装は 52 枚全体の確率から手札分だけを抜き出して正規化せずに返していたため、
    確率質量の大半が出せないカードに漏れたまま 0.10〜0.25 に張り付いていた。
    """
    payload = MODEL.load()
    if payload.get("model_type") != MODEL_TYPE_CANDIDATE_SCORER:
        raise HTTPException(
            status_code=503,
            detail=(
                "Saved model uses the legacy 52-class format. Retrain via the UI or "
                "`uv run python -m model.train` to produce a candidate-scoring model."
            ),
        )
    model = payload["model"]

    hand = [c.model_dump() for c in request.hand]
    if not hand:
        raise HTTPException(status_code=400, detail="Hand is empty")
    table_cards = [c.model_dump() for c in request.table_cards]

    X, candidates = build_candidate_features(
        hand=hand,
        table_cards=table_cards,
        trump_suit=normalize_suit(request.trump_suit),
        role=request.role,
        is_napoleon_team=request.is_napoleon_team,
        trick_number=request.trick_number,
    )
    if len(candidates) == 0:
        raise HTTPException(status_code=400, detail="No legal moves for the given hand")

    scores = np.asarray(model.predict_proba(X))[:, 1]
    probabilities = normalize_scores(scores)

    ranked = sorted(
        ((card_id(c), float(p)) for c, p in zip(candidates, probabilities, strict=True)),
        key=lambda t: t[1],
        reverse=True,
    )
    top = ranked[: max(1, top_k)]
    best_id, best_conf = top[0]
    return PredictResponse(
        predicted_card_id=best_id,
        confidence=best_conf,
        top_k=[{"card_id": cid, "confidence": conf} for cid, conf in top],
    )


app = FastAPI(title="Napoleon ML Trainer", version="0.1.0")

# Defense-in-depth for PYSEC-2026-161 (Host header injection in starlette
# <=1.0.0): reject requests whose Host header is not in the allow list so the
# starlette `request.url.path` reconstruction cannot be poisoned. Once the
# supply-chain cooldown window allows starlette 1.0.1, this middleware becomes
# redundant for that CVE but still provides a useful general-purpose guard.
# Override the allow list via the ALLOWED_HOSTS env var (comma-separated)
# when deploying behind a custom domain.
_default_allowed_hosts = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "*.hf.space",  # Hugging Face Spaces default domain
]
_allowed_hosts_env = os.environ.get("ALLOWED_HOSTS", "").strip()
_allowed_hosts = (
    [h.strip() for h in _allowed_hosts_env.split(",") if h.strip()]
    if _allowed_hosts_env
    else _default_allowed_hosts
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=_allowed_hosts)


@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "model": MODEL.info()}


@app.post("/api/predict-card", response_model=PredictResponse)
def predict_card(request: PredictRequest) -> PredictResponse:
    try:
        return _predict(request)
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e)) from e


def _ui_train() -> str:
    """Gradio callback: kick off training and report result."""
    logger.info("Training triggered via Gradio UI")
    exit_code = train_main()
    if exit_code != 0:
        return "Training failed. Check server logs."
    info = MODEL.info()
    return (
        f"Trained successfully.\n"
        f"  trained_rows: {info.get('trained_rows')}\n"
        f"  test_rows:    {info.get('test_rows')}\n"
        f"  accuracy:     {info.get('accuracy'):.2%}\n"
        f"  top3:         {info.get('top3_accuracy'):.2%}"
    )


def _ui_predict(hand_json: str, table_json: str, role: str, trick: int) -> str:
    """Gradio callback: predict best card from JSON inputs."""
    try:
        hand = [Card(**c) for c in json.loads(hand_json or "[]")]
        table = [Card(**c) for c in json.loads(table_json or "[]")]
    except Exception as e:  # noqa: BLE001
        return f"Invalid JSON: {e}"
    req = PredictRequest(
        hand=hand,
        table_cards=table,
        current_suit=table[0].suit if table else None,
        role=role,  # type: ignore[arg-type]
        is_napoleon_team=role in ("napoleon", "adjutant"),
        trick_number=trick,
    )
    try:
        res = _predict(req)
    except (FileNotFoundError, HTTPException) as e:
        return f"Prediction error: {getattr(e, 'detail', str(e))}"
    lines = [f"Best: {res.predicted_card_id}  (confidence={res.confidence:.2%})", "Top candidates:"]
    for entry in res.top_k:
        lines.append(f"  {entry['card_id']:<14} {entry['confidence']:.2%}")
    return "\n".join(lines)


def _sample_hand_json() -> str:
    sample = [{"id": f"{s}-A", "rank": "A", "suit": s, "value": 14} for s in SUITS[:2]] + [
        {"id": "hearts-7", "rank": "7", "suit": "hearts", "value": 7}
    ]
    return json.dumps(sample, indent=2)


def build_ui() -> gr.Blocks:
    with gr.Blocks(title="Napoleon ML Trainer") as ui:
        gr.Markdown("# Napoleon ML Trainer\nTrain and test the card prediction model.")

        with gr.Tab("Train"):
            train_btn = gr.Button("Train model from Supabase", variant="primary")
            train_out = gr.Textbox(label="Result", lines=6, interactive=False)
            train_btn.click(fn=_ui_train, outputs=train_out)

        with gr.Tab("Predict"):
            with gr.Row():
                hand_input = gr.Textbox(
                    label="Hand (JSON array of Card)",
                    value=_sample_hand_json(),
                    lines=10,
                )
                table_input = gr.Textbox(
                    label="Table cards (JSON array of Card)",
                    value="[]",
                    lines=10,
                )
            with gr.Row():
                role_input = gr.Dropdown(
                    choices=["napoleon", "adjutant", "allied"], value="allied", label="Role"
                )
                trick_input = gr.Slider(0, 12, value=0, step=1, label="Trick number")
            predict_btn = gr.Button("Predict best card", variant="primary")
            predict_out = gr.Textbox(label="Result", lines=8, interactive=False)
            predict_btn.click(
                fn=_ui_predict,
                inputs=[hand_input, table_input, role_input, trick_input],
                outputs=predict_out,
            )

        with gr.Tab("Status"):
            status_btn = gr.Button("Refresh model status")
            status_out = gr.JSON(label="Model info")
            status_btn.click(fn=MODEL.info, outputs=status_out)

    return ui


ui = build_ui()
# Mount Gradio under "/" so the Space root shows the UI, while FastAPI keeps "/api/*".
app = gr.mount_gradio_app(app, ui, path="/")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    # Hugging Face Spaces expects 7860; bind 0.0.0.0 for container access.
    uvicorn.run(app, host="0.0.0.0", port=7860)
