/**
 * Signal decoder unit tests
 * シグナルデコーダーのテスト
 */

import {
  analyzePlayPattern,
  buildSignalHistory,
  decodePartnerPlay,
  extractPartnerSignals,
} from '@/lib/ai/strategies/signalDecoder'
import type { CardCountingInfo, SuitTracking } from '@/lib/ai/strategies/types'
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
  trumpSuit: Suit = 'spades',
  players: Player[] = []
): GameState {
  return {
    id: 'test-game',
    players,
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

function createMockCardCounting(): CardCountingInfo {
  const suitTracking = new Map<Suit, SuitTracking>()

  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  for (const suit of suits) {
    suitTracking.set(suit, {
      suit,
      playedCards: [],
      remainingCards: 13,
      playedFaceCards: [],
      remainingFaceCards: 4,
      myCards: [],
      myFaceCards: [],
      hasHighCards: false,
    })
  }

  return {
    suitTracking,
    totalPlayedCards: 0,
    totalRemainingCards: 52,
    totalPlayedFaceCards: 0,
    totalRemainingFaceCards: 16,
  }
}

describe('decodePartnerPlay', () => {
  let mockGameState: GameState
  let mockTrick: Trick
  let cardCounting: CardCountingInfo

  beforeEach(() => {
    mockGameState = createMockGameState([], 'spades')
    cardCounting = createMockCardCounting()
  })

  describe('SUIT_STRENGTH signal decoding', () => {
    it('should decode STRONG suit strength from high card', () => {
      const partnerCard = createMockCard('1', 'hearts', 'A')
      // Use a wider range to make Ace clearly stronger (14 vs avg ~8)
      const playableCards = [
        partnerCard,
        createMockCard('2', 'hearts', '7'),
        createMockCard('3', 'hearts', '3'),
      ]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card: partnerCard, order: 0 }],
        leadingSuit: 'hearts',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        partnerCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      const suitStrengthSignal = signals.find((s) => s.type === 'SUIT_STRENGTH')
      expect(suitStrengthSignal).toBeDefined()
      expect(suitStrengthSignal?.strength).toBe('STRONG')
      expect(suitStrengthSignal?.suit).toBe('hearts')
    })

    it('should decode WEAK suit strength from low card', () => {
      const partnerCard = createMockCard('1', 'hearts', '2')
      const playableCards = [
        createMockCard('2', 'hearts', 'A'),
        createMockCard('3', 'hearts', 'K'),
        partnerCard,
      ]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card: partnerCard, order: 0 }],
        leadingSuit: 'hearts',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        partnerCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      const suitStrengthSignal = signals.find((s) => s.type === 'SUIT_STRENGTH')
      expect(suitStrengthSignal).toBeDefined()
      expect(suitStrengthSignal?.strength).toBe('WEAK')
    })

    it('should not decode suit strength with only one card in suit', () => {
      const partnerCard = createMockCard('1', 'hearts', 'A')
      const playableCards = [partnerCard, createMockCard('2', 'spades', 'K')]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card: partnerCard, order: 0 }],
        leadingSuit: 'hearts',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        partnerCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      const suitStrengthSignal = signals.find((s) => s.type === 'SUIT_STRENGTH')
      expect(suitStrengthSignal).toBeUndefined()
    })
  })

  describe('VOID_SUIT signal decoding', () => {
    it('should decode void signal when trump is played on non-trump lead', () => {
      const trumpCard = createMockCard('1', 'spades', 'Q') // Trump
      const playableCards = [trumpCard, createMockCard('2', 'spades', '7')]

      mockTrick = {
        id: 'trick-1',
        cards: [
          {
            playerId: 'other',
            card: createMockCard('3', 'hearts', 'K'),
            order: 0,
          },
          { playerId: 'partner', card: trumpCard, order: 1 },
        ],
        leadingSuit: 'hearts',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        trumpCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      const voidSignal = signals.find((s) => s.type === 'VOID_SUIT')
      expect(voidSignal).toBeDefined()
      expect(voidSignal?.strength).toBe('STRONG')
      expect(voidSignal?.suit).toBe('hearts')
      expect(voidSignal?.confidence).toBe(0.9)
    })

    it('should not decode void signal when trump is led', () => {
      const trumpCard = createMockCard('1', 'spades', 'Q')
      const playableCards = [trumpCard, createMockCard('2', 'spades', '7')]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card: trumpCard, order: 0 }],
        leadingSuit: 'spades',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        trumpCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      const voidSignal = signals.find((s) => s.type === 'VOID_SUIT')
      expect(voidSignal).toBeUndefined()
    })
  })

  describe('CAN_WIN / NEED_HELP signal decoding', () => {
    it('should decode CAN_WIN signal from strongest card', () => {
      const strongCard = createMockCard('1', 'hearts', 'A')
      const playableCards = [
        strongCard,
        createMockCard('2', 'hearts', 'K'),
        createMockCard('3', 'hearts', '7'),
      ]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card: strongCard, order: 0 }],
        leadingSuit: 'hearts',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        strongCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      const canWinSignal = signals.find((s) => s.type === 'CAN_WIN')
      expect(canWinSignal).toBeDefined()
      expect(canWinSignal?.strength).toBe('STRONG')
      expect(canWinSignal?.confidence).toBe(0.8)
    })

    it('should decode NEED_HELP signal from weakest card', () => {
      const weakCard = createMockCard('1', 'hearts', '2')
      const playableCards = [
        createMockCard('2', 'hearts', 'A'),
        createMockCard('3', 'hearts', 'K'),
        weakCard,
      ]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card: weakCard, order: 0 }],
        leadingSuit: 'hearts',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        weakCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      const needHelpSignal = signals.find((s) => s.type === 'NEED_HELP')
      expect(needHelpSignal).toBeDefined()
      expect(needHelpSignal?.strength).toBe('STRONG')
      expect(needHelpSignal?.confidence).toBe(0.7)
    })

    it('should not decode signals with only one playable card', () => {
      const card = createMockCard('1', 'hearts', 'A')
      const playableCards = [card]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card, order: 0 }],
        leadingSuit: 'hearts',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        card,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      expect(signals).toHaveLength(0)
    })
  })

  describe('TRUMP_STRENGTH signal decoding', () => {
    it('should decode STRONG trump strength from high trump', () => {
      const trumpCard = createMockCard('1', 'spades', 'A')
      const playableCards = [trumpCard, createMockCard('2', 'spades', '7')]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card: trumpCard, order: 0 }],
        leadingSuit: 'spades',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        trumpCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      const trumpSignal = signals.find((s) => s.type === 'TRUMP_STRENGTH')
      expect(trumpSignal).toBeDefined()
      expect(trumpSignal?.strength).toBe('STRONG')
      expect(trumpSignal?.confidence).toBe(0.8)
    })

    it('should not decode signals for weak trump cards', () => {
      // Low trump cards (< 500) should not generate trump strength signals
      const trumpCard = createMockCard('1', 'spades', '2')
      const playableCards = [trumpCard, createMockCard('2', 'spades', '3')]

      mockTrick = {
        id: 'trick-1',
        cards: [{ playerId: 'partner', card: trumpCard, order: 0 }],
        leadingSuit: 'spades',
        winnerPlayerId: undefined,
        completed: false,
      }

      const signals = decodePartnerPlay(
        trumpCard,
        playableCards,
        mockTrick,
        mockGameState,
        cardCounting
      )

      // Weak trumps (< 500) should not trigger TRUMP_STRENGTH signal
      const trumpSignal = signals.find((s) => s.type === 'TRUMP_STRENGTH')
      expect(trumpSignal).toBeUndefined()
    })
  })
})

