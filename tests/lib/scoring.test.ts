import { initializeGame } from '@/lib/gameLogic'
import {
  calculateGameResult,
  getGameProgress,
  getPlayerTrickCount,
  getTeamTrickCounts,
  isGameDecided,
} from '@/lib/scoring'
import type { GameState, Trick } from '@/types/game'

describe('Scoring', () => {
  let mockGameState: GameState

  beforeEach(() => {
    const playerNames = ['Player 1', 'Player 2', 'Player 3', 'Player 4']
    mockGameState = initializeGame(playerNames)

    // Set up Napoleon and Adjutant
    mockGameState.players[0].isNapoleon = true
    mockGameState.players[1].isAdjutant = true
    mockGameState.tricks = []
  })

  describe('getTeamTrickCounts', () => {
    it('should calculate correct counts with no completed tricks', () => {
      const counts = getTeamTrickCounts(mockGameState)
      expect(counts.napoleonTeam).toBe(0)
      expect(counts.citizenTeam).toBe(0)
    })

    it('should calculate correct counts with some completed tricks', () => {
      const tricks: Trick[] = [
        {
          id: 'trick1',
          cards: [],
          completed: true,
          winnerPlayerId: 'player_1', // Napoleon wins
        },
        {
          id: 'trick2',
          cards: [],
          completed: true,
          winnerPlayerId: 'player_3', // Citizen wins
        },
        {
          id: 'trick3',
          cards: [],
          completed: true,
          winnerPlayerId: 'player_2', // Adjutant wins
        },
      ]

      mockGameState.tricks = tricks
      const counts = getTeamTrickCounts(mockGameState)

      expect(counts.napoleonTeam).toBe(2) // Napoleon + Adjutant
      expect(counts.citizenTeam).toBe(1) // Citizens
    })
  })

  describe('getGameProgress', () => {
    it('should calculate correct progress with no completed tricks', () => {
      const progress = getGameProgress(mockGameState)
      expect(progress.napoleonTeamTricks).toBe(0)
      expect(progress.citizenTeamTricks).toBe(0)
      expect(progress.tricksPlayed).toBe(0)
      expect(progress.tricksRemaining).toBe(12)
      expect(progress.napoleonNeedsToWin).toBe(8)
    })

    it('should calculate correct progress with some completed tricks', () => {
      mockGameState.tricks = [
        {
          id: 'trick1',
          cards: [],
          completed: true,
          winnerPlayerId: 'player_1',
        },
        {
          id: 'trick2',
          cards: [],
          completed: true,
          winnerPlayerId: 'player_3',
        },
      ]

      const progress = getGameProgress(mockGameState)

      expect(progress.napoleonTeamTricks).toBe(1) // Napoleon won 1 trick
      expect(progress.citizenTeamTricks).toBe(1) // Citizen won 1 trick
      expect(progress.tricksPlayed).toBe(2)
      expect(progress.tricksRemaining).toBe(10)
      expect(progress.napoleonNeedsToWin).toBe(7) // 8 - 1 = 7
    })
  })

  describe('isGameDecided', () => {
    it('should return false for undecided game', () => {
      const decision = isGameDecided(mockGameState)
      expect(decision.decided).toBe(false)
    })

    it('should return true when Napoleon team reaches target', () => {
      // Mock Napoleon team winning 8 tricks
      mockGameState.tricks = Array(8)
        .fill(null)
        .map((_, i) => ({
          id: `trick${i}`,
          cards: [],
          completed: true,
          winnerPlayerId: 'player_1',
        }))

      const decision = isGameDecided(mockGameState)
      expect(decision.decided).toBe(true)
      expect(decision.napoleonWon).toBe(true)
      expect(decision.reason).toBe('Napoleon team reached target tricks')
    })

    it('should return true when Napoleon team cannot reach target', () => {
      // Mock Napoleon team winning only 3 tricks with 4 tricks remaining
      mockGameState.tricks = [
        ...Array(3)
          .fill(null)
          .map((_, i) => ({
            id: `napoleon-trick${i}`,
            cards: [],
            completed: true,
            winnerPlayerId: 'player_1',
          })),
        ...Array(5)
          .fill(null)
          .map((_, i) => ({
            id: `citizen-trick${i}`,
            cards: [],
            completed: true,
            winnerPlayerId: 'player_3',
          })),
      ]

      const decision = isGameDecided(mockGameState)
      expect(decision.decided).toBe(true)
      expect(decision.napoleonWon).toBe(false)
      expect(decision.reason).toBe('Napoleon team cannot reach target tricks')
    })
  })

  describe('getPlayerTrickCount', () => {
    it('should count tricks won by specific player', () => {
      mockGameState.tricks = [
        {
          id: 'trick1',
          cards: [],
          completed: true,
          winnerPlayerId: 'player_1',
        },
        {
          id: 'trick2',
          cards: [],
          completed: true,
          winnerPlayerId: 'player_1',
        },
        {
          id: 'trick3',
          cards: [],
          completed: true,
          winnerPlayerId: 'player_3',
        },
      ]

      expect(getPlayerTrickCount(mockGameState, 'player_1')).toBe(2)
      expect(getPlayerTrickCount(mockGameState, 'player_3')).toBe(1)
      expect(getPlayerTrickCount(mockGameState, 'player_2')).toBe(0)
    })
  })

  describe('calculateGameResult', () => {
    it('should calculate Napoleon team victory', () => {
      // Mock Napoleon team winning 8+ tricks
      mockGameState.tricks = Array(8)
        .fill(null)
        .map((_, i) => ({
          id: `trick${i}`,
          cards: [],
          completed: true,
          winnerPlayerId: 'player_1',
        }))

      const result = calculateGameResult(mockGameState)
      expect(result.napoleonWon).toBe(true)
      expect(result.napoleonPlayerId).toBe('player_1')
      expect(result.tricksWon).toBe(8)

      const napoleonScore = result.scores.find((s) => s.playerId === 'player_1')
      expect(napoleonScore?.isWinner).toBe(true)
      expect(napoleonScore?.points).toBeGreaterThan(0)
    })

    it('should calculate Citizen victory', () => {
      // Mock Napoleon team winning only 7 tricks
      mockGameState.tricks = [
        ...Array(7)
          .fill(null)
          .map((_, i) => ({
            id: `napoleon-trick${i}`,
            cards: [],
            completed: true,
            winnerPlayerId: 'player_1',
          })),
        ...Array(5)
          .fill(null)
          .map((_, i) => ({
            id: `citizen-trick${i}`,
            cards: [],
            completed: true,
            winnerPlayerId: 'player_3',
          })),
      ]

      const result = calculateGameResult(mockGameState)
      expect(result.napoleonWon).toBe(false)
      expect(result.tricksWon).toBe(7)

      const citizenScore = result.scores.find((s) => s.playerId === 'player_3')
      expect(citizenScore?.isWinner).toBe(true)
    })
  })
})
