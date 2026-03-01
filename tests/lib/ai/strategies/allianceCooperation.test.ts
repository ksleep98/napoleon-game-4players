/**
 * Alliance cooperation logic tests
 * 連合軍協調戦略のテスト
 */

import {
  coordinateBlockingStrategy,
  evaluateAllianceCooperation,
  evaluateAllianceStrategy,
  shouldBlockNapoleon,
  shouldLetPartnerWin,
} from '@/lib/ai/strategies/allianceCooperation'
import type {
  CardCountingInfo,
  CooperativeStrategyInfo,
  Signal,
  SignalHistory,
} from '@/lib/ai/strategies/types'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'

// Mock helper functions
jest.mock('@/lib/ai/strategies/signalDecoder', () => ({
  extractPartnerSignals: jest.fn(() => []),
}))

// Helper function to create mock card
function createMockCard(
  id: string,
  suit: Suit,
  rank: Card['rank'],
  value = 10
): Card {
  return {
    id,
    suit,
    rank,
    value,
  }
}

// Helper function to create mock player
function createMockPlayer(
  id: string,
  name: string,
  isNapoleon = false,
  isAdjutant = false,
  hand: Card[] = []
): Player {
  return {
    id,
    name,
    hand,
    isNapoleon,
    isAdjutant,
    position: 0,
    isAI: false,
  }
}