describe('analyzePlayPattern', () => {
  let mockGameState: GameState
  let cardCounting: CardCountingInfo

  beforeEach(() => {
    cardCounting = createMockCardCounting()
  })

  it('should analyze aggressive leading play', () => {
    // Use trump Ace to ensure strength > 700 (TRUMP_BASE + 14)
    const tricks: Trick[] = [
      {
        id: 'trick-1',
        cards: [
          {
            playerId: 'player1',
            card: createMockCard('1', 'spades', 'A'),
            order: 0,
          },
          {
            playerId: 'player2',
            card: createMockCard('2', 'spades', '7'),
            order: 1,
          },
        ],
        leadingSuit: 'spades',
        winnerPlayerId: 'player1',
        completed: true,
      },
    ]

    mockGameState = createMockGameState(tricks, 'spades')

    const patterns = analyzePlayPattern('player1', mockGameState, cardCounting)

    expect(patterns).toHaveLength(1)
    expect(patterns[0].wasLeading).toBe(true)
    expect(patterns[0].context).toBe('AGGRESSIVE')
    expect(patterns[0].cardPlayed.rank).toBe('A')
  })

  it('should analyze conservative leading play', () => {
    const tricks: Trick[] = [
      {
        id: 'trick-1',
        cards: [
          {
            playerId: 'player1',
            card: createMockCard('1', 'hearts', '2'),
            order: 0,
          },
          {
            playerId: 'player2',
            card: createMockCard('2', 'hearts', 'A'),
            order: 1,
          },
        ],
        leadingSuit: 'hearts',
        winnerPlayerId: 'player2',
        completed: true,
      },
    ]

    mockGameState = createMockGameState(tricks, 'spades')

    const patterns = analyzePlayPattern('player1', mockGameState, cardCounting)

    expect(patterns).toHaveLength(1)
    expect(patterns[0].wasLeading).toBe(true)
    expect(patterns[0].context).toBe('CONSERVATIVE')
  })

  it('should analyze multiple tricks for a player', () => {
    const tricks: Trick[] = [
      {
        id: 'trick-1',
        cards: [
          {
            playerId: 'player1',
            card: createMockCard('1', 'hearts', 'A'),
            order: 0,
          },
          {
            playerId: 'player2',
            card: createMockCard('2', 'hearts', '7'),
            order: 1,
          },
        ],
        leadingSuit: 'hearts',
        winnerPlayerId: 'player1',
        completed: true,
      },
      {
        id: 'trick-2',
        cards: [
          {
            playerId: 'player2',
            card: createMockCard('3', 'spades', 'K'),
            order: 0,
          },
          {
            playerId: 'player1',
            card: createMockCard('4', 'spades', '2'),
            order: 1,
          },
        ],
        leadingSuit: 'spades',
        winnerPlayerId: 'player2',
        completed: true,
      },
    ]

    mockGameState = createMockGameState(tricks, 'spades')

    const patterns = analyzePlayPattern('player1', mockGameState, cardCounting)

    expect(patterns).toHaveLength(2)
    expect(patterns[0].trickNumber).toBe(0)
    expect(patterns[1].trickNumber).toBe(1)
  })

  it('should skip tricks where player did not participate', () => {
    const tricks: Trick[] = [
      {
        id: 'trick-1',
        cards: [
          {
            playerId: 'player2',
            card: createMockCard('1', 'hearts', 'A'),
            order: 0,
          },
          {
            playerId: 'player3',
            card: createMockCard('2', 'hearts', '7'),
            order: 1,
          },
        ],
        leadingSuit: 'hearts',
        winnerPlayerId: 'player2',
        completed: true,
      },
    ]

    mockGameState = createMockGameState(tricks, 'spades')

    const patterns = analyzePlayPattern('player1', mockGameState, cardCounting)

    expect(patterns).toHaveLength(0)
  })
})

