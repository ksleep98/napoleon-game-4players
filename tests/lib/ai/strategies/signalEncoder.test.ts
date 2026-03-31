/**
 * Signal encoder unit tests
 * シグナルエンコーダーのテスト
 */

import {
  encodeSignal,
  selectSignalCard,
  shouldSendSignal,
} from '@/lib/ai/strategies/signalEncoder'
import type { SignalHistory } from '@/lib/ai/strategies/types'
import type { Card, GameState, Player, Rank, Suit, Trick } from '@/types/game'

// テスト用のヘルパー関数
function getRankValue(rank: Rank): number {
  const rankValues: Record<Rank, number> = {
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
  return rankValues[rank] || 0
}

function createMockCard(
  id: string,
  suit: Suit,
  rank: Rank,
  _strength = 500
): Card {
  return { id, suit, rank, value: getRankValue(rank) }
}

function createMockPlayer(
  id: string,
  hand: Card[],
  isNapoleon = false,
  isAdjutant = false
): Player {
  return {
    id,
    name: `Player ${id}`,
    hand,
    isNapoleon,
    isAdjutant,
    position: 1,
    isAI: false,
  }
}

function createMockGameState(
  tricks: Trick[] = [],
  trumpSuit: Suit = 'spades'
): GameState {
  return {
    id: 'test-game',
    players: [],
    tricks,
    currentTrick: {
      id: 'current-trick',
      cards: [],
      leadingSuit: undefined,
      winnerPlayerId: undefined,
      completed: false,
    },
    trumpSuit,
    napoleonDeclaration: undefined,
    phase: 'playing',
    currentPlayerIndex: 0,
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    leadingSuit: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function createMockSignalHistory(): SignalHistory {
  return {
    sentSignals: [],
    receivedSignals: [],
    partnerPlayPatterns: [],
  }
}

describe('encodeSignal', () => {
  let mockPlayer: Player
  let mockGameState: GameState
  let mockTrick: Trick
  let playableCards: Card[]

  beforeEach(() => {
    playableCards = [
      createMockCard('1', 'hearts', 'A'),
      createMockCard('2', 'hearts', 'K'),
      createMockCard('3', 'hearts', 'Q'),
      createMockCard('4', 'spades', '10'),
    ]

    mockPlayer = createMockPlayer('player1', playableCards)
    mockGameState = createMockGameState([], 'spades')
    mockTrick = {
      id: 'test-trick',
      cards: [
        {
          playerId: 'player2',
          card: createMockCard('5', 'hearts', '7'),
          order: 0,
        },
      ],
      leadingSuit: 'hearts',
      winnerPlayerId: undefined,
      completed: false,
    }
  })

  describe('SUIT_STRENGTH signal', () => {
    it('should encode SUIT_STRENGTH signal with correct suit', () => {
      const card = playableCards[0] // Hearts A
      const signal = encodeSignal(
        card,
        playableCards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'SUIT_STRENGTH'
      )

      expect(signal).not.toBeNull()
      expect(signal?.type).toBe('SUIT_STRENGTH')
      expect(signal?.suit).toBe('hearts')
      expect(signal?.playerId).toBe('player1')
      expect(signal?.confidence).toBeGreaterThan(0)
    })

    it('should return STRONG strength for powerful cards', () => {
      // Create a wider range of card strengths to test STRONG signal
      const mixedCards = [
        createMockCard('1', 'hearts', 'A'), // 14 (strongest)
        createMockCard('2', 'hearts', '7'), // 7
        createMockCard('3', 'hearts', '3'), // 3 (weakest)
        createMockCard('4', 'spades', '10'), // 10
      ]

      const card = mixedCards[0] // Hearts A
      const signal = encodeSignal(
        card,
        mixedCards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'SUIT_STRENGTH'
      )

      expect(signal?.strength).toBe('STRONG')
      expect(signal?.confidence).toBeGreaterThanOrEqual(0.6)
    })

    it('should return WEAK strength for weaker cards', () => {
      const weakCard = createMockCard('weak', 'hearts', '2')
      const cards = [...playableCards, weakCard]

      const signal = encodeSignal(
        weakCard,
        cards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'SUIT_STRENGTH'
      )

      expect(signal?.strength).toBe('WEAK')
    })
  })

  describe('VOID_SUIT signal', () => {
    it('should encode VOID_SUIT signal when playing trump on non-trump lead', () => {
      const trumpCard = playableCards[3] // Spades 10 (trump)
      mockTrick.leadingSuit = 'hearts' // Leading suit is not trump

      const signal = encodeSignal(
        trumpCard,
        playableCards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'VOID_SUIT'
      )

      expect(signal).not.toBeNull()
      expect(signal?.type).toBe('VOID_SUIT')
      expect(signal?.strength).toBe('STRONG')
      expect(signal?.suit).toBe('hearts') // Void in leading suit
      expect(signal?.confidence).toBe(0.9)
    })

    it('should return null when not playing trump', () => {
      const nonTrumpCard = playableCards[0] // Hearts A

      const signal = encodeSignal(
        nonTrumpCard,
        playableCards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'VOID_SUIT'
      )

      expect(signal).toBeNull()
    })
  })

  describe('TRUMP_STRENGTH signal', () => {
    it('should encode TRUMP_STRENGTH signal for trump cards', () => {
      const trumpCard = createMockCard('trump-a', 'spades', 'A')
      const cards = [...playableCards, trumpCard]

      const signal = encodeSignal(
        trumpCard,
        cards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'TRUMP_STRENGTH'
      )

      expect(signal).not.toBeNull()
      expect(signal?.type).toBe('TRUMP_STRENGTH')
      expect(signal?.confidence).toBeGreaterThan(0)
    })
  })

  describe('FACE_CARD_COUNT signal', () => {
    it('should encode FACE_CARD_COUNT signal based on hand composition', () => {
      const card = playableCards[0]
      const signal = encodeSignal(
        card,
        playableCards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'FACE_CARD_COUNT'
      )

      expect(signal).not.toBeNull()
      expect(signal?.type).toBe('FACE_CARD_COUNT')
    })

    it('should return STRONG for many face cards', () => {
      const manyFaceCards = [
        createMockCard('1', 'hearts', 'A'),
        createMockCard('2', 'hearts', 'K'),
        createMockCard('3', 'hearts', 'Q'),
        createMockCard('4', 'hearts', 'J'),
        createMockCard('5', 'hearts', '10'),
        createMockCard('6', 'diamonds', 'A'),
      ]
      const playerWithManyFaceCards = createMockPlayer('player1', manyFaceCards)

      const signal = encodeSignal(
        manyFaceCards[0],
        manyFaceCards,
        mockTrick,
        mockGameState,
        playerWithManyFaceCards,
        'FACE_CARD_COUNT'
      )

      expect(signal?.strength).toBe('STRONG')
    })
  })

  describe('Strategic signals', () => {
    it('should encode CAN_WIN signal', () => {
      const strongCard = playableCards[0]
      const signal = encodeSignal(
        strongCard,
        playableCards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'CAN_WIN'
      )

      expect(signal).not.toBeNull()
      expect(signal?.type).toBe('CAN_WIN')
    })

    it('should encode NEED_HELP signal', () => {
      const weakCard = createMockCard('weak', 'hearts', '2')
      const cards = [weakCard, ...playableCards]

      const signal = encodeSignal(
        weakCard,
        cards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'NEED_HELP'
      )

      expect(signal).not.toBeNull()
      expect(signal?.type).toBe('NEED_HELP')
    })

    it('should encode BLOCK_NAPOLEON signal', () => {
      const card = playableCards[0]
      const signal = encodeSignal(
        card,
        playableCards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'BLOCK_NAPOLEON'
      )

      expect(signal).not.toBeNull()
      expect(signal?.type).toBe('BLOCK_NAPOLEON')
      expect(signal?.strength).toBe('MODERATE')
    })

    it('should encode SUPPORT_NAPOLEON signal', () => {
      const card = playableCards[0]
      const signal = encodeSignal(
        card,
        playableCards,
        mockTrick,
        mockGameState,
        mockPlayer,
        'SUPPORT_NAPOLEON'
      )

      expect(signal).not.toBeNull()
      expect(signal?.type).toBe('SUPPORT_NAPOLEON')
    })
  })
})

describe('shouldSendSignal', () => {
  let mockPlayer: Player
  let mockGameState: GameState
  let mockTrick: Trick
  let signalHistory: SignalHistory
  let playableCards: Card[]

  beforeEach(() => {
    playableCards = [
      createMockCard('1', 'hearts', 'A'),
      createMockCard('2', 'hearts', 'K'),
      createMockCard('3', 'spades', 'Q'),
    ]

    mockPlayer = createMockPlayer('player1', playableCards)
    mockGameState = createMockGameState([], 'spades')
    mockTrick = {
      id: 'test-trick',
      cards: [
        {
          playerId: 'player2',
          card: createMockCard('4', 'hearts', '7'),
          order: 0,
        },
      ],
      leadingSuit: 'hearts',
      winnerPlayerId: undefined,
      completed: false,
    }
    signalHistory = createMockSignalHistory()
  })

  it('should return false in early game (first 2 tricks)', () => {
    mockGameState.tricks = [] // Trick 0

    const result = shouldSendSignal(
      playableCards,
      mockTrick,
      mockGameState,
      mockPlayer,
      signalHistory
    )

    expect(result).toBe(false)
  })

  it('should return false when leading (no cards in trick)', () => {
    mockGameState.tricks = Array(3).fill({}) // Trick 3
    mockTrick.cards = [] // Leading

    const result = shouldSendSignal(
      playableCards,
      mockTrick,
      mockGameState,
      mockPlayer,
      signalHistory
    )

    expect(result).toBe(false)
  })

  it('should return false in endgame (last 2 tricks)', () => {
    mockGameState.tricks = Array(10).fill({}) // Trick 10 (2 remaining)

    const result = shouldSendSignal(
      playableCards,
      mockTrick,
      mockGameState,
      mockPlayer,
      signalHistory
    )

    expect(result).toBe(false)
  })

  it('should return false if recently sent multiple signals', () => {
    mockGameState.tricks = Array(5).fill({}) // Trick 5 (mid-game)

    // Add recent signals
    signalHistory.sentSignals = [
      {
        type: 'SUIT_STRENGTH',
        strength: 'STRONG',
        trickNumber: 4,
        playerId: 'player1',
        confidence: 0.8,
      },
      {
        type: 'CAN_WIN',
        strength: 'MODERATE',
        trickNumber: 5,
        playerId: 'player1',
        confidence: 0.7,
      },
    ]

    const result = shouldSendSignal(
      playableCards,
      mockTrick,
      mockGameState,
      mockPlayer,
      signalHistory
    )

    expect(result).toBe(false)
  })

  it('should return true in mid-game with sufficient choices', () => {
    mockGameState.tricks = Array(5).fill({}) // Trick 5 (mid-game 42%)

    const result = shouldSendSignal(
      playableCards,
      mockTrick,
      mockGameState,
      mockPlayer,
      signalHistory
    )

    expect(result).toBe(true)
  })

  it('should return false with only 1 playable card', () => {
    mockGameState.tricks = Array(5).fill({})
    const oneCard = [playableCards[0]]

    const result = shouldSendSignal(
      oneCard,
      mockTrick,
      mockGameState,
      mockPlayer,
      signalHistory
    )

    expect(result).toBe(false)
  })
})

describe('selectSignalCard', () => {
  let mockGameState: GameState
  let mockTrick: Trick
  let playableCards: Card[]

  beforeEach(() => {
    playableCards = [
      createMockCard('1', 'hearts', 'A'), // Strongest
      createMockCard('2', 'hearts', 'K'),
      createMockCard('3', 'hearts', 'Q'),
      createMockCard('4', 'hearts', '7'), // Weakest hearts
      createMockCard('5', 'spades', 'A'), // Trump
    ]

    mockGameState = createMockGameState([], 'spades')
    mockTrick = {
      id: 'test-trick',
      cards: [],
      leadingSuit: undefined,
      winnerPlayerId: undefined,
      completed: false,
    }
  })

  it('should return null for empty playable cards', () => {
    const signal = {
      type: 'SUIT_STRENGTH' as const,
      strength: 'STRONG' as const,
      suit: 'hearts' as Suit,
      trickNumber: 1,
      playerId: 'player1',
      confidence: 0.8,
    }

    const result = selectSignalCard([], signal, mockTrick, mockGameState)

    expect(result).toBeNull()
  })

  it('should return the only card if only one available', () => {
    const signal = {
      type: 'SUIT_STRENGTH' as const,
      strength: 'STRONG' as const,
      suit: 'hearts' as Suit,
      trickNumber: 1,
      playerId: 'player1',
      confidence: 0.8,
    }

    const result = selectSignalCard(
      [playableCards[0]],
      signal,
      mockTrick,
      mockGameState
    )

    expect(result).toBe(playableCards[0])
  })

  describe('SUIT_STRENGTH signal', () => {
    it('should select strongest card for STRONG signal', () => {
      const signal = {
        type: 'SUIT_STRENGTH' as const,
        strength: 'STRONG' as const,
        suit: 'hearts' as Suit,
        trickNumber: 1,
        playerId: 'player1',
        confidence: 0.8,
      }

      const result = selectSignalCard(
        playableCards,
        signal,
        mockTrick,
        mockGameState
      )

      expect(result?.rank).toBe('A') // Strongest hearts
    })

    it('should select middle card for MODERATE signal', () => {
      const signal = {
        type: 'SUIT_STRENGTH' as const,
        strength: 'MODERATE' as const,
        suit: 'hearts' as Suit,
        trickNumber: 1,
        playerId: 'player1',
        confidence: 0.6,
      }

      const result = selectSignalCard(
        playableCards,
        signal,
        mockTrick,
        mockGameState
      )

      expect(result?.suit).toBe('hearts')
      expect(['K', 'Q']).toContain(result?.rank) // Middle strength
    })

    it('should select weakest card for WEAK signal', () => {
      const signal = {
        type: 'SUIT_STRENGTH' as const,
        strength: 'WEAK' as const,
        suit: 'hearts' as Suit,
        trickNumber: 1,
        playerId: 'player1',
        confidence: 0.5,
      }

      const result = selectSignalCard(
        playableCards,
        signal,
        mockTrick,
        mockGameState
      )

      expect(result?.rank).toBe('7') // Weakest hearts
    })

    it('should return null for suit not in playable cards', () => {
      const signal = {
        type: 'SUIT_STRENGTH' as const,
        strength: 'STRONG' as const,
        suit: 'diamonds' as Suit,
        trickNumber: 1,
        playerId: 'player1',
        confidence: 0.8,
      }

      const result = selectSignalCard(
        playableCards,
        signal,
        mockTrick,
        mockGameState
      )

      expect(result).toBeNull()
    })
  })

  describe('TRUMP_STRENGTH signal', () => {
    it('should select trump card for STRONG signal', () => {
      const signal = {
        type: 'TRUMP_STRENGTH' as const,
        strength: 'STRONG' as const,
        trickNumber: 1,
        playerId: 'player1',
        confidence: 0.8,
      }

      const result = selectSignalCard(
        playableCards,
        signal,
        mockTrick,
        mockGameState
      )

      expect(result?.suit).toBe('spades') // Trump suit
      expect(result?.rank).toBe('A')
    })
  })

  describe('CAN_WIN signal', () => {
    it('should select strongest card for CAN_WIN signal', () => {
      const signal = {
        type: 'CAN_WIN' as const,
        strength: 'STRONG' as const,
        trickNumber: 1,
        playerId: 'player1',
        confidence: 0.9,
      }

      const result = selectSignalCard(
        playableCards,
        signal,
        mockTrick,
        mockGameState
      )

      expect(result).not.toBeNull()
      // Should be one of the strongest cards
      expect(['A']).toContain(result?.rank)
    })
  })

  describe('NEED_HELP signal', () => {
    it('should select weakest card for NEED_HELP signal', () => {
      const signal = {
        type: 'NEED_HELP' as const,
        strength: 'STRONG' as const,
        trickNumber: 1,
        playerId: 'player1',
        confidence: 0.8,
      }

      const result = selectSignalCard(
        playableCards,
        signal,
        mockTrick,
        mockGameState
      )

      expect(result).not.toBeNull()
      // Should be one of the weaker cards
      expect(result?.rank).toBe('7')
    })
  })
})
