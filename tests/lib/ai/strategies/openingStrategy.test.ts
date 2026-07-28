/**
 * Unit tests for Opening Strategy
 * 序盤戦略最適化のテスト
 */

import type { CardCountingInfo } from '@/lib/ai/strategicCardEvaluator'
import {
  analyzeOpeningPhase,
  analyzeOpeningStrategy,
  calculateOpeningBonus,
  determineCardType,
} from '@/lib/ai/strategies/openingStrategy'
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
// analyzeOpeningPhase Tests
// ========================================

describe('analyzeOpeningPhase', () => {
  test('should identify trick 1 as early probe phase', () => {
    const gameState = createMockGameState([], 'hearts') // Trick 1
    const phaseInfo = analyzeOpeningPhase(gameState)

    expect(phaseInfo.isOpeningPhase).toBe(true)
    expect(phaseInfo.currentTrick).toBe(1)
    expect(phaseInfo.phase).toBe('early_probe')
    expect(phaseInfo.tricksIntoOpening).toBe(1)
    expect(phaseInfo.remainingOpeningTricks).toBe(4)
  })

  test('should identify trick 3 as mid-opening phase', () => {
    const tricks = Array(2).fill({ id: 'trick-1', cards: [], completed: true })
    const gameState = createMockGameState(tricks, 'hearts')
    const phaseInfo = analyzeOpeningPhase(gameState)

    expect(phaseInfo.isOpeningPhase).toBe(true)
    expect(phaseInfo.currentTrick).toBe(3)
    expect(phaseInfo.phase).toBe('mid_opening')
  })

  test('should identify trick 5 as late opening phase', () => {
    const tricks = Array(4).fill({ id: 'trick-1', cards: [], completed: true })
    const gameState = createMockGameState(tricks, 'hearts')
    const phaseInfo = analyzeOpeningPhase(gameState)

    expect(phaseInfo.isOpeningPhase).toBe(false)
    expect(phaseInfo.currentTrick).toBe(5)
    expect(phaseInfo.phase).toBe('late_opening')
  })

  test('should identify trick 6+ as post-opening phase', () => {
    const tricks = Array(5).fill({ id: 'trick-1', cards: [], completed: true })
    const gameState = createMockGameState(tricks, 'hearts')
    const phaseInfo = analyzeOpeningPhase(gameState)

    expect(phaseInfo.isOpeningPhase).toBe(false)
    expect(phaseInfo.currentTrick).toBe(6)
    expect(phaseInfo.phase).toBe('post_opening')
  })
})

// ========================================
// analyzeOpeningStrategy Tests
// ========================================

describe('analyzeOpeningStrategy', () => {
  test('should recommend probing in early game', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', '3'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(52, 20)

    const result = analyzeOpeningStrategy(hand, gameState, player, cardCounting)

    expect(result.phaseInfo.isOpeningPhase).toBe(true)
    expect(result.shouldProbe).toBe(true)
    expect(result.informationGathering).toBe(true)
    expect(result.conservationPriority).toBeGreaterThan(0.7)
  })

  test('should recommend weak non-face cards for early probe', () => {
    const hand: Card[] = [
      createMockCard('hearts', 'A'),
      createMockCard('spades', '3'),
    ]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand
    const cardCounting = createMockCardCounting(52, 20)

    const result = analyzeOpeningStrategy(hand, gameState, player, cardCounting)

    expect(result.recommendedCardTypes).toContain('weak_non_face')
  })

  test('should adjust strategy for Napoleon team vs Alliance', () => {
    const hand: Card[] = [createMockCard('hearts', 'A')]
    const gameState = createMockGameState([], 'hearts')
    const cardCounting = createMockCardCounting(52, 20)

    const napoleonPlayer = createMockPlayer('player1', true)
    napoleonPlayer.hand = hand
    const napoleonResult = analyzeOpeningStrategy(
      hand,
      gameState,
      napoleonPlayer,
      cardCounting
    )

    const alliancePlayer = createMockPlayer('player2', false)
    alliancePlayer.hand = hand
    const allianceResult = analyzeOpeningStrategy(
      hand,
      gameState,
      alliancePlayer,
      cardCounting
    )

    expect(napoleonResult.riskTolerance).toBeGreaterThan(
      allianceResult.riskTolerance
    )
    expect(napoleonResult.conservationPriority).toBeLessThan(
      allianceResult.conservationPriority
    )
  })

  test('should return default strategy for post-opening', () => {
    const tricks = Array(5).fill({ id: 'trick-1', cards: [], completed: true })
    const hand: Card[] = [createMockCard('hearts', 'A')]
    const gameState = createMockGameState(tricks, 'hearts')
    const player = createMockPlayer('player1')
    player.hand = hand
    const cardCounting = createMockCardCounting(28, 10)

    const result = analyzeOpeningStrategy(hand, gameState, player, cardCounting)

    expect(result.phaseInfo.isOpeningPhase).toBe(false)
    expect(result.shouldProbe).toBe(false)
    expect(result.confidence).toBe(1.0)
  })
})

