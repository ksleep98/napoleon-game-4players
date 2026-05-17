"""Fetch ML training data from Supabase as a pandas DataFrame."""

from __future__ import annotations

import logging
import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import Client, create_client

logger = logging.getLogger(__name__)


def _load_env() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)


def get_supabase_client() -> Client:
    _load_env()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    if not url or not key:
        raise RuntimeError(
            "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_ANON_KEY "
            "in python/.env (see python/.env.example)."
        )
    return create_client(url, key)


def fetch_training_data(
    completed_only: bool = True,
    page_size: int = 1000,
) -> pd.DataFrame:
    """Fetch ml_training_data rows from Supabase, paginated.

    completed_only: when True, only rows with game_result IS NOT NULL.
    """
    client = get_supabase_client()
    rows: list[dict] = []
    offset = 0
    while True:
        query = client.table("ml_training_data").select("*")
        if completed_only:
            query = query.not_.is_("game_result", "null")
        query = query.order("created_at").range(offset, offset + page_size - 1)
        resp = query.execute()
        batch = resp.data or []
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    df = pd.DataFrame(rows)
    return df


def summarize(df: pd.DataFrame) -> None:
    if df.empty:
        logger.info("No rows fetched.")
        return
    logger.info("Rows: %d", len(df))
    logger.info("Games: %d", df["game_id"].nunique())
    logger.info("Players: %d", df["player_id"].nunique())
    logger.info("Role breakdown:\n%s", df["role"].value_counts())
    logger.info("Game results:\n%s", df["game_result"].value_counts(dropna=False))
    # .loc[bool_mask] returns DataFrame (not ambiguous DataFrame | Series).
    ai_only: pd.DataFrame = df.loc[df["is_ai_player"].astype(bool)]
    logger.info(
        "AI difficulty (AI rows only):\n%s",
        ai_only["ai_difficulty"].value_counts(dropna=False),
    )


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    df = fetch_training_data()
    summarize(df)
