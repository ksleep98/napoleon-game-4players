/**
 * Tests for AI strategy helper functions
 */

import {
  calculateGameProgress,
  getBestTrickCard,
  getCardStrengthSafe,
  getLowestWinningCard,
  getWeakestCard,
  getWeakestNonFaceCard,
  isFaceCard,
} from '@/lib/ai/strategies/helpers'
import { GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, Trick } from '@/types/game'

// Mock card creator
const createCard = (
  suit: Card['suit'],
  rank: Card['rank'],
  value: number
): Card => ({
  id: `${suit}-${rank}`,
  suit,
  rank,
  value,
})

// Mock game state creator
const createGameState = (trumpSuit: Card['suit'] = 'spades'): GameState => ({
  id: 'test-game',
  players: [],
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [],
  trumpSuit,
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('AI Strategy Helpers', () => {
  describe('isFaceCard', () => {
    it('should return true for face cards (10, J, Q, K, A)', () => {
      expect(isFaceCard(createCard('spades', '10', 10))).toBe(true)
      expect(isFaceCard(createCard('hearts', 'J', 11))).toBe(true)
      expect(isFaceCard(createCard('diamonds', 'Q', 12))).toBe(true)
      expect(isFaceCard(createCard('clubs', 'K', 13))).toBe(true)
      expect(isFaceCard(createCard('spades', 'A', 14))).toBe(true)
    })

    it('should return false for non-face cards (2-9)', () => {
      expect(isFaceCard(createCard('spades', '2', 2))).toBe(false)
      expect(isFaceCard(createCard('hearts', '3', 3))).toBe(false)
      expect(isFaceCard(createCard('diamonds', '5', 5))).toBe(false)
      expect(isFaceCard(createCard('clubs', '9', 9))).toBe(false)
    })
  })

  describe('getCardStrengthSafe', () => {
    it('should return strength for trump card', () => {
      const gameState = createGameState('spades')
      const card = createCard('spades', 'A', 14)

      const strength = getCardStrengthSafe(card, gameState)

      expect(strength).toBeGreaterThan(0)
      expect(typeof strength).toBe('number')
    })

    it('should return strength for non-trump card', () => {
      const gameState = createGameState('spades')
      const card = createCard('hearts', 'K', 13)

      const strength = getCardStrengthSafe(card, gameState)

      expect(strength).toBeGreaterThan(0)
      expect(typeof strength).toBe('number')
    })

    it('should handle game state without current trick', () => {
      const gameState = createGameState('diamonds')
      const card = createCard('clubs', 'Q', 12)

      expect(() => getCardStrengthSafe(card, gameState)).not.toThrow()
    })
  })

  describe('getBestTrickCard', () => {
    it('should return the strongest card in trick', () => {
      const gameState = createGameState('spades')
      const trick: Trick = {
        id: 'trick-1',
        cards: [
          { playerId: 'p1', card: createCard('hearts', '5', 5), order: 0 },
          { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 1 },
          { playerId: 'p3', card: createCard('hearts', '9', 9), order: 2 },
        ],
        completed: false,
      }

      const result = getBestTrickCard(trick, gameState)

      expect(result.card.rank).toBe('K')
      expect(result.card.suit).toBe('hearts')
      expect(result.strength).toBeGreaterThan(0)
    })

    it('should return the only card if trick has one card', () => {
      const gameState = createGameState('clubs')
      const singleCard = createCard('diamonds', '7', 7)
      const trick: Trick = {
        id: 'trick-1',
        cards: [{ playerId: 'p1', card: singleCard, order: 0 }],
        completed: false,
      }

      const result = getBestTrickCard(trick, gameState)

      expect(result.card).toEqual(singleCard)
    })

    // 空トリックに「最強カード」は存在しない。以前は undefined を参照して
    // 意味不明な TypeError になっていたので、意図の分かる例外に変える。
    // 呼び出し側は必ずリード局面をガードすること。
    it('should throw a descriptive error for an empty trick', () => {
      const gameState = createGameState('spades')
      const emptyTrick: Trick = {
        id: 'trick-1',
        cards: [],
        completed: false,
      }

      expect(() => getBestTrickCard(emptyTrick, gameState)).toThrow(
        /empty trick/i
      )
    })
  })

  describe('getLowestWinningCard', () => {
    it('should return lowest card that can win the trick', () => {
      const gameState = createGameState('spades')
      const trick: Trick = {
        id: 'trick-1',
        cards: [
          { playerId: 'p1', card: createCard('hearts', '9', 9), order: 0 },
        ],
        completed: false,
      }

      const availableCards = [
        createCard('hearts', 'A', 14),
        createCard('hearts', 'K', 13),
        createCard('hearts', '10', 10),
        createCard('hearts', '7', 7),
      ]

      const result = getLowestWinningCard(availableCards, trick, gameState)

      // Should return 10 (lowest card that beats 9)
      expect(result.rank).toBe('10')
    })

    it('should return any card if no cards can win', () => {
      const gameState = createGameState('spades')
      const trick: Trick = {
        id: 'trick-1',
        cards: [
          { playerId: 'p1', card: createCard('hearts', 'A', 14), order: 0 },
        ],
        completed: false,
      }

      const availableCards = [
        createCard('hearts', '2', 2),
        createCard('hearts', '3', 3),
      ]

      const result = getLowestWinningCard(availableCards, trick, gameState)

      // Should return first card since none can win
      expect(result).toBe(availableCards[0])
    })

    // リード局面では「勝つために必要な最弱カード」は定義できないので、
    // 手札の最弱カードを返して落ちないようにする。
    it('should fall back to the weakest card for an empty trick', () => {
      const gameState = createGameState('spades')
      const emptyTrick: Trick = {
        id: 'trick-1',
        cards: [],
        completed: false,
      }

      const availableCards = [
        createCard('hearts', 'A', 14),
        createCard('hearts', '3', 3),
        createCard('hearts', 'K', 13),
      ]

      const result = getLowestWinningCard(availableCards, emptyTrick, gameState)

      expect(result.rank).toBe('3')
    })
  })

  describe('getWeakestCard', () => {
    it('should return the weakest card from array', () => {
      const gameState = createGameState('diamonds')
      const cards = [
        createCard('clubs', 'K', 13),
        createCard('clubs', '3', 3),
        createCard('clubs', '9', 9),
        createCard('clubs', 'A', 14),
      ]

      const result = getWeakestCard(cards, gameState)

      expect(result.rank).toBe('3')
    })

    it('should handle single card array', () => {
      const gameState = createGameState('hearts')
      const cards = [createCard('spades', 'Q', 12)]

      const result = getWeakestCard(cards, gameState)

      expect(result).toBe(cards[0])
    })
  })

  describe('getWeakestNonFaceCard', () => {
    it('should return weakest non-face card', () => {
      const gameState = createGameState('spades')
      const cards = [
        createCard('hearts', 'K', 13),
        createCard('hearts', '7', 7),
        createCard('hearts', 'A', 14),
        createCard('hearts', '4', 4),
      ]

      const result = getWeakestNonFaceCard(cards, gameState)

      expect(result?.rank).toBe('4')
    })

    it('should return null if all cards are face cards', () => {
      const gameState = createGameState('clubs')
      const cards = [
        createCard('diamonds', 'K', 13),
        createCard('diamonds', 'A', 14),
        createCard('diamonds', 'Q', 12),
        createCard('diamonds', 'J', 11),
      ]

      const result = getWeakestNonFaceCard(cards, gameState)

      expect(result).toBeNull()
    })

    it('should ignore face cards and only consider 2-9', () => {
      const gameState = createGameState('hearts')
      const cards = [
        createCard('spades', '10', 10),
        createCard('spades', '9', 9),
        createCard('spades', 'J', 11),
        createCard('spades', '5', 5),
      ]

      const result = getWeakestNonFaceCard(cards, gameState)

      // Should return 5, ignoring 10 and J
      expect(result?.rank).toBe('5')
    })
  })

  describe('calculateGameProgress', () => {
    it('should return 0 at game start', () => {
      const gameState = createGameState()
      gameState.tricks = []

      const progress = calculateGameProgress(gameState)

      expect(progress).toBe(0)
    })

    it('should return 0.5 at midgame (6 tricks completed)', () => {
      const gameState = createGameState()
      gameState.tricks = Array(6).fill({
        id: 'trick',
        cards: [],
        completed: true,
      })

      const progress = calculateGameProgress(gameState)

      expect(progress).toBe(0.5)
    })

    it('should return 1.0 at game end (12 tricks completed)', () => {
      const gameState = createGameState()
      gameState.tricks = Array(12).fill({
        id: 'trick',
        cards: [],
        completed: true,
      })

      const progress = calculateGameProgress(gameState)

      expect(progress).toBe(1.0)
    })

    it('should return correct progress for any number of tricks', () => {
      const gameState = createGameState()
      gameState.tricks = Array(3).fill({
        id: 'trick',
        cards: [],
        completed: true,
      })

      const progress = calculateGameProgress(gameState)

      expect(progress).toBe(0.25) // 3/12 = 0.25
    })
  })
})