// ========================================
// determineCardType Tests
// ========================================

describe('determineCardType', () => {
  test('should identify trump cards', () => {
    const card = createMockCard('hearts', 'A')
    const gameState = createMockGameState([], 'hearts')
    const hand: Card[] = [card]

    const cardType = determineCardType(card, gameState, hand)

    expect(cardType).toBe('trump')
  })

  test('should identify strong face cards', () => {
    const cardA = createMockCard('spades', 'A')
    const cardK = createMockCard('spades', 'K')
    const gameState = createMockGameState([], 'hearts')
    const hand: Card[] = [cardA, cardK]

    expect(determineCardType(cardA, gameState, hand)).toBe('strong_face')
    expect(determineCardType(cardK, gameState, hand)).toBe('strong_face')
  })

  test('should identify weak face cards', () => {
    const cardQ = createMockCard('spades', 'Q')
    const cardJ = createMockCard('spades', 'J')
    const gameState = createMockGameState([], 'hearts')
    const hand: Card[] = [cardQ, cardJ]

    expect(determineCardType(cardQ, gameState, hand)).toBe('weak_face')
    expect(determineCardType(cardJ, gameState, hand)).toBe('weak_face')
  })

  test('should identify mid non-face cards', () => {
    const card10 = createMockCard('spades', '10')
    const card9 = createMockCard('spades', '9')
    const gameState = createMockGameState([], 'hearts')
    const hand: Card[] = [card10, card9]

    expect(determineCardType(card10, gameState, hand)).toBe('mid_non_face')
    expect(determineCardType(card9, gameState, hand)).toBe('mid_non_face')
  })

  test('should identify weak non-face cards', () => {
    const card3 = createMockCard('spades', '3')
    const card2 = createMockCard('spades', '2')
    const gameState = createMockGameState([], 'hearts')
    const hand: Card[] = [card3, card2]

    expect(determineCardType(card3, gameState, hand)).toBe('weak_non_face')
    expect(determineCardType(card2, gameState, hand)).toBe('weak_non_face')
  })
})

// ========================================
// calculateOpeningBonus Tests
// ========================================

describe('calculateOpeningBonus', () => {
  test('should give penalty for strong face cards in opening', () => {
    const card = createMockCard('spades', 'A')
    const hand: Card[] = [card, createMockCard('hearts', '3')]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand

    const openingStrategy = analyzeOpeningStrategy(
      hand,
      gameState,
      player,
      createMockCardCounting(52, 20)
    )

    const bonus = calculateOpeningBonus(card, openingStrategy, gameState, hand)

    expect(bonus).toBeLessThan(0) // Penalty for strong face card
  })

  test('should give penalty for trump cards in opening', () => {
    const card = createMockCard('hearts', 'A')
    const hand: Card[] = [card, createMockCard('spades', '3')]
    const gameState = createMockGameState([], 'hearts')
    const player = createMockPlayer('player1', true)
    player.hand = hand

    const openingStrategy = analyzeOpeningStrategy(
      hand,
      gameState,
      player,
      createMockCardCounting(52, 20)
    )

    const bonus = calculateOpeningBonus(card, openingStrategy, gameState, hand)

    expect(bonus).toBeLessThan(0) // Penalty for trump card
  })

  test('should return 0 for post-opening phase', () => {
    const card = createMockCard('spades', '3')
    const hand: Card[] = [card]
    const tricks = Array(5).fill({ id: 'trick-1', cards: [], completed: true })
    const gameState = createMockGameState(tricks, 'hearts')
    const player = createMockPlayer('player1')
    player.hand = hand

    const openingStrategy = analyzeOpeningStrategy(
      hand,
      gameState,
      player,
      createMockCardCounting(28, 10)
    )

    const bonus = calculateOpeningBonus(card, openingStrategy, gameState, hand)

    expect(bonus).toBe(0)
  })
})
