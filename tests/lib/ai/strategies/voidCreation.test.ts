/**
 * Unit tests for Void Creation Strategy
 * ボイド作成戦略のテスト
 */

import type { CardCountingInfo } from '@/lib/ai/strategicCardEvaluator'
import {
  analyzeVoidCreation,
  calculateVoidCreationBonus,
  getVoidCreationSummary,
} from '@/lib/ai/strategies/voidCreation'
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
// analyzeVoidCreation Tests
// ========================================

describe('analyzeVoidCreation', () => {
  test('should identify existing voids', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('hearts', 'K'),
      createMockCard('spades', 'Q'),
      // No clubs or diamonds
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    expect(result.currentVoids).toContain('clubs')
    expect(result.currentVoids).toContain('diamonds')
    expect(result.currentVoids.length).toBe(2)
  })

  test('should identify near-void opportunities', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('hearts', 'K'),
      createMockCard('hearts', 'Q'),
      createMockCard('spades', '3'), // Only 1 spade = near void
      createMockCard('clubs', '2'), // Only 1 club = near void
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    expect(result.nearVoids).toContain('spades')
    expect(result.nearVoids).toContain('clubs')
    expect(result.nearVoids.length).toBeGreaterThanOrEqual(2)
  })

  test('should not consider trump suit as void candidate', () => {
    const hand: Card[] = [
      createMockCard('hearts', '3'), // Only 1 heart (trump)
      createMockCard('spades', 'A'),
      createMockCard('spades', 'K'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    // Trump suit should not be in nearVoids
    expect(result.nearVoids).not.toContain('hearts')
  })

  test('should suggest void creation when player has trump cards', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'), // Trump
      createMockCard('hearts', 'K'), // Trump
      createMockCard('spades', '3'), // Near void opportunity
      createMockCard('clubs', 'Q'),
      createMockCard('diamonds', 'J'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    expect(result.hasTrumpCards).toBe(true)
    expect(result.trumpCount).toBe(2)
    expect(result.shouldPursueVoid).toBe(true)
  })

  test('should not pursue void without trump cards', () => {
    const hand: Card[] = [
      createMockCard('spades', '3'),
      createMockCard('clubs', 'Q'),
      createMockCard('diamonds', 'J'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1')
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    expect(result.hasTrumpCards).toBe(false)
    expect(result.trumpCount).toBe(0)
    expect(result.shouldPursueVoid).toBe(false)
  })

  test('should prioritize weak suits for void creation', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'), // Trump, strong
      createMockCard('hearts', 'K'), // Trump, strong
      createMockCard('spades', '3'), // Weak, good void candidate
      createMockCard('clubs', 'A'), // Strong, bad void candidate
      createMockCard('diamonds', '5'), // Weak, good void candidate
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    // Should target weak suit (spades or diamonds), not strong suit (clubs)
    expect(result.voidCreationPlan.targetSuit).not.toBe('clubs')
    if (result.voidCreationPlan.targetSuit) {
      expect(['spades', 'diamonds']).toContain(
        result.voidCreationPlan.targetSuit
      )
    }
  })

  test('should increase aggressiveness for Napoleon team', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', '3'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const cardCounting = createMockCardCounting(40, 15)

    const napoleonPlayer = createMockPlayer('player1', true)
    napoleonPlayer.hand = hand
    const napoleonResult = analyzeVoidCreation(
      hand,
      gameState,
      napoleonPlayer,
      cardCounting
    )

    const alliancePlayer = createMockPlayer('player2', false)
    alliancePlayer.hand = hand
    const allianceResult = analyzeVoidCreation(
      hand,
      gameState,
      alliancePlayer,
      cardCounting
    )

    expect(napoleonResult.aggressiveness).toBeGreaterThan(
      allianceResult.aggressiveness
    )
  })

  test('should handle empty hand', () => {
    const hand: Card[] = []
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1')
    player.hand = hand
    const cardCounting = createMockCardCounting(0, 0)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    expect(result.currentVoids.length).toBe(4) // All suits are void
    expect(result.nearVoids.length).toBe(0)
    expect(result.shouldPursueVoid).toBe(false)
  })

  test('should handle all suits present in hand', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', 'K'),
      createMockCard('clubs', 'Q'),
      createMockCard('diamonds', 'J'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    expect(result.currentVoids.length).toBe(0)
    expect(result.nearVoids.length).toBeGreaterThan(0) // At least some near-voids
  })

  test('should increase confidence in endgame', () => {
    const tricks: Trick[] = Array(9).fill({
      id: 'trick-1',
      cards: [],
      completed: true,
    })
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', '3'),
    ]
    const gameState = createMockGameState(tricks, 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(12, 5)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    expect(result.confidence).toBeGreaterThan(0.6) // Higher confidence in endgame
  })

  test('should plan void creation with proper card ordering', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'), // Trump
      createMockCard('hearts', 'K'), // Trump
      createMockCard('spades', '7'),
      createMockCard('spades', '3'),
      createMockCard('spades', '5'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const result = analyzeVoidCreation(hand, gameState, player, cardCounting)

    if (result.voidCreationPlan.targetSuit === 'spades') {
      // Cards should be ordered from weakest to strongest
      const cards = result.voidCreationPlan.cardsToPlay
      expect(cards.length).toBe(3)
      // First card should be weaker than last card
      expect(cards[0].value).toBeLessThanOrEqual(cards[cards.length - 1].value)
    }
  })
})

