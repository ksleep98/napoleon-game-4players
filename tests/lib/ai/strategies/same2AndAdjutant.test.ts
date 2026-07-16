/**
 * Regression tests for:
 *  - Fix A: Adjutant must not "pass" the Mighty/Trump-J/Counter-J as a weak face
 *    card onto a trick Napoleon already wins (no covering Mighty with trump-J).
 *  - Fix B: Same2 risk/breaker logic must be disabled on trump-led tricks
 *    (Same2 is invalid when the leading suit is the trump suit).
 *  - Fix C: When forced to discard, the AI preserves a non-trump "2" (kept for a
 *    future Same2) instead of throwing it away early.
 */

import { evaluateAdjutantTactics } from '@/lib/ai/strategies/adjutantTactics'
import {
  getWeakestCardPreservingSame2,
  isFaceCard,
} from '@/lib/ai/strategies/helpers'
import {
  evaluateSame2Breaker,
  evaluateSpecialCardStrategy,
} from '@/lib/ai/strategies/specialCards'
import type { WinningRequirements } from '@/lib/ai/strategies/types'
import { GAME_PHASES } from '@/lib/constants'
import { isCounterJack, isMighty, isTrumpJack } from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'

type Rank = Card['rank']

const card = (id: string, suit: Suit, rank: Rank, value = 0): Card => ({
  id,
  suit,
  rank,
  value,
})

const player = (id: string, opts: Partial<Player> = {}): Player => ({
  id,
  name: id,
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  isAI: true,
  position: 1,
  ...opts,
})

const trick = (cards: Array<{ card: Card; playerId: string }>): Trick => ({
  id: 'current-trick',
  cards: cards.map((c, i) => ({ ...c, order: i })),
  leadingSuit: cards[0]?.card.suit,
  completed: false,
})

const baseGameState = (over: Partial<GameState> = {}): GameState => ({
  id: 'test-game',
  players: [],
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  hiddenCards: [],
  trumpSuit: 'spades',
  currentTrick: { id: 'current-trick', cards: [], completed: false },
  tricks: [],
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
})

const requirements: WinningRequirements = {
  napoleonTeamFaceCards: 0,
  allianceTeamFaceCards: 0,
  remainingFaceCards: 20,
  remainingTricks: 8,
  napoleonNeedsToWin: 4,
  allianceNeedsToBlock: 4,
  napoleonCanAffordToLose: 0,
  isNapoleonAhead: false,
  isAllianceAhead: false,
  isCriticalPhase: false,
}

// Trump = spades throughout (切り札スペード).
const MIGHTY = card('mighty', 'spades', 'A', 14) // スペードA
const TRUMP_JACK = card('trumpJ', 'spades', 'J', 11) // 表J（スペードJ）
const COUNTER_JACK = card('counterJ', 'clubs', 'J', 11) // 裏J（クラブJ）

describe('napoleonCardRules sanity (fixtures)', () => {
  test('special card identification under spades trump', () => {
    expect(isMighty(MIGHTY)).toBe(true)
    expect(isTrumpJack(TRUMP_JACK, 'spades')).toBe(true)
    expect(isCounterJack(COUNTER_JACK, 'spades')).toBe(true)
  })
})

describe('Fix A: adjutant does not cover Mighty with the trump Jack', () => {
  test('trump-J is NOT chosen as the face card to pass to a winning Napoleon', () => {
    const napoleon = player('nap', { isNapoleon: true })
    const adjutant = player('adj', { isAdjutant: true })
    const ally = player('ally')

    // Trick: ally leads a spade, Napoleon plays Mighty (now winning), ally follows.
    const currentTrick = trick([
      { card: card('lead', 'spades', 'K', 13), playerId: ally.id },
      { card: MIGHTY, playerId: napoleon.id },
      { card: card('a2', 'spades', 'Q', 12), playerId: 'ally2' },
    ])

    const gameState = baseGameState({
      players: [napoleon, adjutant, ally, player('ally2')],
      currentTrick,
      leadingSuit: 'spades',
    })

    // Adjutant must follow spades; its only non-Mighty face option is the trump J.
    const playable = [TRUMP_JACK, card('low', 'spades', '4', 4)]

    const tactics = evaluateAdjutantTactics(
      playable,
      currentTrick,
      gameState,
      requirements
    )

    expect(tactics.shouldPassFaceCard).toBe(true)
    // The trump Jack must never be passed (it would be wasted on Napoleon's
    // already-winning Mighty trick).
    expect(tactics.faceCardToPass).toBeNull()
  })

  test('a regular spade face card is still passed when available', () => {
    const napoleon = player('nap', { isNapoleon: true })
    const adjutant = player('adj', { isAdjutant: true })

    const currentTrick = trick([
      { card: card('lead', 'spades', '9', 9), playerId: 'ally' },
      { card: MIGHTY, playerId: napoleon.id },
      { card: card('a2', 'spades', '8', 8), playerId: 'ally2' },
    ])
    const gameState = baseGameState({
      players: [napoleon, adjutant, player('ally'), player('ally2')],
      currentTrick,
      leadingSuit: 'spades',
    })

    const regularFace = card('king', 'spades', 'K', 13)
    const playable = [TRUMP_JACK, regularFace, card('low', 'spades', '3', 3)]

    const tactics = evaluateAdjutantTactics(
      playable,
      currentTrick,
      gameState,
      requirements
    )

    expect(tactics.faceCardToPass).not.toBeNull()
    expect(isFaceCard(tactics.faceCardToPass as Card)).toBe(true)
    expect(isTrumpJack(tactics.faceCardToPass as Card, 'spades')).toBe(false)
    expect(isMighty(tactics.faceCardToPass as Card)).toBe(false)
    expect(tactics.faceCardToPass?.id).toBe(regularFace.id)
  })
})

