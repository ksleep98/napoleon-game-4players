/**
 * Unit tests for Card Sequencing Strategy
 * カード使用順序最適化戦略のテスト
 */

import type { CardCountingInfo } from '@/lib/ai/strategicCardEvaluator'
import {
  analyzeCardSequence,
  calculateSequencingBonus,
} from '@/lib/ai/strategies/cardSequencing'
import type { Card, GameState, Player, Trick } from '@/types/game'

// ========================================
// Test Helpers
// ========================================

function createMockPlayer(
  id: string,
  isNapoleon = false,
  isAdjutant = false
): Player {
  return {
    id,
    position: 0,
    name: `Player ${id}`,
    hand: [],
    isNapoleon,
    isAdjutant,
    isAI: false,
  }
}

function createMockCard(
  suit: Card['suit'],
  rank: Card['rank'],
  id?: string
): Card {
  const rankValues: Record<Card['rank'], number> = {
    A: 14,
    K: 13,
    Q: 12,
    J: 11,
    '10': 10,
    '9': 9,
    '8': 8,
    '7': 7,
    '6': 6,
    '5': 5,
    '4': 4,
    '3': 3,
    '2': 2,
  }
  return {
    id: id || `${suit}-${rank}`,
    suit,
    rank,
    value: rankValues[rank],
  }
}

function createMockGameState(
  tricks: Trick[] = [],
  trump?: Card['suit']
): GameState {
  return {
    id: 'test-game',
    currentPlayerIndex: 0,
    players: [
      createMockPlayer('player1', true),
      createMockPlayer('player2'),
      createMockPlayer('player3'),
      createMockPlayer('player4'),
    ],
    trumpSuit: trump,
    currentTrick: {
      id: 'current-trick',
      cards: [],
      leadingSuit: undefined,
      completed: false,
    },
    tricks,
    phase: 'playing',
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createMockCardCounting(
  totalRemainingCards = 40,
  totalRemainingFaceCards = 15
): CardCountingInfo {
  return {
    suitTracking: new Map(),
    totalPlayedCards: 52 - totalRemainingCards,
    totalRemainingCards,
    totalPlayedFaceCards: 20 - totalRemainingFaceCards,
    totalRemainingFaceCards,
  }
}

// ========================================
// analyzeCardSequence Tests
// ========================================

describe('analyzeCardSequence', () => {
  test('should analyze sequence strategy for early game', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('hearts', 'K'),
      createMockCard('spades', '10'),
      createMockCard('clubs', '7'),
      createMockCard('diamonds', '3'),
    ]
    const gameState = createMockGameState([], 'spades')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeCardSequence(hand, gameState, player, cardCounting)

    expect(result.recommendedSequence).toHaveLength(5)
    expect(result.criticalTricks).toBeDefined()
    expect(result.sacrificeTricks).toBeDefined()
    expect(result.optimalTiming).toBeDefined()
    expect(result.conservationPriority).toBeGreaterThan(0.5) // Early game = high conservation
    expect(result.confidence).toBeGreaterThan(0)
    expect(result.confidence).toBeLessThanOrEqual(1)
    expect(result.reasoning).toBeTruthy()
  })

  test('should handle single card in hand', () => {
    const hand: Card[] = [createMockCard('hearts', 'A')]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1')
    player.hand = hand
    const cardCounting = createMockCardCounting(4, 1)

    const result = analyzeCardSequence(hand, gameState, player, cardCounting)

    expect(result.recommendedSequence).toHaveLength(1)
    expect(result.optimalTiming.size).toBe(1)
  })

  test('should handle empty hand', () => {
    const hand: Card[] = []
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1')
    player.hand = hand
    const cardCounting = createMockCardCounting(0, 0)

    const result = analyzeCardSequence(hand, gameState, player, cardCounting)

    expect(result.recommendedSequence).toHaveLength(0)
    expect(result.optimalTiming.size).toBe(0)
    // Note: criticalTricks and sacrificeTricks may still be identified
    // based on remaining trick analysis, even without cards in hand
    expect(result.criticalTricks).toBeDefined()
    expect(result.sacrificeTricks).toBeDefined()
  })

  test('should allocate face cards to important tricks', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('hearts', 'K'),
      createMockCard('hearts', 'Q'),
      createMockCard('spades', '3'),
      createMockCard('clubs', '2'),
    ]
    const tricks: Trick[] = Array(7).fill({
      cards: [],
      winnerId: 'player1',
      trickNumber: 1,
    })
    const gameState = createMockGameState(tricks, 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(20, 10)

    const result = analyzeCardSequence(hand, gameState, player, cardCounting)

    // Face cards (A, K, Q) should be allocated to important/critical tricks
    const aceId = 'hearts-A'
    const kingId = 'hearts-K'
    const queenId = 'hearts-Q'

    expect(result.optimalTiming.has(aceId)).toBe(true)
    expect(result.optimalTiming.has(kingId)).toBe(true)
    expect(result.optimalTiming.has(queenId)).toBe(true)
  })

  test('should handle all face cards hand', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('hearts', 'K'),
      createMockCard('hearts', 'Q'),
      createMockCard('hearts', 'J'),
      createMockCard('spades', 'A'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeCardSequence(hand, gameState, player, cardCounting)

    expect(result.recommendedSequence).toHaveLength(5)
    // All cards should have optimal timing assigned
    expect(result.optimalTiming.size).toBe(5)
  })

  test('should handle all non-face cards hand', () => {
    const hand: Card[] = [
      createMockCard('hearts', '10'),
      createMockCard('hearts', '9'),
      createMockCard('hearts', '8'),
      createMockCard('spades', '7'),
      createMockCard('clubs', '6'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1')
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeCardSequence(hand, gameState, player, cardCounting)

    expect(result.recommendedSequence).toHaveLength(5)
    // Should still create a strategy even without face cards
    expect(result.sacrificeTricks.length).toBeGreaterThan(0)
  })
})

// ========================================
// calculateSequencingBonus Tests
// ========================================

describe('calculateSequencingBonus', () => {
  test('should give penalty for very poor timing', () => {
    const card = createMockCard('clubs', 'A')
    const currentTrickNumber = 2
    const gameState = createMockGameState([], 'clubs')
    const player = createMockPlayer('player1')

    const sequenceStrategy = analyzeCardSequence(
      [card],
      gameState,
      player,
      createMockCardCounting(40, 15)
    )
    sequenceStrategy.optimalTiming.set(card.id, 10) // Off by 8
    sequenceStrategy.confidence = 0.8

    const bonus = calculateSequencingBonus(
      card,
      currentTrickNumber,
      sequenceStrategy,
      gameState
    )

    expect(bonus).toBeLessThan(0) // Penalty
  })

  test('should return 0 for card not in optimal timing map', () => {
    const card = createMockCard('diamonds', '7')
    const currentTrickNumber = 5
    const gameState = createMockGameState([], 'diamonds')
    const player = createMockPlayer('player1')

    const sequenceStrategy = analyzeCardSequence(
      [],
      gameState,
      player,
      createMockCardCounting(20, 8)
    )
    // Don't add card to optimalTiming map

    const bonus = calculateSequencingBonus(
      card,
      currentTrickNumber,
      sequenceStrategy,
      gameState
    )

    expect(bonus).toBe(0)
  })
})