// ========================================
// calculateVoidCreationBonus Tests
// ========================================

describe('calculateVoidCreationBonus', () => {
  test('should give high bonus for weak card in target suit', () => {
    const card = createMockCard('spades', '3')
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)

    const hand: Card[] = [createMockCard('hearts', 'A'), card]
    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      createMockCardCounting(40, 15)
    )
    // Force target suit to spades
    voidStrategy.voidCreationPlan.targetSuit = 'spades'
    voidStrategy.voidCreationPlan.priority = 80
    voidStrategy.shouldPursueVoid = true
    voidStrategy.confidence = 0.9

    const bonus = calculateVoidCreationBonus(card, voidStrategy, gameState)

    expect(bonus).toBeGreaterThan(50) // High bonus for weak card in target suit
  })

  test('should give low bonus for face card in target suit', () => {
    const card = createMockCard('spades', 'K')
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)

    const hand: Card[] = [createMockCard('hearts', 'A'), card]
    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      createMockCardCounting(40, 15)
    )
    voidStrategy.voidCreationPlan.targetSuit = 'spades'
    voidStrategy.voidCreationPlan.priority = 80
    voidStrategy.shouldPursueVoid = true
    voidStrategy.confidence = 0.9

    const bonus = calculateVoidCreationBonus(card, voidStrategy, gameState)

    expect(bonus).toBeLessThan(50) // Lower bonus for face card in target suit
  })

  test('should give penalty for non-target suit card when priority is high', () => {
    const card = createMockCard('clubs', 'Q')
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)

    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', '3'),
      card,
    ]
    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      createMockCardCounting(40, 15)
    )
    voidStrategy.voidCreationPlan.targetSuit = 'spades'
    voidStrategy.voidCreationPlan.priority = 80
    voidStrategy.shouldPursueVoid = true
    voidStrategy.confidence = 0.8

    const bonus = calculateVoidCreationBonus(card, voidStrategy, gameState)

    expect(bonus).toBeLessThan(0) // Penalty for playing wrong suit
  })

  test('should return 0 when not pursuing void', () => {
    const card = createMockCard('spades', '3')
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1')

    const hand: Card[] = [card]
    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      createMockCardCounting(40, 15)
    )
    voidStrategy.shouldPursueVoid = false

    const bonus = calculateVoidCreationBonus(card, voidStrategy, gameState)

    expect(bonus).toBe(0)
  })

  test('should return 0 when no target suit', () => {
    const card = createMockCard('spades', '3')
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1')

    const hand: Card[] = [card]
    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      createMockCardCounting(40, 15)
    )
    voidStrategy.voidCreationPlan.targetSuit = null

    const bonus = calculateVoidCreationBonus(card, voidStrategy, gameState)

    expect(bonus).toBe(0)
  })

  test('should scale bonus by confidence', () => {
    const card = createMockCard('spades', '3')
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)

    const hand: Card[] = [createMockCard('hearts', 'A'), card]

    const highConfidenceStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      createMockCardCounting(12, 5) // Endgame = high confidence
    )
    highConfidenceStrategy.voidCreationPlan.targetSuit = 'spades'
    highConfidenceStrategy.voidCreationPlan.priority = 80
    highConfidenceStrategy.shouldPursueVoid = true

    const lowConfidenceStrategy = { ...highConfidenceStrategy }
    lowConfidenceStrategy.confidence = 0.3

    const highBonus = calculateVoidCreationBonus(
      card,
      highConfidenceStrategy,
      gameState
    )
    const lowBonus = calculateVoidCreationBonus(
      card,
      lowConfidenceStrategy,
      gameState
    )

    expect(highBonus).toBeGreaterThan(lowBonus)
  })
})

// ========================================
// getVoidCreationSummary Tests
// ========================================

describe('getVoidCreationSummary', () => {
  test('should generate summary with all components', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', '3'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      cardCounting
    )
    const summary = getVoidCreationSummary(voidStrategy)

    expect(summary).toContain('Voids:')
    expect(summary).toContain('Near-voids:')
    expect(summary).toContain('Trump:')
    expect(summary).toContain('Aggr:')
    expect(summary).toContain('%')
    expect(summary).toContain('|')
  })

  test('should show target suit when void plan exists', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', '3'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      cardCounting
    )

    if (voidStrategy.voidCreationPlan.targetSuit) {
      const summary = getVoidCreationSummary(voidStrategy)
      expect(summary).toContain('Target:')
      expect(summary).toContain('Priority:')
    }
  })

  test('should show no void plan when not pursuing', () => {
    const hand: Card[] = [createMockCard('spades', '3')]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1')
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      cardCounting
    )
    const summary = getVoidCreationSummary(voidStrategy)

    if (!voidStrategy.voidCreationPlan.targetSuit) {
      expect(summary).toContain('No void plan')
    }
  })

  test('should show trump status correctly', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', '3'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(40, 15)

    const voidStrategy = analyzeVoidCreation(
      hand,
      gameState,
      player,
      cardCounting
    )
    const summary = getVoidCreationSummary(voidStrategy)

    expect(summary).toContain('Trump: Yes')
  })
})