describe('Fix B: Same2 logic is disabled on trump-led tricks', () => {
  const napoleon = player('nap', { isNapoleon: true })

  test('hasSame2Risk is false when the lead suit is the trump suit', () => {
    // All spades (trump) led — Same2 cannot happen, so it must not block specials.
    const currentTrick = trick([
      { card: card('s1', 'spades', '9', 9), playerId: 'p1' },
      { card: card('s2', 'spades', '8', 8), playerId: 'p2' },
    ])
    const gameState = baseGameState({
      players: [napoleon, player('p1'), player('p2'), player('p3')],
      currentTrick,
      leadingSuit: 'spades',
    })

    const strategy = evaluateSpecialCardStrategy(
      napoleon,
      [MIGHTY, card('low', 'spades', '3', 3)],
      currentTrick,
      gameState,
      () => ({ napoleonNeedsToWin: 1 })
    )

    expect(strategy.hasSame2Risk).toBe(false)
  })

  test('hasSame2Risk is still true on a non-trump all-same-suit lead', () => {
    const currentTrick = trick([
      { card: card('h1', 'hearts', '9', 9), playerId: 'p1' },
      { card: card('h2', 'hearts', '8', 8), playerId: 'p2' },
    ])
    const gameState = baseGameState({
      players: [napoleon, player('p1'), player('p2'), player('p3')],
      currentTrick,
      leadingSuit: 'hearts',
    })

    const strategy = evaluateSpecialCardStrategy(
      napoleon,
      [MIGHTY, card('low', 'hearts', '3', 3)],
      currentTrick,
      gameState,
      () => ({ napoleonNeedsToWin: 1 })
    )

    expect(strategy.hasSame2Risk).toBe(true)
  })

  test('evaluateSame2Breaker gives no penalty to Mighty on a trump-led trick', () => {
    const currentTrick = trick([
      { card: card('s1', 'spades', '9', 9), playerId: 'p1' },
      { card: card('s2', 'spades', '8', 8), playerId: 'p2' },
    ])
    const gameState = baseGameState({ currentTrick, leadingSuit: 'spades' })

    expect(evaluateSame2Breaker(MIGHTY, gameState)).toBe(0)
  })

  test('evaluateSame2Breaker still penalizes Mighty on a non-trump same-suit trick', () => {
    const currentTrick = trick([
      { card: card('h1', 'hearts', '9', 9), playerId: 'p1' },
      { card: card('h2', 'hearts', '8', 8), playerId: 'p2' },
    ])
    const gameState = baseGameState({ currentTrick, leadingSuit: 'hearts' })

    expect(evaluateSame2Breaker(MIGHTY, gameState)).toBeLessThan(0)
  })
})

describe('Fix C: preserve the non-trump "2" when discarding', () => {
  test('early game: discards another low card and keeps the non-trump 2', () => {
    const gameState = baseGameState({ tricks: [] }) // progress 0
    const two = card('d2', 'diamonds', '2', 2)
    const three = card('d3', 'diamonds', '3', 3)

    const chosen = getWeakestCardPreservingSame2([two, three], gameState)
    expect(chosen.id).toBe(three.id) // keeps the 2
  })

  test('discards the 2 when it is the only option', () => {
    const gameState = baseGameState({ tricks: [] })
    const two = card('d2', 'diamonds', '2', 2)

    expect(getWeakestCardPreservingSame2([two], gameState).id).toBe(two.id)
  })

  test('late game: no longer preserves the 2 (dead card)', () => {
    // 9 completed tricks => progress 0.75 (>= 0.7)
    const gameState = baseGameState({
      tricks: Array.from({ length: 9 }, (_, i) => ({
        id: `t${i}`,
        cards: [],
        completed: true,
      })),
    })
    const two = card('d2', 'diamonds', '2', 2)
    const three = card('d3', 'diamonds', '3', 3)

    expect(getWeakestCardPreservingSame2([two, three], gameState).id).toBe(
      two.id
    )
  })

  test('the trump "2" is not specially preserved (it cannot make Same2)', () => {
    const gameState = baseGameState({ tricks: [] }) // trump = spades
    const trumpTwo = card('s2', 'spades', '2', 2)
    const trumpThree = card('s3', 'spades', '3', 3)

    // Weakest spade is the 2; since it cannot form Same2, it is discarded normally.
    expect(
      getWeakestCardPreservingSame2([trumpTwo, trumpThree], gameState).id
    ).toBe(trumpTwo.id)
  })
})
