/**
 * Tests for endgame strategy functions
 */

import {
  analyzeEndgameState,
  shouldPlayAggressively,
  shouldPlayConservatively,
} from '@/lib/ai/strategies/endgame'
import type { WinningRequirements } from '@/lib/ai/strategies/types'
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
  handSize = 5
): Player => ({
  id,
  name: `Player ${id}`,
  hand: Array(handSize).fill(createCard('spades', '5', 5)),
  isNapoleon,
  isAdjutant,
  isAI: true,
  position: 1,
})

// Mock game state creator
const createGameState = (
  tricks: Trick[] = [],
  napoleonTarget = 12
): GameState => ({
  id: 'test-game',
  players: [
    createPlayer('p1', true, false),
    createPlayer('p2', false, true),
    createPlayer('p3', false, false),
    createPlayer('p4', false, false),
  ],
  phase: GAME_PHASES.PLAYING,
  currentPlayerIndex: 0,
  currentTrick: { id: 'current', cards: [], completed: false },
  tricks,
  hiddenCards: [],
  trumpSuit: 'spades',
  napoleonDeclaration: {
    playerId: 'p1',
    suit: 'spades',
    targetTricks: napoleonTarget,
  },
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

describe('Endgame Strategies', () => {
  describe('analyzeEndgameState', () => {
    it('should identify endgame when 3 or fewer tricks remain', () => {
      const tricks = Array(9).fill({
        id: 'trick',
        cards: [],
        completed: true,
      })
      const gameState = createGameState(tricks)
      const player = gameState.players[0]

      const result = analyzeEndgameState(gameState, player)

      expect(result.isEndgame).toBe(true)
      expect(result.remainingTricks).toBe(3)
    })

    it('should not identify endgame when more than 3 tricks remain', () => {
      const tricks = Array(7).fill({
        id: 'trick',
        cards: [],
        completed: true,
      })
      const gameState = createGameState(tricks)
      const player = gameState.players[0]

      const result = analyzeEndgameState(gameState, player)

      expect(result.isEndgame).toBe(false)
      expect(result.remainingTricks).toBe(5)
    })

    it('should calculate remaining tricks correctly', () => {
      const scenarios = [
        { completed: 0, expected: 12 },
        { completed: 6, expected: 6 },
        { completed: 11, expected: 1 },
        { completed: 12, expected: 0 },
      ]

      scenarios.forEach(({ completed, expected }) => {
        const tricks = Array(completed).fill({
          id: 'trick',
          cards: [],
          completed: true,
        })
        const gameState = createGameState(tricks)
        const player = gameState.players[0]

        const result = analyzeEndgameState(gameState, player)

        expect(result.remainingTricks).toBe(expected)
      })
    })

    it('should track remaining cards in hand', () => {
      const gameState = createGameState([])
      const player = createPlayer('p1', false, false, 8)

      const result = analyzeEndgameState(gameState, player)

      expect(result.remainingCardsInHand).toBe(8)
    })

    it('should identify Napoleon victory when target met', () => {
      const gameState = createGameState([], 5)
      // Create tricks with Napoleon team winning face cards
      gameState.tricks = Array(5).fill({
        id: 'trick',
        cards: [
          {
            playerId: 'p1',
            card: createCard('spades', 'K', 13),
            order: 0,
          },
        ],
        completed: true,
        winnerPlayerId: 'p1', // Napoleon wins
      })

      const player = gameState.players[0]
      const result = analyzeEndgameState(gameState, player)

      expect(result.canSecureNapoleonVictory).toBe(true)
    })

    it('should identify alliance victory when Napoleon cannot win', () => {
      const gameState = createGameState([], 15) // Impossible target
      const player = gameState.players[0]

      const result = analyzeEndgameState(gameState, player)

      // Napoleon needs 15 but only 13 face cards exist
      expect(result.canSecureAllianceVictory).toBe(true)
    })
  })

  describe('shouldPlayConservatively', () => {
    const createRequirements = (
      napoleonNeedsToWin: number,
      allianceNeedsToBlock: number,
      napoleonCanAffordToLose: number = 0,
      remainingTricks: number = 5
    ): WinningRequirements => ({
      napoleonTeamFaceCards: 0,
      allianceTeamFaceCards: 0,
      remainingFaceCards: 5,
      remainingTricks,
      napoleonNeedsToWin,
      allianceNeedsToBlock,
      napoleonCanAffordToLose,
      isNapoleonAhead: false,
      isAllianceAhead: false,
      isCriticalPhase: false,
    })

    it('should play conservatively when Napoleon already achieved target', () => {
      const player = createPlayer('p1', true, false)
      const requirements = createRequirements(0, 5) // Napoleon needs 0 more

      const result = shouldPlayConservatively(player, requirements)

      expect(result).toBe(true)
    })

    it('should play conservatively when Napoleon has comfortable lead', () => {
      const player = createPlayer('p1', true, false)
      const requirements = createRequirements(2, 3, 3, 6) // Can afford to lose 3

      const result = shouldPlayConservatively(player, requirements)

      expect(result).toBe(true)
    })

    it('should not play conservatively when Napoleon is behind', () => {
      const player = createPlayer('p1', true, false)
      const requirements = createRequirements(5, 1, 0, 5)

      const result = shouldPlayConservatively(player, requirements)

      expect(result).toBe(false)
    })

    it('should play conservatively when alliance already blocked Napoleon', () => {
      const player = createPlayer('p3', false, false) // Alliance player
      const requirements = createRequirements(5, 0) // Alliance needs 0 more

      const result = shouldPlayConservatively(player, requirements)

      expect(result).toBe(true)
    })

    it('should play conservatively when Napoleon cannot win', () => {
      const player = createPlayer('p3', false, false) // Alliance player
      const requirements = createRequirements(6, 3, 0, 4) // Napoleon needs 6 with only 4 tricks left

      const result = shouldPlayConservatively(player, requirements)

      expect(result).toBe(true)
    })

    it('should not play conservatively for adjutant when target not met', () => {
      const player = createPlayer('p2', false, true) // Adjutant
      const requirements = createRequirements(3, 5, 1, 5)

      const result = shouldPlayConservatively(player, requirements)

      expect(result).toBe(false)
    })
  })

  describe('shouldPlayAggressively', () => {
    const createRequirements = (
      napoleonNeedsToWin: number,
      allianceNeedsToBlock: number,
      isNapoleonAhead: boolean = false,
      isCriticalPhase: boolean = false,
      remainingTricks: number = 5
    ): WinningRequirements => ({
      napoleonTeamFaceCards: 0,
      allianceTeamFaceCards: 0,
      remainingFaceCards: 5,
      remainingTricks,
      napoleonNeedsToWin,
      allianceNeedsToBlock,
      napoleonCanAffordToLose: 0,
      isNapoleonAhead,
      isAllianceAhead: false,
      isCriticalPhase,
    })

    it('should play aggressively when Napoleon needs 1-2 cards in critical phase', () => {
      const player = createPlayer('p1', true, false)
      const requirements = createRequirements(1, 5, false, true)

      const result = shouldPlayAggressively(player, requirements)

      expect(result).toBe(true)
    })

    it('should play aggressively when Napoleon is behind (needs half of remaining tricks)', () => {
      const player = createPlayer('p1', true, false)
      const requirements = createRequirements(3, 2, false, false, 6) // Needs 3 out of 6

      const result = shouldPlayAggressively(player, requirements)

      expect(result).toBe(true)
    })

    it('should not play aggressively when Napoleon is ahead and not critical', () => {
      const player = createPlayer('p1', true, false)
      const requirements = createRequirements(1, 5, true, false)

      const result = shouldPlayAggressively(player, requirements)

      expect(result).toBe(false)
    })

    it('should play aggressively when alliance faces Napoleon advantage in critical phase', () => {
      const player = createPlayer('p3', false, false) // Alliance
      const requirements = createRequirements(2, 3, true, true) // Napoleon ahead, critical

      const result = shouldPlayAggressively(player, requirements)

      expect(result).toBe(true)
    })

    it('should play aggressively when alliance faces Napoleon close to target', () => {
      const player = createPlayer('p3', false, false) // Alliance
      const requirements = createRequirements(1, 5, false, false) // Napoleon needs only 1

      const result = shouldPlayAggressively(player, requirements)

      expect(result).toBe(true)
    })

    it('should not play aggressively for alliance when Napoleon needs many cards', () => {
      const player = createPlayer('p3', false, false) // Alliance
      const requirements = createRequirements(8, 2, false, false)

      const result = shouldPlayAggressively(player, requirements)

      expect(result).toBe(false)
    })

    it('should work for adjutant player same as Napoleon', () => {
      const player = createPlayer('p2', false, true) // Adjutant
      const requirements = createRequirements(2, 5, false, true)

      const result = shouldPlayAggressively(player, requirements)

      expect(result).toBe(true)
    })
  })
})
