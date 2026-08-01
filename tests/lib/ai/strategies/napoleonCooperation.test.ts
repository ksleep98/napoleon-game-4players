/**
 * napoleonCooperation.ts のユニットテスト
 * Napoleon-Adjutant cooperation and signaling tests
 */

import {
  enhanceAdjutantCoordination,
  evaluateNapoleonCooperation,
  evaluateNapoleonStrategy,
} from '@/lib/ai/strategies/napoleonCooperation'
import type {
  AdjutantTacticalInfo,
  CardCountingInfo,
  CooperativeStrategyInfo,
  Signal,
  SignalHistory,
  WinningRequirements,
} from '@/lib/ai/strategies/types'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'

// ===== Mock Helper Functions =====

function createMockCard(
  id: string,
  suit: Suit,
  rank: Card['rank'],
  value = 10
): Card {
  return { id, suit, rank, value }
}

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

function createMockCardCounting(): CardCountingInfo {
  return {
    suitTracking: new Map(),
    totalPlayedCards: 0,
    totalRemainingCards: 52,
    totalPlayedFaceCards: 0,
    totalRemainingFaceCards: 13,
  }
}

function createMockWinningRequirements(
  overrides: Partial<WinningRequirements> = {}
): WinningRequirements {
  return {
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
    ...overrides,
  }
}

function createMockAdjutantTactics(
  overrides: Partial<AdjutantTacticalInfo> = {}
): AdjutantTacticalInfo {
  return {
    shouldRevealNow: false,
    shouldProtectNapoleon: false,
    shouldPassFaceCard: false,
    shouldWinForNapoleon: false,
    napoleonNeedsHelp: false,
    trickValueForNapoleon: 0,
    optimalRevealTiming: 0,
    napoleonIsWinning: false,
    adjutantCard: null,
    faceCardToPass: null,
    shouldAnswerAdjutantCall: false,
    adjutantCallCard: null,
    ...overrides,
  }
}

// ===== Tests =====