// Helper function to create mock game state
function createMockGameState(
  players: Player[],
  tricks: Trick[] = [],
  currentTrick: Trick,
  trumpSuit: Suit = 'spades'
): GameState {
  return {
    id: 'test-game-id',
    players,
    currentPlayerIndex: 0,
    trumpSuit,
    tricks,
    currentTrick,
    napoleonCard: undefined,
    napoleonDeclaration: {
      playerId: 'test-napoleon',
      suit: trumpSuit,
      targetTricks: 8,
      adjutantCard: createMockCard('adj-card', 'hearts', 'A'),
    },
    showingTrickResult: false,
    lastCompletedTrick: undefined,
    phase: 'playing',
    hiddenCards: [],
    passedPlayers: [],
    declarationTurn: 0,
    needsRedeal: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

// Helper function to create mock trick
function createMockTrick(
  leadingSuit: Suit | undefined = undefined,
  cards: Array<{ playerId: string; card: Card }> = []
): Trick {
  return {
    id: `trick-${Math.random()}`,
    leadingSuit,
    cards: cards.map((c, index) => ({
      playerId: c.playerId,
      card: c.card,
      order: index,
      revealsAdjutant: false,
    })),
    winnerPlayerId: undefined,
    completed: false,
  }
}

// Helper function to create mock card counting info
function createMockCardCounting(): CardCountingInfo {
  return {
    suitTracking: new Map(),
    totalPlayedCards: 0,
    totalRemainingCards: 52,
    totalPlayedFaceCards: 0,
    totalRemainingFaceCards: 13,
  }
}

// Helper function to create mock signal history
function createMockSignalHistory(
  sentSignals: Signal[] = [],
  receivedSignals: Signal[] = []
): SignalHistory {
  return {
    sentSignals,
    receivedSignals,
    partnerPlayPatterns: [],
  }
}

describe('evaluateAllianceCooperation', () => {
  let player1: Player
  let player2: Player
  let napoleon: Player
  let adjutant: Player
  let gameState: GameState
  let currentTrick: Trick
  let cardCounting: CardCountingInfo
  let signalHistory: SignalHistory

  beforeEach(() => {
    player1 = createMockPlayer('p1', 'Alliance Player 1')
    player2 = createMockPlayer('p2', 'Alliance Player 2')
    napoleon = createMockPlayer('nap', 'Napoleon', true)
    adjutant = createMockPlayer('adj', 'Adjutant', false, true)

    currentTrick = createMockTrick('hearts')
    gameState = createMockGameState(
      [player1, napoleon, player2, adjutant],
      [],
      currentTrick
    )

    cardCounting = createMockCardCounting()
    signalHistory = createMockSignalHistory()
  })

  describe('Basic cooperation evaluation', () => {
    it('should return default cooperation info when no partners exist', () => {
      // Only Napoleon and Adjutant players (no alliance partners)
      const soloGameState = createMockGameState(
        [napoleon, adjutant],
        [],
        currentTrick
      )

      const result = evaluateAllianceCooperation(
        [createMockCard('1', 'hearts', 'A')],
        currentTrick,
        soloGameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.shouldSignal).toBe(false)
      expect(result.cooperationBonus).toBe(0)
      expect(result.reasoning).toBe('No cooperation needed')
    })

    it('should provide basic cooperation bonus for standard play', () => {
      const playableCards = [
        createMockCard('1', 'hearts', 'A'),
        createMockCard('2', 'hearts', 'K'),
      ]

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.cooperationBonus).toBeGreaterThanOrEqual(20)
    })

    it('should extract partner signals from game state', () => {
      const playableCards = [createMockCard('1', 'hearts', 'A')]

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.partnerSignals).toBeDefined()
      expect(Array.isArray(result.partnerSignals)).toBe(true)
    })
  })

  describe('Blocking Napoleon scenarios', () => {
    it('should coordinate blocking when Napoleon is winning the trick', () => {
      const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
      currentTrick = createMockTrick('hearts', [
        { playerId: napoleon.id, card: napoleonCard },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        [],
        currentTrick
      )

      const playableCards = [
        createMockCard('1', 'hearts', 'A', 14), // Can win
        createMockCard('2', 'hearts', 'Q', 12), // Cannot win
      ]

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      // Should suggest coordinated blocking
      expect(result.cooperationBonus).toBeGreaterThan(100)
    })

    it('should not block when alliance partner is already winning', () => {
      const partnerCard = createMockCard('p2-card', 'hearts', 'A', 14)
      currentTrick = createMockTrick('hearts', [
        { playerId: player2.id, card: partnerCard },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        [],
        currentTrick
      )

      const playableCards = [
        createMockCard('1', 'hearts', 'K', 13),
        createMockCard('2', 'hearts', 'Q', 12),
      ]

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      // Should not block when partner is winning (standard play)
      expect(result.cooperationBonus).toBeLessThanOrEqual(100)
      expect(result.reasoning).toContain('Standard alliance play')
    })

    it('should prioritize blocking in critical phase', () => {
      // Create game state with 10 completed tricks (critical phase)
      const completedTricks: Trick[] = Array(10).fill(createMockTrick('hearts'))

      const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
      currentTrick = createMockTrick('hearts', [
        { playerId: napoleon.id, card: napoleonCard },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        completedTricks,
        currentTrick
      )

      const playableCards = [createMockCard('1', 'hearts', 'A', 14)]

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.cooperationBonus).toBeGreaterThan(100)
      expect(result.reasoning).toContain('blocking')
    })
  })

  describe('Letting partner win scenarios', () => {
    it('should let partner win when they are winning and player is last', () => {
      const partnerCard = createMockCard('p2-card', 'hearts', 'A', 14)
      currentTrick = createMockTrick('hearts', [
        { playerId: player2.id, card: partnerCard },
        {
          playerId: napoleon.id,
          card: createMockCard('nap', 'hearts', 'K', 13),
        },
        {
          playerId: adjutant.id,
          card: createMockCard('adj', 'hearts', 'Q', 12),
        },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        [],
        currentTrick
      )

      const playableCards = [
        createMockCard('1', 'hearts', '10', 10), // Face card to pass
        createMockCard('2', 'hearts', '7', 7),
      ]

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.reasoning).toContain('partner win')
      expect(result.cooperationBonus).toBeGreaterThanOrEqual(100)
    })

    it('should pass face cards to winning partner in mid-game', () => {
      // Mid-game (5 tricks completed = 41.6% progress)
      const completedTricks: Trick[] = Array(5).fill(createMockTrick('hearts'))

      const partnerCard = createMockCard('p2-card', 'hearts', 'K', 13)
      currentTrick = createMockTrick('hearts', [
        { playerId: player2.id, card: partnerCard },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        completedTricks,
        currentTrick
      )

      const playableCards = [
        createMockCard('1', 'hearts', 'J', 11), // Face card
        createMockCard('2', 'hearts', '7', 7),
      ]

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.cooperationBonus).toBeGreaterThan(50)
    })

    it('should not let partner win in early game', () => {
      // Early game (1 trick completed = 8.3% progress)
      const completedTricks: Trick[] = [createMockTrick('hearts')]

      const partnerCard = createMockCard('p2-card', 'hearts', 'K', 13)
      currentTrick = createMockTrick('hearts', [
        { playerId: player2.id, card: partnerCard },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        completedTricks,
        currentTrick
      )

      const playableCards = [
        createMockCard('1', 'hearts', 'J', 11),
        createMockCard('2', 'hearts', '7', 7),
      ]

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      // Early game: basic cooperation only
      expect(result.cooperationBonus).toBeLessThan(100)
    })
  })

  describe('Signal-based coordination', () => {
    it('should respond to partner BLOCK_NAPOLEON signal', () => {
      const blockSignal: Signal = {
        type: 'BLOCK_NAPOLEON',
        strength: 'STRONG',
        trickNumber: 3,
        playerId: player2.id,
        confidence: 0.9,
      }

      signalHistory = createMockSignalHistory([], [blockSignal])

      const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
      currentTrick = createMockTrick('hearts', [
        { playerId: napoleon.id, card: napoleonCard },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        [],
        currentTrick
      )

      const playableCards = [createMockCard('1', 'hearts', 'A', 14)]

      // Mock extractPartnerSignals to return the block signal
      const {
        extractPartnerSignals,
      } = require('@/lib/ai/strategies/signalDecoder')
      extractPartnerSignals.mockReturnValueOnce([blockSignal])

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.partnerSignals).toContainEqual(blockSignal)
    })

    it('should respond to partner CAN_WIN signal by letting them win', () => {
      const canWinSignal: Signal = {
        type: 'CAN_WIN',
        strength: 'STRONG',
        trickNumber: 3,
        playerId: player2.id,
        confidence: 0.8,
      }

      const partnerCard = createMockCard('p2-card', 'hearts', 'A', 14)
      currentTrick = createMockTrick('hearts', [
        { playerId: player2.id, card: partnerCard },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        [],
        currentTrick
      )

      const playableCards = [
        createMockCard('1', 'hearts', 'K', 13),
        createMockCard('2', 'hearts', '7', 7),
      ]

      // Mock extractPartnerSignals to return the CAN_WIN signal
      const {
        extractPartnerSignals,
      } = require('@/lib/ai/strategies/signalDecoder')
      extractPartnerSignals.mockReturnValueOnce([canWinSignal])

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.cooperationBonus).toBeGreaterThan(50)
    })

    it('should respond to partner NEED_HELP signal by blocking', () => {
      const needHelpSignal: Signal = {
        type: 'NEED_HELP',
        strength: 'STRONG',
        trickNumber: 3,
        playerId: player2.id,
        confidence: 0.7,
      }

      const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
      currentTrick = createMockTrick('hearts', [
        { playerId: napoleon.id, card: napoleonCard },
      ])

      gameState = createMockGameState(
        [player1, napoleon, player2, adjutant],
        [],
        currentTrick
      )

      const playableCards = [createMockCard('1', 'hearts', 'A', 14)]

      // Mock extractPartnerSignals to return the NEED_HELP signal
      const {
        extractPartnerSignals,
      } = require('@/lib/ai/strategies/signalDecoder')
      extractPartnerSignals.mockReturnValueOnce([needHelpSignal])

      const result = evaluateAllianceCooperation(
        playableCards,
        currentTrick,
        gameState,
        player1,
        signalHistory,
        cardCounting
      )

      expect(result.cooperationBonus).toBeGreaterThan(50)
    })
  })
})

describe('shouldBlockNapoleon', () => {
  let currentTrick: Trick
  let gameState: GameState
  let napoleon: Player
  let adjutant: Player
  let player1: Player

  beforeEach(() => {
    napoleon = createMockPlayer('nap', 'Napoleon', true)
    adjutant = createMockPlayer('adj', 'Adjutant', false, true)
    player1 = createMockPlayer('p1', 'Alliance Player 1')

    currentTrick = createMockTrick('hearts')
    gameState = createMockGameState(
      [player1, napoleon, adjutant],
      [],
      currentTrick
    )
  })

  it('should return false when Napoleon is not winning the trick', () => {
    const allianceCard = createMockCard('p1-card', 'hearts', 'A', 14)
    currentTrick = createMockTrick('hearts', [
      { playerId: player1.id, card: allianceCard },
    ])

    const requirements = {
      napoleonTeamFaceCards: 0,
      allianceTeamFaceCards: 0,
      remainingFaceCards: 13,
      remainingTricks: 12,
      napoleonNeedsToWin: 8,
      allianceNeedsToBlock: 6,
      napoleonCanAffordToLose: 5,
      isNapoleonAhead: false,
      isAllianceAhead: false,
      isCriticalPhase: false,
    }

    const result = shouldBlockNapoleon(
      currentTrick,
      gameState,
      requirements,
      []
    )

    expect(result).toBe(false)
  })

  it('should return true in critical phase when Napoleon is winning', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    gameState = createMockGameState(
      [player1, napoleon, adjutant],
      [],
      currentTrick
    )

    const requirements = {
      napoleonTeamFaceCards: 6,
      allianceTeamFaceCards: 5,
      remainingFaceCards: 2,
      remainingTricks: 2,
      napoleonNeedsToWin: 2,
      allianceNeedsToBlock: 1,
      napoleonCanAffordToLose: 0,
      isNapoleonAhead: true,
      isAllianceAhead: false,
      isCriticalPhase: true,
    }

    const result = shouldBlockNapoleon(
      currentTrick,
      gameState,
      requirements,
      []
    )

    expect(result).toBe(true)
  })

  it('should return true when Napoleon needs only 2 more face cards', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    gameState = createMockGameState(
      [player1, napoleon, adjutant],
      [],
      currentTrick
    )

    const requirements = {
      napoleonTeamFaceCards: 6,
      allianceTeamFaceCards: 4,
      remainingFaceCards: 3,
      remainingTricks: 5,
      napoleonNeedsToWin: 2,
      allianceNeedsToBlock: 4,
      napoleonCanAffordToLose: 1,
      isNapoleonAhead: false,
      isAllianceAhead: false,
      isCriticalPhase: false,
    }

    const result = shouldBlockNapoleon(
      currentTrick,
      gameState,
      requirements,
      []
    )

    expect(result).toBe(true)
  })

  it('should return true when trick has 3+ face cards', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'A', 14)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
      {
        playerId: adjutant.id,
        card: createMockCard('adj-card', 'hearts', 'K', 13),
      },
      {
        playerId: player1.id,
        card: createMockCard('p1-card', 'hearts', 'Q', 12),
      },
    ])

    gameState = createMockGameState(
      [player1, napoleon, adjutant],
      [],
      currentTrick
    )

    const requirements = {
      napoleonTeamFaceCards: 3,
      allianceTeamFaceCards: 2,
      remainingFaceCards: 8,
      remainingTricks: 8,
      napoleonNeedsToWin: 5,
      allianceNeedsToBlock: 4,
      napoleonCanAffordToLose: 3,
      isNapoleonAhead: false,
      isAllianceAhead: false,
      isCriticalPhase: false,
    }

    const result = shouldBlockNapoleon(
      currentTrick,
      gameState,
      requirements,
      []
    )

    expect(result).toBe(true)
  })

  it('should return true when receiving BLOCK_NAPOLEON signal', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    gameState = createMockGameState(
      [player1, napoleon, adjutant],
      [],
      currentTrick
    )

    const blockSignal: Signal = {
      type: 'BLOCK_NAPOLEON',
      strength: 'STRONG',
      trickNumber: 3,
      playerId: 'p2',
      confidence: 0.9,
    }

    const requirements = {
      napoleonTeamFaceCards: 2,
      allianceTeamFaceCards: 1,
      remainingFaceCards: 10,
      remainingTricks: 10,
      napoleonNeedsToWin: 6,
      allianceNeedsToBlock: 5,
      napoleonCanAffordToLose: 4,
      isNapoleonAhead: false,
      isAllianceAhead: false,
      isCriticalPhase: false,
    }

    const result = shouldBlockNapoleon(currentTrick, gameState, requirements, [
      blockSignal,
    ])

    expect(result).toBe(true)
  })

  it('should return true in mid-game with 1+ face cards in trick', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    // Mid-game (5 tricks completed = 41.6% progress)
    const completedTricks: Trick[] = Array(5).fill(createMockTrick('hearts'))

    gameState = createMockGameState(
      [player1, napoleon, adjutant],
      completedTricks,
      currentTrick
    )

    const requirements = {
      napoleonTeamFaceCards: 3,
      allianceTeamFaceCards: 2,
      remainingFaceCards: 8,
      remainingTricks: 7,
      napoleonNeedsToWin: 5,
      allianceNeedsToBlock: 4,
      napoleonCanAffordToLose: 3,
      isNapoleonAhead: false,
      isAllianceAhead: false,
      isCriticalPhase: false,
    }

    const result = shouldBlockNapoleon(
      currentTrick,
      gameState,
      requirements,
      []
    )

    expect(result).toBe(true)
  })

  it('should return false in early game with no face cards in trick', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', '7', 7)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    // Early game (1 trick completed = 8.3% progress)
    const completedTricks: Trick[] = [createMockTrick('hearts')]

    gameState = createMockGameState(
      [player1, napoleon, adjutant],
      completedTricks,
      currentTrick
    )

    const requirements = {
      napoleonTeamFaceCards: 0,
      allianceTeamFaceCards: 0,
      remainingFaceCards: 13,
      remainingTricks: 11,
      napoleonNeedsToWin: 8,
      allianceNeedsToBlock: 6,
      napoleonCanAffordToLose: 5,
      isNapoleonAhead: false,
      isAllianceAhead: false,
      isCriticalPhase: false,
    }

    const result = shouldBlockNapoleon(
      currentTrick,
      gameState,
      requirements,
      []
    )

    expect(result).toBe(false)
  })
})