describe('extractPartnerSignals', () => {
  let cardCounting: CardCountingInfo

  beforeEach(() => {
    cardCounting = createMockCardCounting()
  })

  it('should extract signals from Napoleon partner (adjutant)', () => {
    const napoleon = createMockPlayer('napoleon', [], true, false)
    const adjutant = createMockPlayer('adjutant', [], false, true)
    const players = [napoleon, adjutant]

    const tricks: Trick[] = [
      {
        id: 'trick-1',
        cards: [
          {
            playerId: 'adjutant',
            card: createMockCard('1', 'hearts', 'A'),
            order: 0,
          },
          {
            playerId: 'napoleon',
            card: createMockCard('2', 'hearts', '7'),
            order: 1,
          },
        ],
        leadingSuit: 'hearts',
        winnerPlayerId: 'adjutant',
        completed: true,
      },
    ]

    const mockGameState = createMockGameState(tricks, 'spades', players)

    const signals = extractPartnerSignals(napoleon, mockGameState, cardCounting)

    expect(signals.length).toBeGreaterThan(0)
  })

  it('should extract signals from alliance partners', () => {
    const napoleon = createMockPlayer('napoleon', [], true, false)
    const player1 = createMockPlayer('player1', [], false, false)
    const player2 = createMockPlayer('player2', [], false, false)
    const players = [napoleon, player1, player2]

    const tricks: Trick[] = [
      {
        id: 'trick-1',
        cards: [
          {
            playerId: 'player2',
            card: createMockCard('1', 'hearts', 'A'),
            order: 0,
          },
          {
            playerId: 'player1',
            card: createMockCard('2', 'hearts', '7'),
            order: 1,
          },
        ],
        leadingSuit: 'hearts',
        winnerPlayerId: 'player2',
        completed: true,
      },
    ]

    const mockGameState = createMockGameState(tricks, 'spades', players)

    const signals = extractPartnerSignals(player1, mockGameState, cardCounting)

    expect(signals.length).toBeGreaterThan(0)
  })

  it('should return empty array when no partners found', () => {
    const player = createMockPlayer('player1', [], false, false)
    const players = [player]

    const mockGameState = createMockGameState([], 'spades', players)

    const signals = extractPartnerSignals(player, mockGameState, cardCounting)

    expect(signals).toHaveLength(0)
  })
})

