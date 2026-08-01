/**
 * TS 側のルール実装をフィクスチャとして書き出し、Python 移植との差分を検知できるようにする。
 *
 * `python/model/features.py` は `getCardStrength` と `getPlayableCards` を Python に
 * 移植して持っている。移植のズレはモデルの学習・推論を静かに壊すが、テストが
 * 別言語に分かれているので普通のテストでは検知できない。
 *
 * このスクリプトが TS 側の出力を `python/tests/fixtures/rules.json` に固定し、
 * `python/tests/test_rule_parity.py` が Python 側の出力と全件突き合わせる。
 *
 * 実行:
 *   pnpm ml:fixtures
 *
 * TS 側のルールを意図的に変えたときは再生成してコミットすること。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { getPlayableCards } from '@/lib/ai/gameSimulator'
import { createDeck, GAME_PHASES, SUITS } from '@/lib/constants'
import { getCardStrength } from '@/lib/napoleonCardRules'
import type { Card, GameState, Suit, Trick } from '@/types/game'

const OUTPUT_PATH = join(
  process.cwd(),
  'python',
  'tests',
  'fixtures',
  'rules.json'
)

/** getPlayableCards のランダムケース数（固定シードなので毎回同じ内容になる） */
const PLAYABLE_CASE_COUNT = 500
const RANDOM_SEED = 20260801
const MAX_HAND_SIZE = 10
const MAX_TABLE_SIZE = 3

const FIXTURE_PLAYER_ID = 'player-under-test'
const FIXTURE_OPPONENT_ID = 'opponent'
const FIXTURE_GAME_ID = 'fixture-game'
const FIXTURE_TRICK_ID = 'fixture-trick'
const FIXTURE_PLAYER_NAME = 'Fixture'

/**
 * mulberry32: 依存を増やさずに再現可能な乱数を得るための小さな PRNG。
 * フィクスチャは決定的でなければ差分検知に使えないので Math.random は使わない。
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface StrengthCase {
  card_id: string
  trump_suit: Suit
  leading_suit: Suit
  is_first_trick: boolean
  strength: number
}

interface PlayableCase {
  hand: string[]
  table_cards: string[]
  playable: string[]
}

function buildStrengthCases(deck: Card[]): StrengthCase[] {
  const cases: StrengthCase[] = []
  for (const card of deck) {
    for (const trumpSuit of SUITS) {
      for (const leadingSuit of SUITS) {
        for (const isFirstTrick of [false, true]) {
          cases.push({
            card_id: card.id,
            trump_suit: trumpSuit,
            leading_suit: leadingSuit,
            is_first_trick: isFirstTrick,
            strength: getCardStrength(
              card,
              trumpSuit,
              leadingSuit,
              isFirstTrick
            ),
          })
        }
      }
    }
  }
  return cases
}

function buildTrick(tableCards: Card[]): Trick {
  return {
    id: FIXTURE_TRICK_ID,
    cards: tableCards.map((card, order) => ({
      card,
      playerId: FIXTURE_OPPONENT_ID,
      order,
    })),
    leadingSuit: tableCards.length > 0 ? tableCards[0].suit : undefined,
    completed: false,
  }
}

function buildState(hand: Card[], tableCards: Card[]): GameState {
  const now = new Date(0)
  return {
    id: FIXTURE_GAME_ID,
    players: [
      {
        id: FIXTURE_PLAYER_ID,
        name: FIXTURE_PLAYER_NAME,
        hand,
        isNapoleon: false,
        isAdjutant: false,
        position: 1,
        isAI: true,
      },
    ],
    currentTrick: buildTrick(tableCards),
    tricks: [],
    currentPlayerIndex: 0,
    phase: GAME_PHASES.PLAYING,
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: now,
    updatedAt: now,
  }
}

function buildPlayableCases(deck: Card[]): PlayableCase[] {
  const random = createRandom(RANDOM_SEED)
  const cases: PlayableCase[] = []

  for (let i = 0; i < PLAYABLE_CASE_COUNT; i++) {
    // デッキをシャッフルして先頭から手札と場札を切り出す（重複なし）
    const shuffled = [...deck]
    for (let j = shuffled.length - 1; j > 0; j--) {
      const k = Math.floor(random() * (j + 1))
      ;[shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]]
    }
    const handSize = 1 + Math.floor(random() * MAX_HAND_SIZE)
    const tableSize = Math.floor(random() * (MAX_TABLE_SIZE + 1))
    const hand = shuffled.slice(0, handSize)
    const tableCards = shuffled.slice(handSize, handSize + tableSize)

    const playable = getPlayableCards(
      buildState(hand, tableCards),
      FIXTURE_PLAYER_ID
    )
    cases.push({
      hand: hand.map((c) => c.id),
      table_cards: tableCards.map((c) => c.id),
      playable: playable.map((c) => c.id),
    })
  }

  return cases
}

function main(): void {
  const deck = createDeck()
  const payload = {
    // 再生成のたびに内容が変わらないよう、生成条件も一緒に残す
    generated_by: 'pnpm ml:fixtures (scripts/dump-rule-fixtures.ts)',
    seed: RANDOM_SEED,
    // Python 側が値表を持たなくて済むよう、カードの実体もここに含める
    cards: Object.fromEntries(
      deck.map((card) => [
        card.id,
        { suit: card.suit, rank: card.rank, value: card.value },
      ])
    ),
    card_strength: buildStrengthCases(deck),
    playable_cards: buildPlayableCases(deck),
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log(
    `Wrote ${payload.card_strength.length} card_strength cases and ` +
      `${payload.playable_cards.length} playable_cards cases -> ${OUTPUT_PATH}`
  )
}

main()