describe('shouldLetPartnerWin', () => {
  let currentTrick: Trick
  let gameState: GameState
  let napoleon: Player
  let player1: Player
  let player2: Player

  beforeEach(() => {
    napoleon = createMockPlayer('nap', 'Napoleon', true)
    player1 = createMockPlayer('p1', 'Alliance Player 1')
    player2 = createMockPlayer('p2', 'Alliance Player 2')

    currentTrick = createMockTrick('hearts')
    gameState = createMockGameState(
      [player1, napoleon, player2],
      [],
      currentTrick
    )
  })

  it('should return false when alliance is not winning', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'A', 14)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    const result = shouldLetPartnerWin(currentTrick, gameState, player1, [])

    expect(result).toBe(false)
  })

  it('should return true when player is last and alliance is winning', () => {
    const partnerCard = createMockCard('p2-card', 'hearts', 'A', 14)
    currentTrick = createMockTrick('hearts', [
      { playerId: player2.id, card: partnerCard },
      { playerId: napoleon.id, card: createMockCard('nap', 'hearts', 'K', 13) },
      { playerId: player1.id, card: createMockCard('p1a', 'hearts', 'Q', 12) },
    ])

    gameState = createMockGameState(
      [player1, napoleon, player2],
      [],
      currentTrick
    )

    const result = shouldLetPartnerWin(currentTrick, gameState, player1, [])

    expect(result).toBe(true)
  })

  it('should return true when receiving CAN_WIN signal from partner', () => {
    const partnerCard = createMockCard('p2-card', 'hearts', 'A', 14)
    currentTrick = createMockTrick('hearts', [
      { playerId: player2.id, card: partnerCard },
    ])

    gameState = createMockGameState(
      [player1, napoleon, player2],
      [],
      currentTrick
    )

    const canWinSignal: Signal = {
      type: 'CAN_WIN',
      strength: 'STRONG',
      trickNumber: 3,
      playerId: player2.id,
      confidence: 0.8,
    }

    const result = shouldLetPartnerWin(currentTrick, gameState, player1, [
      canWinSignal,
    ])

    expect(result).toBe(true)
  })

  it('should return true in mid-game with face cards in trick', () => {
    // Mid-game (5 tricks completed = 41.6% progress)
    const completedTricks: Trick[] = Array(5).fill(createMockTrick('hearts'))

    const partnerCard = createMockCard('p2-card', 'hearts', 'K', 13)
    currentTrick = createMockTrick('hearts', [
      { playerId: player2.id, card: partnerCard },
    ])

    gameState = createMockGameState(
      [player1, napoleon, player2],
      completedTricks,
      currentTrick
    )

    const result = shouldLetPartnerWin(currentTrick, gameState, player1, [])

    expect(result).toBe(true)
  })

  it('should return false in early game even with alliance winning', () => {
    // Early game (1 trick completed = 8.3% progress)
    const completedTricks: Trick[] = [createMockTrick('hearts')]

    const partnerCard = createMockCard('p2-card', 'hearts', 'K', 13)
    currentTrick = createMockTrick('hearts', [
      { playerId: player2.id, card: partnerCard },
    ])

    gameState = createMockGameState(
      [player1, napoleon, player2],
      completedTricks,
      currentTrick
    )

    const result = shouldLetPartnerWin(currentTrick, gameState, player1, [])

    expect(result).toBe(false)
  })

  it('should return false when no face cards in mid-game trick', () => {
    // Mid-game (5 tricks completed)
    const completedTricks: Trick[] = Array(5).fill(createMockTrick('hearts'))

    const partnerCard = createMockCard('p2-card', 'hearts', '7', 7)
    currentTrick = createMockTrick('hearts', [
      { playerId: player2.id, card: partnerCard },
    ])

    gameState = createMockGameState(
      [player1, napoleon, player2],
      completedTricks,
      currentTrick
    )

    const result = shouldLetPartnerWin(currentTrick, gameState, player1, [])

    expect(result).toBe(false)
  })
})

