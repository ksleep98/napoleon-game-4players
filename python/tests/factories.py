"""Test data factories for the ML trainer suite.

Kept separate from conftest.py so test modules can import these helpers
directly without re-importing the conftest plugin under a second module name.
"""

from __future__ import annotations

import pandas as pd

# {suit, rank, value}-shaped cards, mirroring what the Next.js side stores.
CARD_SPADES_A = {"suit": "spades", "rank": "A", "value": 14}
CARD_HEARTS_K = {"suit": "hearts", "rank": "K", "value": 13}
CARD_DIAMONDS_7 = {"suit": "diamonds", "rank": "7", "value": 7}
CARD_CLUBS_2 = {"suit": "clubs", "rank": "2", "value": 2}

# Four distinct "selected_card" targets — kept small so CalibratedClassifierCV's
# internal cv folds have enough samples per class in the train-path test.
TARGET_CARDS = [CARD_SPADES_A, CARD_HEARTS_K, CARD_DIAMONDS_7, CARD_CLUBS_2]


def make_row(
    *,
    game_id: str = "game-1",
    player_id: str = "player-1",
    trick_number: int = 1,
    hand: list[dict] | None = None,
    table_cards: list[dict] | None = None,
    current_suit: str | None = "spades",
    trump_suit: str | None = "hearts",
    selected_card: dict | None = None,
    role: str = "napoleon",
    is_napoleon_team: bool = True,
    game_result: str | None = "napoleon_win",
    player_final_score: int | None = 10,
    is_ai_player: bool = True,
    ai_difficulty: str | None = "normal",
) -> dict:
    """Build one ml_training_data row matching the Supabase schema."""
    return {
        "game_id": game_id,
        "player_id": player_id,
        "trick_number": trick_number,
        "hand": hand if hand is not None else [CARD_SPADES_A, CARD_HEARTS_K],
        "table_cards": table_cards if table_cards is not None else [],
        "current_suit": current_suit,
        "trump_suit": trump_suit,
        "selected_card": selected_card if selected_card is not None else CARD_SPADES_A,
        "game_phase": "playing",
        "role": role,
        "is_napoleon_team": is_napoleon_team,
        "game_result": game_result,
        "player_final_score": player_final_score,
        "is_ai_player": is_ai_player,
        "ai_difficulty": ai_difficulty,
    }


def make_training_df(n_games: int = 4, rows_per_game: int = 16) -> pd.DataFrame:
    """Build a synthetic, well-formed training DataFrame.

    Targets cycle through TARGET_CARDS so every class is represented many times,
    which keeps CalibratedClassifierCV(cv=3) happy on small data.
    """
    rows: list[dict] = []
    for g in range(n_games):
        for i in range(rows_per_game):
            target = TARGET_CARDS[(g * rows_per_game + i) % len(TARGET_CARDS)]
            rows.append(
                make_row(
                    game_id=f"game-{g}",
                    player_id=f"player-{i % 4}",
                    trick_number=(i % 12) + 1,
                    selected_card=target,
                    hand=[target, CARD_DIAMONDS_7, CARD_CLUBS_2],
                )
            )
    return pd.DataFrame(rows)
