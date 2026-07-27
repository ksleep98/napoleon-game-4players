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

  // 不変条件: 連携で選ばれたカード (coordinatedPlay) は、同等の別カードより
  // 必ず高く評価される。閾値ではなく「向き」だけを固定しているため、
  // 重み調整では壊れない。
  it('should always rank the coordinated play card above a non-coordinated one', () => {
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

    expect(coordinatedBonus).toBeGreaterThan(otherBonus)
  })
})
