"""Fetch ML training data from Supabase as a pandas DataFrame."""

from __future__ import annotations

import os
from pathlib import Path

import pandas as pd
from dotenv import load_dotenv
from supabase import Client, create_client


def _load_env() -> None:
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)


def get_supabase_client() -> Client:
    _load_env()
    url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    )
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
        print("No rows fetched.")
        return
    print(f"Rows: {len(df)}")
    print(f"Games: {df['game_id'].nunique()}")
    print(f"Players: {df['player_id'].nunique()}")
    print("\nRole breakdown:")
    print(df["role"].value_counts())
    print("\nGame results:")
    print(df["game_result"].value_counts(dropna=False))
    print("\nAI difficulty (AI rows only):")
    ai_only = df[df["is_ai_player"]]
    print(ai_only["ai_difficulty"].value_counts(dropna=False))


if __name__ == "__main__":
    df = fetch_training_data()
    summarize(df)