describe('coordinateBlockingStrategy', () => {
  let currentTrick: Trick
  let gameState: GameState
  let napoleon: Player
  let player1: Player

  beforeEach(() => {
    napoleon = createMockPlayer('nap', 'Napoleon', true)
    player1 = createMockPlayer('p1', 'Alliance Player 1')

    currentTrick = createMockTrick('hearts')
    gameState = createMockGameState([player1, napoleon], [], currentTrick)
  })

  it('should return null when cannot win the trick', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'A', 14)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    const playableCards = [
      createMockCard('1', 'hearts', 'K', 13),
      createMockCard('2', 'hearts', 'Q', 12),
    ]

    const result = coordinateBlockingStrategy(
      playableCards,
      currentTrick,
      gameState,
      player1,
      []
    )

    expect(result).toBeNull()
  })

  it('should return lowest winning card for normal blocking', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    gameState = createMockGameState([player1, napoleon], [], currentTrick)

    const playableCards = [
      createMockCard('1', 'hearts', 'A', 14),
      createMockCard('2', 'hearts', '2', 2),
    ]

    const result = coordinateBlockingStrategy(
      playableCards,
      currentTrick,
      gameState,
      player1,
      []
    )

    expect(result).not.toBeNull()
    expect(result?.rank).toBe('A')
  })

  it('should prioritize non-trump winners when partner has strong trumps', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'K', 13)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    gameState = createMockGameState(
      [player1, napoleon],
      [],
      currentTrick,
      'spades'
    )

    const strongTrumpSignal: Signal = {
      type: 'TRUMP_STRENGTH',
      strength: 'STRONG',
      trickNumber: 3,
      playerId: 'p2',
      confidence: 0.8,
    }

    const playableCards = [
      createMockCard('1', 'hearts', 'A', 14), // Non-trump winner
      createMockCard('2', 'spades', '7', 7), // Trump winner
    ]

    const result = coordinateBlockingStrategy(
      playableCards,
      currentTrick,
      gameState,
      player1,
      [strongTrumpSignal]
    )

    expect(result).not.toBeNull()
    // Should prefer non-trump winner
    expect(result?.suit).toBe('hearts')
  })

  it('should use lowest winning card when partner needs help', () => {
    const napoleonCard = createMockCard('nap-card', 'hearts', 'Q', 12)
    currentTrick = createMockTrick('hearts', [
      { playerId: napoleon.id, card: napoleonCard },
    ])

    gameState = createMockGameState([player1, napoleon], [], currentTrick)

    const needHelpSignal: Signal = {
      type: 'NEED_HELP',
      strength: 'STRONG',
      trickNumber: 3,
      playerId: 'p2',
      confidence: 0.7,
    }

    const playableCards = [
      createMockCard('1', 'hearts', 'A', 14),
      createMockCard('2', 'hearts', 'K', 13),
    ]

    const result = coordinateBlockingStrategy(
      playableCards,
      currentTrick,
      gameState,
      player1,
      [needHelpSignal]
    )

    expect(result).not.toBeNull()
    expect(result?.rank).toBe('K') // Lowest winning card
  })
})

