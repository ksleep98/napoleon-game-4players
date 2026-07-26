/**
 * Tests for Game Result Server Actions
 */

import {
  calculateGameResultAction,
  checkGameDecisionAction,
  finalizeGameAction,
  getGameProgressAction,
} from '@/app/actions/gameResultActions'
import { AUTH_ERRORS, GAME_PHASES } from '@/lib/constants'
import type { GameResult, GameState } from '@/types/game'

// Mock all dependencies
jest.mock('@/lib/cookies/sessionCookies', () => ({
  getSessionCookie: jest.fn(),
  isSessionValid: jest.fn(),
  refreshSession: jest.fn(),
  setSessionCookie: jest.fn(),
  shouldExtendSession: jest.fn(),
}))

jest.mock('@/lib/game/gameStateRepository', () => ({
  requireGameState: jest.fn(),
  fetchGameState: jest.fn(),
  GAME_NOT_FOUND_MESSAGE: 'Game not found',
}))

jest.mock('@/app/actions/gameActions', () => ({
  saveGameResultAction: jest.fn(),
  saveGameStateAction: jest.fn(),
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
  saveGameResultAction,
  saveGameStateAction,
} from '@/app/actions/gameActions'
import { GameActionError } from '@/lib/errors/GameActionError'
import { requireGameState } from '@/lib/game/gameStateRepository'
import {
  calculateGameResult,
  getGameProgress,
  getTeamFaceCardCounts,
  isGameDecided,
} from '@/lib/scoring'
import { validateGameId } from '@/lib/supabase/server'
import {
  mockAuthenticatedSession,
  mockNoSession,
} from '../../utils/sessionTestUtils'

// Mock data creators
const createGameState = (
  phase: GameState['phase'] = GAME_PHASES.FINISHED
): GameState => ({
  id: 'test-game',
  players: [
    {
      id: 'player-1',
      name: 'Alice',
      hand: [],
      isNapoleon: false,
      isAdjutant: false,
      position: 1,
      isAI: false,
    },
  ],
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
    mockAuthenticatedSession('player-1')
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('calculateGameResultAction', () => {
    it('should calculate game result successfully', async () => {
      const gameState = createGameState(GAME_PHASES.FINISHED)
      const gameResult = createGameResult()

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)

      const result = await calculateGameResultAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(gameResult)
      expect(calculateGameResult).toHaveBeenCalledWith(gameState)
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await calculateGameResultAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when game ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await calculateGameResultAction('invalid', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid game ID')
    })

    it('should return error when game not found', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockRejectedValue(
        new GameActionError('Game not found', 'NOT_FOUND')
      )

      const result = await calculateGameResultAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })

    it('should return error when game not finished', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)

      const result = await calculateGameResultAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not finished yet')
    })
  })

  describe('checkGameDecisionAction', () => {
    it('should check game decision when decided', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)
      const gameResult = createGameResult()

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(isGameDecided as jest.Mock).mockReturnValue({ decided: true })
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)

      const result = await checkGameDecisionAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data?.isDecided).toBe(true)
      expect(result.data?.result).toEqual(gameResult)
    })

    it('should check game decision when not decided', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(isGameDecided as jest.Mock).mockReturnValue({ decided: false })

      const result = await checkGameDecisionAction('game-1', 'player-1')

      expect(result.success).toBe(true)
      expect(result.data?.isDecided).toBe(false)
      expect(result.data?.result).toBeUndefined()
      expect(calculateGameResult).not.toHaveBeenCalled()
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await checkGameDecisionAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when game not found', async () => {
      ;(requireGameState as jest.Mock).mockRejectedValue(
        new GameActionError('Game not found', 'NOT_FOUND')
      )

      const result = await checkGameDecisionAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })
  })

  describe('finalizeGameAction', () => {
    it('should finalize already finished game', async () => {
      const gameState = createGameState(GAME_PHASES.FINISHED)
      const gameResult = createGameResult()

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
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

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
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

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(isGameDecided as jest.Mock).mockReturnValue({ decided: false })

      const result = await finalizeGameAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not ready to finalize')
    })

    it('should return error when save result fails', async () => {
      const gameState = createGameState(GAME_PHASES.FINISHED)
      const gameResult = createGameResult()

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(calculateGameResult as jest.Mock).mockReturnValue(gameResult)
      ;(saveGameResultAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await finalizeGameAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save game result')
    })

    it('should return error when save state fails', async () => {
      const gameState = createGameState(GAME_PHASES.FINISHED)
      const gameResult = createGameResult()

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
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

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
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
      mockNoSession()

      const result = await getGameProgressAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when game not found', async () => {
      ;(requireGameState as jest.Mock).mockRejectedValue(
        new GameActionError('Game not found', 'NOT_FOUND')
      )

      const result = await getGameProgressAction('game-1', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })
  })
})
