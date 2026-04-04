/**
 * Tests for trump strategy functions
 */

import {
  isAllianceWinning,
  isNapoleonWinning,
  shouldInterventWithTrump,
  shouldLeadWithTrump,
} from '@/lib/ai/strategies/trumps'
import type { HandComposition, TrumpTracking } from '@/lib/ai/strategies/types'
import { GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, Player, Trick } from '@/types/game'

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

// Mock player creator
const createPlayer = (
  id: string,
  isNapoleon = false,
  isAdjutant = false,
  hand: Card[] = []
): Player => ({
  id,
  name: `Player ${id}`,
  hand,
  isNapoleon,
  isAdjutant,
  isAI: true,
  position: 1,
})

// Mock game state creator
const createGameState = (
  players: Player[],
  trumpSuit: Card['suit'] = 'spades',
  tricks: Trick[] = []
): GameState => ({
  id: 'test-game',
  players,
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  currentTrick: { id: 'current', cards: [], completed: false },
  tricks,
  hiddenCards: [],
  trumpSuit,
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

// Mock trick creator
const createTrick = (
  cards: Array<{ playerId: string; card: Card; order: number }>
): Trick => ({
  id: 'trick-1',
  cards,
  completed: false,
})

// Mock trump tracking creator
const createTrumpTracking = (myTrumps: Card[] = []): TrumpTracking => ({
  myTrumps,
  playedTrumps: [],
  remainingTrumps: 13,
  myStrongestTrump: myTrumps.length > 0 ? myTrumps[0] : null,
  hasHighTrumps: false,
  trumpsStrongerThanMine: 0,
})

// Mock hand composition creator
const createHandComposition = (trumpCount: number = 0): HandComposition => ({
  trumpCount,
  suitCounts: new Map([
    ['spades', 0],
    ['hearts', 0],
    ['diamonds', 0],
    ['clubs', 0],
  ]),
  faceCardsBySuit: new Map(),
  totalFaceCards: 0,
  voidSuits: [],
  shortSuits: [],
})

describe('Trump Strategy Functions', () => {
  describe('isNapoleonWinning', () => {
    it('should return true when Napoleon has the winning card', () => {
      const napoleon = createPlayer('p1', true, false)
      const players = [
        napoleon,
        createPlayer('p2', false, false),
        createPlayer('p3', false, false),
      ]
      const gameState = createGameState(players)

      const trick = createTrick([
        { playerId: 'p1', card: createCard('hearts', 'K', 13), order: 0 },
        { playerId: 'p2', card: createCard('hearts', '5', 5), order: 1 },
        { playerId: 'p3', card: createCard('hearts', '7', 7), order: 2 },
      ])

      const result = isNapoleonWinning(trick, gameState)

      expect(result).toBe(true)
    })

    it('should return true when Adjutant has the winning card', () => {
      const napoleon = createPlayer('p1', true, false)
      const adjutant = createPlayer('p2', false, true)
      const players = [napoleon, adjutant, createPlayer('p3', false, false)]
      const gameState = createGameState(players)

      const trick = createTrick([
        { playerId: 'p1', card: createCard('hearts', '5', 5), order: 0 },
        { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 1 },
        { playerId: 'p3', card: createCard('hearts', '7', 7), order: 2 },
      ])

      const result = isNapoleonWinning(trick, gameState)

      expect(result).toBe(true)
    })

    it('should return false when Alliance has the winning card', () => {
      const napoleon = createPlayer('p1', true, false)
      const players = [
        napoleon,
        createPlayer('p2', false, false),
        createPlayer('p3', false, false),
      ]
      const gameState = createGameState(players)

      const trick = createTrick([
        { playerId: 'p1', card: createCard('hearts', '5', 5), order: 0 },
        { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 1 },
      ])

      const result = isNapoleonWinning(trick, gameState)

      expect(result).toBe(false)
    })

    it('should return false when Napoleon is not found', () => {
      const players = [
        createPlayer('p1', false, false),
        createPlayer('p2', false, false),
      ]
      const gameState = createGameState(players)

      const trick = createTrick([
        { playerId: 'p1', card: createCard('hearts', 'K', 13), order: 0 },
      ])

      const result = isNapoleonWinning(trick, gameState)

      expect(result).toBe(false)
    })
  })

  describe('isAllianceWinning', () => {
    it('should return true when Alliance player has the winning card', () => {
      const napoleon = createPlayer('p1', true, false)
      const players = [
        napoleon,
        createPlayer('p2', false, false),
        createPlayer('p3', false, false),
      ]
      const gameState = createGameState(players)

      const trick = createTrick([
        { playerId: 'p1', card: createCard('hearts', '5', 5), order: 0 },
        { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 1 },
        { playerId: 'p3', card: createCard('hearts', '7', 7), order: 2 },
      ])

      const result = isAllianceWinning(trick, gameState)

      expect(result).toBe(true)
    })

    it('should return false when Napoleon has the winning card', () => {
      const napoleon = createPlayer('p1', true, false)
      const players = [
        napoleon,
        createPlayer('p2', false, false),
        createPlayer('p3', false, false),
      ]
      const gameState = createGameState(players)

      const trick = createTrick([
        { playerId: 'p1', card: createCard('hearts', 'K', 13), order: 0 },
        { playerId: 'p2', card: createCard('hearts', '5', 5), order: 1 },
      ])

      const result = isAllianceWinning(trick, gameState)

      expect(result).toBe(false)
    })

    it('should return false when Adjutant has the winning card', () => {
      const napoleon = createPlayer('p1', true, false)
      const adjutant = createPlayer('p2', false, true)
      const players = [napoleon, adjutant, createPlayer('p3', false, false)]
      const gameState = createGameState(players)

      const trick = createTrick([
        { playerId: 'p1', card: createCard('hearts', '5', 5), order: 0 },
        { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 1 },
      ])

      const result = isAllianceWinning(trick, gameState)

      expect(result).toBe(false)
    })

    it('should return false when Napoleon is not found', () => {
      const players = [
        createPlayer('p1', false, false),
        createPlayer('p2', false, false),
      ]
      const gameState = createGameState(players)

      const trick = createTrick([
        { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 0 },
      ])

      const result = isAllianceWinning(trick, gameState)

      expect(result).toBe(false)
    })
  })

  describe('shouldInterventWithTrump', () => {
    it('should return false when player has no trumps', () => {
      const player = createPlayer('p1', false, false)
      const gameState = createGameState([player], 'spades')
      const trick = createTrick([
        { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 0 },
      ])
      const playableCards = [createCard('hearts', '5', 5)]
      const trumpTracking = createTrumpTracking([])

      const result = shouldInterventWithTrump(
        playableCards,
        trick,
        gameState,
        player,
        trumpTracking
      )

      expect(result).toBe(false)
    })

    it('should return true for Napoleon when Alliance is winning with 2+ face cards', () => {
      const napoleon = createPlayer('p1', true, false)
      const gameState = createGameState([napoleon], 'spades')
      const trick = createTrick([
        { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 0 },
        { playerId: 'p3', card: createCard('hearts', 'Q', 12), order: 1 },
      ])
      const playableCards = [createCard('spades', '8', 8)]
      const trumpTracking = createTrumpTracking([createCard('spades', '8', 8)])

      const result = shouldInterventWithTrump(
        playableCards,
        trick,
        gameState,
        napoleon,
        trumpTracking
      )

      expect(result).toBe(true)
    })

    it('should return true for Alliance when Napoleon is winning', () => {
      const napoleon = createPlayer('p1', true, false)
      const alliance = createPlayer('p2', false, false)
      const gameState = createGameState([napoleon, alliance], 'spades')
      const trick = createTrick([
        { playerId: 'p1', card: createCard('hearts', 'K', 13), order: 0 },
      ])
      const playableCards = [createCard('spades', '8', 8)]
      const trumpTracking = createTrumpTracking([createCard('spades', '8', 8)])

      const result = shouldInterventWithTrump(
        playableCards,
        trick,
        gameState,
        alliance,
        trumpTracking
      )

      expect(result).toBe(true)
    })

    it('should return false when player has only weak trumps and few face cards', () => {
      const player = createPlayer('p1', false, false)
      const gameState = createGameState([player], 'spades')
      const trick = createTrick([
        { playerId: 'p2', card: createCard('hearts', '8', 8), order: 0 },
      ])
      const playableCards = [createCard('spades', '3', 3)]
      const trumpTracking = createTrumpTracking([createCard('spades', '3', 3)])

      const result = shouldInterventWithTrump(
        playableCards,
        trick,
        gameState,
        player,
        trumpTracking
      )

      expect(result).toBe(false)
    })

    it('should return false when trump already in trick and cannot win', () => {
      const player = createPlayer('p1', false, false)
      const gameState = createGameState([player], 'spades')
      const trick = createTrick([
        { playerId: 'p2', card: createCard('spades', 'A', 14), order: 0 },
      ])
      const playableCards = [createCard('spades', '5', 5)]
      const trumpTracking = createTrumpTracking([createCard('spades', '5', 5)])

      const result = shouldInterventWithTrump(
        playableCards,
        trick,
        gameState,
        player,
        trumpTracking
      )

      expect(result).toBe(false)
    })

    it('should return true for Alliance when 3+ face cards in trick', () => {
      const alliance = createPlayer('p1', false, false)
      const gameState = createGameState([alliance], 'spades')
      const trick = createTrick([
        { playerId: 'p2', card: createCard('hearts', 'K', 13), order: 0 },
        { playerId: 'p3', card: createCard('hearts', 'Q', 12), order: 1 },
        { playerId: 'p4', card: createCard('hearts', 'J', 11), order: 2 },
      ])
      const playableCards = [createCard('spades', '8', 8)]
      const trumpTracking = createTrumpTracking([createCard('spades', '8', 8)])

      const result = shouldInterventWithTrump(
        playableCards,
        trick,
        gameState,
        alliance,
        trumpTracking
      )

      expect(result).toBe(true)
    })
  })

  describe('shouldLeadWithTrump', () => {
    it('should return false when player has no trumps', () => {
      const player = createPlayer('p1', false, false)
      const gameState = createGameState([player], 'spades')
      const hand: Card[] = [createCard('hearts', 'K', 13)]
      const composition = createHandComposition(0)

      const result = shouldLeadWithTrump(hand, gameState, player, composition)

      expect(result).toBe(false)
    })

    it('should return true for Napoleon in endgame with 2+ trumps', () => {
      const napoleon = createPlayer('p1', true, false)
      const completedTricks = Array(9).fill({
        id: 'trick',
        cards: [],
        completed: true,
      }) // 75% progress
      const gameState = createGameState([napoleon], 'spades', completedTricks)
      const hand: Card[] = [
        createCard('spades', '8', 8),
        createCard('spades', '9', 9),
      ]
      const composition = createHandComposition(2)

      const result = shouldLeadWithTrump(hand, gameState, napoleon, composition)

      expect(result).toBe(true)
    })

    it('should return true for Napoleon in midgame with strong trumps', () => {
      const napoleon = createPlayer('p1', true, false)
      const completedTricks = Array(6).fill({
        id: 'trick',
        cards: [],
        completed: true,
      }) // 50% progress
      const gameState = createGameState([napoleon], 'spades', completedTricks)
      const hand: Card[] = [createCard('spades', 'A', 14)]
      const composition = createHandComposition(1)

      const result = shouldLeadWithTrump(hand, gameState, napoleon, composition)

      expect(result).toBe(true)
    })

    it('should return true for Alliance in early game with weak trumps', () => {
      const alliance = createPlayer('p1', false, false)
      const completedTricks = Array(2).fill({
        id: 'trick',
        cards: [],
        completed: true,
      }) // 16% progress
      const gameState = createGameState([alliance], 'spades', completedTricks)
      const hand: Card[] = [createCard('spades', '3', 3)]
      const composition = createHandComposition(1)

      const result = shouldLeadWithTrump(hand, gameState, alliance, composition)

      expect(result).toBe(true)
    })

    it('should return false for Alliance in early game with 3+ weak trumps', () => {
      const alliance = createPlayer('p1', false, false)
      const completedTricks = Array(2).fill({
        id: 'trick',
        cards: [],
        completed: true,
      })
      const gameState = createGameState([alliance], 'spades', completedTricks)
      const hand: Card[] = [
        createCard('spades', '2', 2),
        createCard('spades', '3', 3),
        createCard('spades', '4', 4),
      ]
      const composition = createHandComposition(3)

      const result = shouldLeadWithTrump(hand, gameState, alliance, composition)

      expect(result).toBe(false)
    })

    it('should return false for Napoleon in early game', () => {
      const napoleon = createPlayer('p1', true, false)
      const completedTricks = Array(2).fill({
        id: 'trick',
        cards: [],
        completed: true,
      }) // 16% progress
      const gameState = createGameState([napoleon], 'spades', completedTricks)
      const hand: Card[] = [createCard('spades', '8', 8)]
      const composition = createHandComposition(1)

      const result = shouldLeadWithTrump(hand, gameState, napoleon, composition)

      expect(result).toBe(false)
    })

    it('should work for Adjutant same as Napoleon', () => {
      const adjutant = createPlayer('p1', false, true)
      const completedTricks = Array(9).fill({
        id: 'trick',
        cards: [],
        completed: true,
      })
      const gameState = createGameState([adjutant], 'spades', completedTricks)
      const hand: Card[] = [
        createCard('spades', '8', 8),
        createCard('spades', '9', 9),
      ]
      const composition = createHandComposition(2)

      const result = shouldLeadWithTrump(hand, gameState, adjutant, composition)

      expect(result).toBe(true)
    })
  })
})