describe('evaluateAllianceStrategy', () => {
  let gameState: GameState
  let cooperativeInfo: CooperativeStrategyInfo

  beforeEach(() => {
    const napoleon = createMockPlayer('nap', 'Napoleon', true)
    const player1 = createMockPlayer('p1', 'Alliance Player 1')

    gameState = createMockGameState(
      [player1, napoleon],
      [],
      createMockTrick('hearts')
    )

    cooperativeInfo = {
      shouldSignal: false,
      partnerSignals: [],
      reasoning: 'Test',
      cooperationBonus: 0,
    }
  })

  it('should give bonus for weak cards (exploration)', () => {
    const weakCard = createMockCard('1', 'hearts', '2', 2)

    const bonus = evaluateAllianceStrategy(weakCard, gameState, cooperativeInfo)

    expect(bonus).toBeGreaterThanOrEqual(30)
  })

  it('should give bonus for strong cards (preservation)', () => {
    const strongCard = createMockCard('1', 'spades', 'A', 14)

    const bonus = evaluateAllianceStrategy(
      strongCard,
      gameState,
      cooperativeInfo
    )

    expect(bonus).toBeGreaterThanOrEqual(80)
  })

  it('should add cooperation bonus from cooperative info', () => {
    const card = createMockCard('1', 'hearts', '7', 7)
    cooperativeInfo.cooperationBonus = 100

    const bonus = evaluateAllianceStrategy(card, gameState, cooperativeInfo)

    expect(bonus).toBeGreaterThanOrEqual(100)
  })

  it('should strongly favor coordinated play card', () => {
    const coordinatedCard = createMockCard('1', 'hearts', 'A', 14)
    const otherCard = createMockCard('2', 'hearts', 'K', 13)

    cooperativeInfo.coordinatedPlay = coordinatedCard

    const coordinatedBonus = evaluateAllianceStrategy(
      coordinatedCard,
      gameState,
      cooperativeInfo
    )
    const otherBonus = evaluateAllianceStrategy(
      otherCard,
      gameState,
      cooperativeInfo
    )

    expect(coordinatedBonus).toBeGreaterThan(otherBonus + 150)
  })

  it('should give bonus for strong cards when BLOCK_NAPOLEON signal received', () => {
    const strongCard = createMockCard('1', 'hearts', 'A', 14)

    const blockSignal: Signal = {
      type: 'BLOCK_NAPOLEON',
      strength: 'STRONG',
      trickNumber: 3,
      playerId: 'p2',
      confidence: 0.9,
    }

    cooperativeInfo.partnerSignals = [blockSignal]

    const bonus = evaluateAllianceStrategy(
      strongCard,
      gameState,
      cooperativeInfo
    )

    // Should get at least basic bonus
    expect(bonus).toBeGreaterThanOrEqual(30)
  })

  it('should give bonus for winning cards when NEED_HELP signal received', () => {
    const winningCard = createMockCard('1', 'hearts', 'K', 13)

    const needHelpSignal: Signal = {
      type: 'NEED_HELP',
      strength: 'STRONG',
      trickNumber: 3,
      playerId: 'p2',
      confidence: 0.7,
    }

    cooperativeInfo.partnerSignals = [needHelpSignal]

    const bonus = evaluateAllianceStrategy(
      winningCard,
      gameState,
      cooperativeInfo
    )

    // Should get basic bonus plus signal bonus (30-60)
    expect(bonus).toBeGreaterThanOrEqual(30)
  })

  it('should favor non-trump cards when partner has TRUMP_STRENGTH signal', () => {
    const trumpCard = createMockCard('1', 'spades', 'K', 13)
    const nonTrumpCard = createMockCard('2', 'hearts', 'K', 13)

    const trumpSignal: Signal = {
      type: 'TRUMP_STRENGTH',
      strength: 'STRONG',
      trickNumber: 3,
      playerId: 'p2',
      confidence: 0.8,
    }

    cooperativeInfo.partnerSignals = [trumpSignal]

    const trumpBonus = evaluateAllianceStrategy(
      trumpCard,
      gameState,
      cooperativeInfo
    )
    const nonTrumpBonus = evaluateAllianceStrategy(
      nonTrumpCard,
      gameState,
      cooperativeInfo
    )

    expect(nonTrumpBonus).toBeGreaterThan(trumpBonus)
  })
})
