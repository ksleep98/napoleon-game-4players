/**
 * endgameSolver.ts のユニットテスト
 * Endgame perfect play solver tests
 */

import {
  shouldUseEndgameSolver,
  solveEndgame,
} from '@/lib/ai/strategies/endgameSolver'
import type { CardCountingInfo } from '@/lib/ai/strategies/types'
import type { Card, GameState, Player, Trick } from '@/types/game'

// ===== Mock Helper Functions =====

function createMockCard(
  id: string,
  suit: 'spades' | 'hearts' | 'diamonds' | 'clubs',
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
  currentTrick: Trick
): GameState {
  return {
    id: 'test-game-id',
    players,
    currentPlayerIndex: 0,
    trumpSuit: 'spades',
    tricks,
    currentTrick,
    napoleonCard: undefined,
    napoleonDeclaration: {
      playerId: 'test-napoleon',
      suit: 'spades',
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
  leadingSuit?: 'spades' | 'hearts' | 'diamonds' | 'clubs',
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

function createMockCardCounting(): CardCountingInfo {
  return {
    suitTracking: new Map(),
    totalPlayedCards: 0,
    totalRemainingCards: 52,
    totalPlayedFaceCards: 0,
    totalRemainingFaceCards: 13,
  }
}

// ===== Tests =====

describe('endgameSolver', () => {
  describe('shouldUseEndgameSolver', () => {
    it('should return true when 3 tricks remaining', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]

      // 9トリック完了 = 残り3トリック
      const completedTricks = Array.from({ length: 9 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const result = shouldUseEndgameSolver(gameState, 3)
      expect(result).toBe(true)
    })

    it('should return true when 2 tricks remaining', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]

      // 10トリック完了 = 残り2トリック
      const completedTricks = Array.from({ length: 10 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const result = shouldUseEndgameSolver(gameState, 3)
      expect(result).toBe(true)
    })

    it('should return true when 1 trick remaining', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]

      // 11トリック完了 = 残り1トリック
      const completedTricks = Array.from({ length: 11 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const result = shouldUseEndgameSolver(gameState, 3)
      expect(result).toBe(true)
    })

    it('should return false when 4 tricks remaining', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]

      // 8トリック完了 = 残り4トリック
      const completedTricks = Array.from({ length: 8 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const result = shouldUseEndgameSolver(gameState, 3)
      expect(result).toBe(false)
    })

    it('should return false when 0 tricks remaining (game over)', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]

      // 12トリック完了 = 残り0トリック
      const completedTricks = Array.from({ length: 12 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const result = shouldUseEndgameSolver(gameState, 3)
      expect(result).toBe(false)
    })

    it('should respect maxDepth parameter', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false)
      const players = [napoleon]

      // 10トリック完了 = 残り2トリック
      const completedTricks = Array.from({ length: 10 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      // maxDepth=2: 残り2トリックは使用
      expect(shouldUseEndgameSolver(gameState, 2)).toBe(true)

      // maxDepth=1: 残り2トリックは使用しない
      expect(shouldUseEndgameSolver(gameState, 1)).toBe(false)
    })
  })

  describe('solveEndgame', () => {
    it('should return best card with high confidence for 1 trick remaining', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
        createMockCard('card-2', 'hearts', '7', 7),
      ])
      const players = [napoleon]

      // 11トリック完了 = 残り1トリック
      const completedTricks = Array.from({ length: 11 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = napoleon.hand
      const cardCounting = createMockCardCounting()

      const result = solveEndgame(
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        3
      )

      expect(result).toBeDefined()
      expect(result?.bestCard).toBeDefined()
      expect(result?.confidence).toBeGreaterThanOrEqual(0.8)
      expect(result?.depth).toBe(1)
    })

    it('should return null when remaining tricks > maxDepth', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
      ])
      const players = [napoleon]

      // 8トリック完了 = 残り4トリック
      const completedTricks = Array.from({ length: 8 }, () => createMockTrick())
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = napoleon.hand
      const cardCounting = createMockCardCounting()

      const result = solveEndgame(
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        3 // maxDepth=3
      )

      expect(result).toBeNull()
    })

    it('should return null when no playable cards', () => {
      const napoleon = createMockPlayer(
        'napoleon-1',
        'Napoleon',
        true,
        false,
        []
      )
      const players = [napoleon]

      const completedTricks = Array.from({ length: 10 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards: Card[] = []
      const cardCounting = createMockCardCounting()

      const result = solveEndgame(
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        3
      )

      expect(result).toBeNull()
    })

    it('should return only card when only 1 playable card', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
      ])
      const players = [napoleon]

      const completedTricks = Array.from({ length: 10 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = napoleon.hand
      const cardCounting = createMockCardCounting()

      const result = solveEndgame(
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        3
      )

      expect(result).toBeDefined()
      expect(result?.bestCard).toEqual(playableCards[0])
      expect(result?.confidence).toBe(1.0)
      expect(result?.depth).toBe(0)
    })

    it('should prefer winning card in simple endgame', () => {
      // ナポレオンが強いカードと弱いカードを持っている
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('strong', 'spades', 'A', 14),
        createMockCard('weak', 'hearts', '7', 7),
      ])

      const adjutant = createMockPlayer('adjutant-1', 'Adjutant', false, true, [
        createMockCard('adj-1', 'spades', 'K', 13),
      ])

      const alliance1 = createMockPlayer(
        'alliance-1',
        'Alliance1',
        false,
        false,
        [createMockCard('all-1', 'spades', 'Q', 12)]
      )

      const alliance2 = createMockPlayer(
        'alliance-2',
        'Alliance2',
        false,
        false,
        [createMockCard('all-2', 'spades', 'J', 11)]
      )

      const players = [napoleon, adjutant, alliance1, alliance2]

      // 11トリック完了 = 残り1トリック
      const completedTricks = Array.from({ length: 11 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = napoleon.hand
      const cardCounting = createMockCardCounting()

      const result = solveEndgame(
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        3
      )

      expect(result).toBeDefined()
      expect(result?.bestCard.id).toBe('strong') // 強いカードを選ぶ
      expect(result?.confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('should evaluate 2 tricks deep', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
        createMockCard('card-2', 'hearts', 'K', 13),
      ])

      const adjutant = createMockPlayer('adjutant-1', 'Adjutant', false, true, [
        createMockCard('adj-1', 'spades', 'K', 13),
        createMockCard('adj-2', 'hearts', 'Q', 12),
      ])

      const alliance1 = createMockPlayer(
        'alliance-1',
        'Alliance1',
        false,
        false,
        [
          createMockCard('all1-1', 'spades', 'Q', 12),
          createMockCard('all1-2', 'hearts', 'J', 11),
        ]
      )

      const alliance2 = createMockPlayer(
        'alliance-2',
        'Alliance2',
        false,
        false,
        [
          createMockCard('all2-1', 'spades', 'J', 11),
          createMockCard('all2-2', 'hearts', '10', 10),
        ]
      )

      const players = [napoleon, adjutant, alliance1, alliance2]

      // 10トリック完了 = 残り2トリック
      const completedTricks = Array.from({ length: 10 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = napoleon.hand
      const cardCounting = createMockCardCounting()

      const result = solveEndgame(
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        3
      )

      expect(result).toBeDefined()
      expect(result?.bestCard).toBeDefined()
      expect(result?.depth).toBe(2)
      expect(result?.confidence).toBeGreaterThanOrEqual(0.8)
    })

    it('should return expected value', () => {
      const napoleon = createMockPlayer('napoleon-1', 'Napoleon', true, false, [
        createMockCard('card-1', 'spades', 'A', 14),
        createMockCard('card-2', 'hearts', '7', 7),
      ])
      const players = [napoleon]

      const completedTricks = Array.from({ length: 11 }, () =>
        createMockTrick()
      )
      const currentTrick = createMockTrick()
      const gameState = createMockGameState(
        players,
        completedTricks as Trick[],
        currentTrick
      )

      const playableCards = napoleon.hand
      const cardCounting = createMockCardCounting()

      const result = solveEndgame(
        playableCards,
        gameState,
        napoleon,
        cardCounting,
        3
      )

      expect(result).toBeDefined()
      expect(result?.expectedValue).toBeDefined()
      expect(typeof result?.expectedValue).toBe('number')
    })
  })
})