describe('buildSignalHistory', () => {
  let cardCounting: CardCountingInfo

  beforeEach(() => {
    cardCounting = createMockCardCounting()
  })

  it('should build signal history for Napoleon', () => {
    const napoleon = createMockPlayer('napoleon', [], true, false)
    const adjutant = createMockPlayer('adjutant', [], false, true)
    const players = [napoleon, adjutant]

    const tricks: Trick[] = [
      {
        id: 'trick-1',
        cards: [
          {
            playerId: 'adjutant',
            card: createMockCard('1', 'hearts', 'A'),
            order: 0,
          },
          {
            playerId: 'napoleon',
            card: createMockCard('2', 'hearts', '7'),
            order: 1,
          },
        ],
        leadingSuit: 'hearts',
        winnerPlayerId: 'adjutant',
        completed: true,
      },
    ]

    const mockGameState = createMockGameState(tricks, 'spades', players)

    const history = buildSignalHistory(napoleon, mockGameState, cardCounting)

    expect(history).toHaveProperty('sentSignals')
    expect(history).toHaveProperty('receivedSignals')
    expect(history).toHaveProperty('partnerPlayPatterns')
    expect(history.sentSignals).toHaveLength(0) // Not tracked in decoder
    expect(history.receivedSignals.length).toBeGreaterThan(0)
    expect(history.partnerPlayPatterns.length).toBeGreaterThan(0)
  })

  it('should build signal history for alliance player', () => {
    const napoleon = createMockPlayer('napoleon', [], true, false)
    const player1 = createMockPlayer('player1', [], false, false)
    const player2 = createMockPlayer('player2', [], false, false)
    const players = [napoleon, player1, player2]

    const tricks: Trick[] = [
      {
        id: 'trick-1',
        cards: [
          {
            playerId: 'player2',
            card: createMockCard('1', 'hearts', 'A'),
            order: 0,
          },
          {
            playerId: 'player1',
            card: createMockCard('2', 'hearts', '7'),
            order: 1,
          },
        ],
        leadingSuit: 'hearts',
        winnerPlayerId: 'player2',
        completed: true,
      },
    ]

    const mockGameState = createMockGameState(tricks, 'spades', players)

    const history = buildSignalHistory(player1, mockGameState, cardCounting)

    expect(history).toHaveProperty('receivedSignals')
    expect(history).toHaveProperty('partnerPlayPatterns')
  })

  it('should return empty history when no tricks completed', () => {
    const player = createMockPlayer('player1', [], false, false)
    const players = [player]

    const mockGameState = createMockGameState([], 'spades', players)

    const history = buildSignalHistory(player, mockGameState, cardCounting)

    expect(history.receivedSignals).toHaveLength(0)
    expect(history.partnerPlayPatterns).toHaveLength(0)
  })
})
