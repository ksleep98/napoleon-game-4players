/**
 * Tests for Game Result Server Actions
 */

import {
  calculateGameResultAction,
  checkGameDecisionAction,
  finalizeGameAction,
  getGameProgressAction,
} from '@/app/actions/gameResultActions'
import { GAME_PHASES } from '@/lib/constants'
import type { GameResult, GameState } from '@/types/game'

// Mock all dependencies
jest.mock('@/app/actions/gameActions', () => ({
  loadGameStateAction: jest.fn(),
  saveGameResultAction: jest.fn(),
  saveGameStateAction: jest.fn(),
  validateSessionAction: jest.fn(),
}))

jest.mock('@/lib/scoring', () => ({
  calculateGameResult: jest.fn(),
  getGameProgress: jest.fn(),
  getTeamFaceCardCounts: jest.fn(),
  isGameDecided: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  validateGameId: jest.fn(),
}))

// Import mocked functions
import {
  loadGameStateAction,
  saveGameResultAction,
  saveGameStateAction,
  validateSessionAction,
} from '@/app/actions/gameActions'
import {
  calculateGameResult,
  getGameProgress,
  getTeamFaceCardCounts,
  isGameDecided,
} from '@/lib/scoring'
import { validateGameId } from '@/lib/supabase/server'

// Mock data creators
const createGameState = (
  phase: GameState['phase'] = GAME_PHASES.FINISHED
): GameState => ({
  id: 'test-game',
  players: [],
  phase,
  currentPlayerIndex: 0,
  currentTrick: { id: 'trick-1', cards: [], completed: false },
  tricks: [],
  hiddenCards: [],
  trumpSuit: 'spades',
  passedPlayers: [],
  declarationTurn: 0,
  needsRedeal: false,
  createdAt: new Date(),
  updatedAt: new Date(),
})

const createGameResult = (): GameResult => ({
  gameId: 'test-game',
  napoleonWon: true,
  napoleonPlayerId: 'player-1',
  faceCardsWon: 15,
  scores: [],
})

describe('Game Result Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('calculateGameResultAction', () => {
    it('should calculate game result successfully', async () => {
      const gameState = createGameState(GAME_PHASES.FINISHED)
      const gameResult = createGameResult()

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)

      const result = await calculateGameResultAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(gameResult)
      expect(calculateGameResult).toHaveBeenCalledWith(gameState)
    })

    it('should return error when session invalid', async () => {
      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: false,
      })

      const result = await calculateGameResultAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid session')
    })

    it('should return error when game ID invalid', async () => {
      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await calculateGameResultAction('invalid', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid game ID')
    })

    it('should return error when game not found', async () => {
      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: false,
      })

      const result = await calculateGameResultAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })

    it('should return error when game not finished', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })

      const result = await calculateGameResultAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not finished yet')
    })
  })

  describe('checkGameDecisionAction', () => {
    it('should check game decision when decided', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)
      const gameResult = createGameResult()

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(isGameDecided as jest.Mock).mockReturnValue({ decided: true })
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)

      const result = await checkGameDecisionAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data?.isDecided).toBe(true)
      expect(result.data?.result).toEqual(gameResult)
    })

    it('should check game decision when not decided', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(isGameDecided as jest.Mock).mockReturnValue({ decided: false })

      const result = await checkGameDecisionAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data?.isDecided).toBe(false)
      expect(result.data?.result).toBeUndefined()
      expect(calculateGameResult).not.toHaveBeenCalled()
    })

    it('should return error when session invalid', async () => {
      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: false,
      })

      const result = await checkGameDecisionAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid session')
    })

    it('should return error when game not found', async () => {
      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: false,
      })

      const result = await checkGameDecisionAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })
  })

  describe('finalizeGameAction', () => {
    it('should finalize already finished game', async () => {
      const gameState = createGameState(GAME_PHASES.FINISHED)
      const gameResult = createGameResult()

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)
      ;(saveGameResultAction as jest.Mock).mockResolvedValue({ success: true })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await finalizeGameAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data?.gameState).toEqual(gameState)
      expect(result.data?.result).toEqual(gameResult)
      expect(saveGameResultAction).toHaveBeenCalledWith(gameResult, 'player-1')
      expect(saveGameStateAction).toHaveBeenCalledWith(gameState, 'player-1')
    })

    it('should finalize decided but not finished game', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)
      const gameResult = createGameResult()
      const finishedGameState = {
        ...gameState,
        phase: GAME_PHASES.FINISHED,
      }

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(isGameDecided as jest.Mock).mockReturnValue({ decided: true })
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)
      ;(saveGameResultAction as jest.Mock).mockResolvedValue({ success: true })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await finalizeGameAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data?.gameState.phase).toBe(GAME_PHASES.FINISHED)
      expect(saveGameStateAction).toHaveBeenCalledWith(
        finishedGameState,
        'player-1'
      )
    })

    it('should return error when game not ready to finalize', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(isGameDecided as jest.Mock).mockReturnValue({ decided: false })

      const result = await finalizeGameAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not ready to finalize')
    })

    it('should return error when save result fails', async () => {
      const gameState = createGameState(GAME_PHASES.FINISHED)
      const gameResult = createGameResult()

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)
      ;(saveGameResultAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await finalizeGameAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save game result')
    })

    it('should return error when save state fails', async () => {
      const gameState = createGameState(GAME_PHASES.FINISHED)
      const gameResult = createGameResult()

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)
      ;(saveGameResultAction as jest.Mock).mockResolvedValue({ success: true })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await finalizeGameAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save final game state')
    })
  })

  describe('getGameProgressAction', () => {
    it('should get game progress successfully', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)
      const progress = {
        completedTricks: 6,
        totalTricks: 12,
        percentage: 0.5,
      }
      const teamCounts = {
        napoleonTeamFaceCards: 8,
        allianceTeamFaceCards: 4,
        remainingFaceCards: 8,
      }

      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: true,
        gameState,
      })
      ;(getGameProgress as jest.Mock).mockReturnValue(progress)
      ;(getTeamFaceCardCounts as jest.Mock).mockReturnValue(teamCounts)

      const result = await getGameProgressAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data?.progress).toEqual(progress)
      expect(result.data?.teamCounts).toEqual(teamCounts)
      expect(getGameProgress).toHaveBeenCalledWith(gameState)
      expect(getTeamFaceCardCounts).toHaveBeenCalledWith(gameState)
    })

    it('should return error when session invalid', async () => {
      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: false,
      })

      const result = await getGameProgressAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid session')
    })

    it('should return error when game not found', async () => {
      ;(validateSessionAction as jest.Mock).mockResolvedValue({
        success: true,
      })
      ;(loadGameStateAction as jest.Mock).mockResolvedValue({
        success: false,
      })

      const result = await getGameProgressAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })
  })
})
