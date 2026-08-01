"""Check the Python rule ports against fixtures dumped from the TypeScript source.

`model/features.py` re-implements two rules that live in TypeScript:

  - `card_strength`  <- src/lib/napoleonCardRules.ts  `getCardStrength`
  - `legal_cards`    <- src/lib/ai/gameSimulator.ts   `getPlayableCards`

A drift between the two silently corrupts both training and inference: the model
would learn from features describing a game that is not the game being played.
Nothing else catches this, because the two implementations are tested in
different languages.

`python/tests/fixtures/rules.json` is generated from the TypeScript functions by
`pnpm ml:fixtures` and committed. These tests replay every case.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from model.features import card_strength, legal_cards

FIXTURE_PATH = Path(__file__).resolve().parent / "fixtures" / "rules.json"

REGENERATE_HINT = (
    "TypeScript 側のルールを変更したなら `pnpm ml:fixtures` でフィクスチャを再生成して "
    "コミットすること。変更していないなら model/features.py の移植がズレている。"
)


@pytest.fixture(scope="module")
def fixtures() -> dict:
    if not FIXTURE_PATH.exists():
        pytest.fail(f"Missing {FIXTURE_PATH}. Run `pnpm ml:fixtures` from the repo root.")
    with FIXTURE_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def test_fixture_covers_the_whole_card_strength_space(fixtures):
    """52 cards x 4 trumps x 4 leads x 2 first-trick flags."""
    assert len(fixtures["cards"]) == 52
    assert len(fixtures["card_strength"]) == 52 * 4 * 4 * 2


def test_card_strength_matches_typescript(fixtures):
    cards = fixtures["cards"]
    mismatches = []
    for case in fixtures["card_strength"]:
        actual = card_strength(
            cards[case["card_id"]],
            case["trump_suit"],
            case["leading_suit"],
            case["is_first_trick"],
        )
        if actual != case["strength"]:
            mismatches.append(
                f"{case['card_id']} trump={case['trump_suit']} "
                f"lead={case['leading_suit']} first={case['is_first_trick']}: "
                f"python={actual} typescript={case['strength']}"
            )
    assert not mismatches, (
        f"{len(mismatches)}/{len(fixtures['card_strength'])} card_strength cases differ "
        f"from TypeScript.\n{REGENERATE_HINT}\n" + "\n".join(mismatches[:20])
    )


def test_legal_cards_matches_typescript(fixtures):
    cards = fixtures["cards"]
    mismatches = []
    for index, case in enumerate(fixtures["playable_cards"]):
        hand = [cards[card_id] for card_id in case["hand"]]
        table = [cards[card_id] for card_id in case["table_cards"]]
        actual = [f"{c['suit']}-{c['rank']}" for c in legal_cards(hand, table)]
        if actual != case["playable"]:
            mismatches.append(
                f"case {index}: hand={case['hand']} table={case['table_cards']} "
                f"python={actual} typescript={case['playable']}"
            )
    assert not mismatches, (
        f"{len(mismatches)}/{len(fixtures['playable_cards'])} legal_cards cases differ "
        f"from TypeScript.\n{REGENERATE_HINT}\n" + "\n".join(mismatches[:20])
    )


def test_legal_cards_fixture_exercises_both_branches(fixtures):
    """フィクスチャが「リード」「フォロー可」「ボイド」の 3 通りを含んでいること。

    これが崩れると全件一致していても意味が無くなる。
    """
    leading = following = void = 0
    for case in fixtures["playable_cards"]:
        if not case["table_cards"]:
            leading += 1
        elif len(case["playable"]) < len(case["hand"]):
            following += 1
        else:
            void += 1
    assert leading > 0
    assert following > 0
    assert void > 0
