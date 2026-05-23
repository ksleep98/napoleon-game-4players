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
import pandas as pd
import skops.io as sio
import uvicorn
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from starlette.middleware.trustedhost import TrustedHostMiddleware

from model.features import (
    SUITS,
    build_feature_matrix,
    class_index_to_card_id,
)
from model.train import MODEL_PATH
from model.train import main as train_main

logger = logging.getLogger(__name__)

Role = Literal["napoleon", "adjutant", "allied"]
Suit = Literal["spades", "hearts", "diamonds", "clubs"]


class Card(BaseModel):
    id: str
    rank: str
    suit: Suit
    value: int


class PredictRequest(BaseModel):
    hand: list[Card] = Field(..., description="Player's current hand")
    table_cards: list[Card] = Field(default_factory=list, description="Cards on the table")
    current_suit: Suit | None = None
    trump_suit: Suit | None = None
    role: Role = "allied"
    is_napoleon_team: bool = False
    trick_number: int = Field(0, ge=0, le=12)


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
            # skops scans the file for non-stdlib/scikit-learn types and refuses
            # to load unknown classes unless explicitly trusted — accept only the
            # types declared inside the file we just produced.
            trusted = sio.get_untrusted_types(file=MODEL_PATH)
            payload = sio.load(MODEL_PATH, trusted=trusted)
            self._payload = payload
            self._mtime = mtime
        return payload

    def info(self) -> dict:
        if not MODEL_PATH.exists():
            return {"status": "no_model"}
        p = self.load()
        return {
            "status": "loaded",
            "trained_rows": p.get("trained_rows"),
            "test_rows": p.get("test_rows"),
            "accuracy": p.get("accuracy"),
            "top3_accuracy": p.get("top3_accuracy"),
        }


MODEL = ModelHolder()


def _predict(request: PredictRequest, top_k: int = 5) -> PredictResponse:
    payload = MODEL.load()
    model = payload["model"]

    row = {
        "hand": [c.model_dump() for c in request.hand],
        "table_cards": [c.model_dump() for c in request.table_cards],
        "current_suit": request.current_suit,
        "trump_suit": request.trump_suit,
        "selected_card": {"suit": "spades", "rank": "2", "value": 2},  # placeholder for label
        "role": request.role,
        "is_napoleon_team": request.is_napoleon_team,
        "trick_number": request.trick_number,
    }
    df = pd.DataFrame([row])
    X, _ = build_feature_matrix(df)

    proba = model.predict_proba(X)[0]
    full = np.zeros(52)
    for col_idx, cls in enumerate(model.classes_):
        full[cls] = proba[col_idx]

    # Restrict to cards actually in hand (model may suggest cards player doesn't hold).
    hand_indices = {c.suit + "-" + c.rank: i for i, c in enumerate(request.hand)}
    candidates = []
    for class_idx, card_id in enumerate(class_index_to_card_id(i) for i in range(52)):
        if card_id in hand_indices:
            candidates.append((card_id, float(full[class_idx])))

    if not candidates:
        raise HTTPException(status_code=400, detail="Hand is empty")

    candidates.sort(key=lambda t: t[1], reverse=True)
    top = candidates[: max(1, top_k)]
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