describe('napoleonCooperation', () => {
  describe('evaluateNapoleonCooperation', () => {
    it('should return cooperation info for Napoleon player', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const adjutant = createMockPlayer('adjutant-1', 'Adjutant', false, true)
      const alliance1 = createMockPlayer('alliance-1', 'Alliance 1')
      const alliance2 = createMockPlayer('alliance-2', 'Alliance 2')

      const players = [napoleon, adjutant, alliance1, alliance2]
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(players, [], currentTrick)

      const playableCards = [
        createMockCard('card-1', 'spades', 'A', 14),
        createMockCard('card-2', 'hearts', 'K', 13),
      ]

      const signalHistory = createMockSignalHistory()
      const cardCounting = createMockCardCounting()
      const requirements = createMockWinningRequirements()

      const result = evaluateNapoleonCooperation(
        playableCards,
        currentTrick,
        gameState,
        napoleon,
        signalHistory,
        cardCounting,
        requirements
      )

      expect(result).toBeDefined()
      expect(result.shouldSignal).toBeDefined()
      expect(result.partnerSignals).toBeInstanceOf(Array)
      expect(result.cooperationBonus).toBeGreaterThanOrEqual(0)
      expect(result.reasoning).toBeDefined()
    })

    it('should not signal in early game (first 2 tricks)', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]
      const currentTrick = createMockTrick('hearts', [
        { playerId: 'other', card: createMockCard('c1', 'hearts', '7') },
      ])
      const gameState = createMockGameState(players, [], currentTrick)

      const playableCards = [
        createMockCard('card-1', 'hearts', 'A', 14),
        createMockCard('card-2', 'hearts', 'K', 13),
      ]

      const signalHistory = createMockSignalHistory()
      const cardCounting = createMockCardCounting()
      const requirements = createMockWinningRequirements()

      const result = evaluateNapoleonCooperation(
        playableCards,
        currentTrick,
        gameState,
        napoleon,
        signalHistory,
        cardCounting,
        requirements
      )

      expect(result.shouldSignal).toBe(false)
    })

    it('should not signal when leading', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]
      const currentTrick = createMockTrick() // Empty trick (leading)
      const gameState = createMockGameState(
        players,
        [createMockTrick(), createMockTrick(), createMockTrick()] as Trick[],
        currentTrick
      )

      const playableCards = [
        createMockCard('card-1', 'hearts', 'A', 14),
        createMockCard('card-2', 'hearts', 'K', 13),
      ]

      const signalHistory = createMockSignalHistory()
      const cardCounting = createMockCardCounting()
      const requirements = createMockWinningRequirements()

      const result = evaluateNapoleonCooperation(
        playableCards,
        currentTrick,
        gameState,
        napoleon,
        signalHistory,
        cardCounting,
        requirements
      )

      expect(result.shouldSignal).toBe(false)
    })

    it('should give bonus for Napoleon when adjutant sends CAN_WIN signal', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const adjutant = createMockPlayer('adjutant-1', 'Adjutant', false, true)
      const players = [napoleon, adjutant]
      const currentTrick = createMockTrick('hearts', [
        { playerId: 'adjutant-1', card: createMockCard('c1', 'hearts', 'A') },
      ])
      const gameState = createMockGameState(players, [], currentTrick)

      const playableCards = [
        createMockCard('card-1', 'hearts', 'K', 13),
        createMockCard('card-2', 'spades', '7', 7),
      ]

      const adjutantSignal: Signal = {
        type: 'CAN_WIN',
        strength: 'STRONG',
        trickNumber: 1,
        playerId: 'adjutant-1',
        confidence: 0.9,
      }

      const signalHistory = createMockSignalHistory([], [adjutantSignal])
      const cardCounting = createMockCardCounting()
      const requirements = createMockWinningRequirements()

      const result = evaluateNapoleonCooperation(
        playableCards,
        currentTrick,
        gameState,
        napoleon,
        signalHistory,
        cardCounting,
        requirements
      )

      expect(result.partnerSignals).toContainEqual(adjutantSignal)
      expect(result.cooperationBonus).toBeGreaterThan(0)
    })

    it('should give bonus when Napoleon sends NEED_HELP signal to Adjutant', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const adjutant = createMockPlayer('adjutant-1', 'Adjutant', false, true)
      const players = [napoleon, adjutant]
      const currentTrick = createMockTrick('hearts', [
        { playerId: 'napoleon-1', card: createMockCard('c1', 'hearts', '7') },
      ])
      const gameState = createMockGameState(players, [], currentTrick)

      const playableCards = [
        createMockCard('card-1', 'hearts', 'A', 14),
        createMockCard('card-2', 'hearts', 'K', 13),
      ]

      const napoleonSignal: Signal = {
        type: 'NEED_HELP',
        strength: 'STRONG',
        trickNumber: 1,
        playerId: 'napoleon-1',
        confidence: 0.8,
      }

      const signalHistory = createMockSignalHistory([], [napoleonSignal])
      const cardCounting = createMockCardCounting()
      const requirements = createMockWinningRequirements()

      const result = evaluateNapoleonCooperation(
        playableCards,
        currentTrick,
        gameState,
        adjutant,
        signalHistory,
        cardCounting,
        requirements
      )

      expect(result.partnerSignals).toContainEqual(napoleonSignal)
      expect(result.cooperationBonus).toBeGreaterThan(0)
    })

    it('should signal in mid-game (30-70%) with options', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]

      // Create 5 completed tricks (mid-game ~40% progress)
      const completedTricks = Array.from({ length: 5 }, () => createMockTrick())
      const currentTrick = createMockTrick('hearts', [
        { playerId: 'other', card: createMockCard('c1', 'hearts', '7') },
      ])
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = [
        createMockCard('card-1', 'hearts', 'A', 14),
        createMockCard('card-2', 'hearts', 'K', 13),
      ]

      const signalHistory = createMockSignalHistory()
      const cardCounting = createMockCardCounting()
      const requirements = createMockWinningRequirements({
        remainingTricks: 7,
      })

      const result = evaluateNapoleonCooperation(
        playableCards,
        currentTrick,
        gameState,
        napoleon,
        signalHistory,
        cardCounting,
        requirements
      )

      expect(result.shouldSignal).toBe(true)
    })
  })

  describe('enhanceAdjutantCoordination', () => {
    it('should disable shouldPassFaceCard when Napoleon sends CAN_WIN signal', () => {
      const adjutantTactics = createMockAdjutantTactics({
        shouldPassFaceCard: true,
        faceCardToPass: createMockCard('card-1', 'hearts', 'Q'),
      })

      const napoleonSignal: Signal = {
        type: 'CAN_WIN',
        strength: 'STRONG',
        trickNumber: 1,
        playerId: 'napoleon-1',
        confidence: 0.9,
      }

      const enhanced = enhanceAdjutantCoordination(
        adjutantTactics,
        [napoleonSignal],
        {} as GameState
      )

      expect(enhanced.shouldPassFaceCard).toBe(false)
    })

    it('should enable shouldWinForNapoleon when Napoleon sends NEED_HELP signal', () => {
      const adjutantTactics = createMockAdjutantTactics({
        shouldWinForNapoleon: false,
      })

      const napoleonSignal: Signal = {
        type: 'NEED_HELP',
        strength: 'STRONG',
        trickNumber: 1,
        playerId: 'napoleon-1',
        confidence: 0.8,
      }

      const enhanced = enhanceAdjutantCoordination(
        adjutantTactics,
        [napoleonSignal],
        {} as GameState
      )

      expect(enhanced.shouldWinForNapoleon).toBe(true)
      expect(enhanced.shouldProtectNapoleon).toBe(true)
    })

    it('should enable shouldWinForNapoleon when Napoleon sends SUPPORT_NAPOLEON signal', () => {
      const adjutantTactics = createMockAdjutantTactics({
        shouldWinForNapoleon: false,
      })

      const napoleonSignal: Signal = {
        type: 'SUPPORT_NAPOLEON',
        strength: 'STRONG',
        trickNumber: 1,
        playerId: 'napoleon-1',
        confidence: 0.7,
      }

      const enhanced = enhanceAdjutantCoordination(
        adjutantTactics,
        [napoleonSignal],
        {} as GameState
      )

      expect(enhanced.shouldWinForNapoleon).toBe(true)
    })

    it('should update napoleonIsWinning when Napoleon sends TRUMP_STRENGTH signal', () => {
      const adjutantTactics = createMockAdjutantTactics({
        napoleonIsWinning: false,
      })

      const napoleonSignal: Signal = {
        type: 'TRUMP_STRENGTH',
        strength: 'STRONG',
        trickNumber: 1,
        playerId: 'napoleon-1',
        confidence: 0.9,
      }

      const enhanced = enhanceAdjutantCoordination(
        adjutantTactics,
        [napoleonSignal],
        {} as GameState
      )

      expect(enhanced.napoleonIsWinning).toBe(true)
    })

    it('should not modify tactics when no relevant signals', () => {
      const adjutantTactics = createMockAdjutantTactics({
        shouldPassFaceCard: true,
        shouldWinForNapoleon: false,
      })

      const irrelevantSignal: Signal = {
        type: 'VOID_SUIT',
        strength: 'STRONG',
        trickNumber: 1,
        playerId: 'napoleon-1',
        confidence: 0.6,
        suit: 'hearts',
      }

      const enhanced = enhanceAdjutantCoordination(
        adjutantTactics,
        [irrelevantSignal],
        {} as GameState
      )

      expect(enhanced.shouldPassFaceCard).toBe(true)
      expect(enhanced.shouldWinForNapoleon).toBe(false)
    })
  })

  describe('evaluateNapoleonStrategy', () => {
    // 不変条件: 連携で選ばれたカード (coordinatedPlay) は、同等の別カードより
    // 必ず高く評価される。絶対値ではなく「向き」だけを固定しているため、
    // 重み調整では壊れない。
    it('should always rank the coordinated play card above a non-coordinated one', () => {
      const coordinated = createMockCard('card-1', 'hearts', 'K', 13)
      const other = createMockCard('card-2', 'hearts', 'Q', 12)
      const gameState = createMockGameState([], [], createMockTrick())

      const cooperativeInfo: CooperativeStrategyInfo = {
        shouldSignal: false,
        partnerSignals: [],
        coordinatedPlay: coordinated,
        reasoning: 'coordinated play',
        cooperationBonus: 100,
      }

      const coordinatedBonus = evaluateNapoleonStrategy(
        coordinated,
        gameState,
        cooperativeInfo
      )
      const otherBonus = evaluateNapoleonStrategy(
        other,
        gameState,
        cooperativeInfo
      )

      expect(coordinatedBonus).toBeGreaterThan(otherBonus)
    })
  })
})
