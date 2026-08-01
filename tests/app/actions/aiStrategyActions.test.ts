/**
 * Tests for AI Strategy Server Actions
 */

import {
  evaluateAIStrategyAction,
  processAITurnAction,
  selectAICardAction,
  simulateAIThinkingAction,
} from '@/app/actions/aiStrategyActions'
import { AUTH_ERRORS, GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, Player } from '@/types/game'

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
  saveGameStateAction: jest.fn(),
}))

jest.mock('@/lib/ai/strategicCardEvaluator', () => ({
  evaluateCardStrategicValue: jest.fn(),
  selectBestStrategicCard: jest.fn(),
}))

jest.mock('@/lib/gameLogic', () => ({
  processAITurn: jest.fn(),
}))

jest.mock('@/lib/napoleonRules', () => ({
  getNextDeclarationPlayer: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  validateGameId: jest.fn(),
}))

// Import mocked functions
import { saveGameStateAction } from '@/app/actions/gameActions'
import {
  evaluateCardStrategicValue,
  selectBestStrategicCard,
} from '@/lib/ai/strategicCardEvaluator'
import { GameActionError } from '@/lib/errors/GameActionError'
import { requireGameState } from '@/lib/game/gameStateRepository'
import { maskGameStateForPlayer } from '@/lib/game/maskGameState'
import { processAITurn } from '@/lib/gameLogic'
import { getNextDeclarationPlayer } from '@/lib/napoleonRules'
import { validateGameId } from '@/lib/supabase/server'
import {
  mockAuthenticatedSession,
  mockNoSession,
} from '../../utils/sessionTestUtils'

// Mock data creators
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

const createPlayer = (id: string, isAI = false, hand: Card[] = []): Player => ({
  id,
  name: `Player ${id}`,
  hand,
  isNapoleon: false,
  isAdjutant: false,
  isAI,
  position: 1,
})

const createGameState = (players: Player[]): GameState => ({
  id: 'test-game',
  players,
  phase: GAME_PHASES.PLAYING,
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

describe('AI Strategy Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthenticatedSession('p1')
    // 既定で有効なゲームIDとして扱う（個別テストで上書きする）
    ;(validateGameId as jest.Mock).mockReturnValue(true)
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('selectAICardAction', () => {
    it('should select AI card successfully', async () => {
      const card = createCard('spades', 'A', 14)
      const aiPlayer = createPlayer('ai-1', true, [card])
      const gameState = createGameState([aiPlayer, createPlayer('p1')])

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(selectBestStrategicCard as jest.Mock).mockReturnValue(card)

      const result = await selectAICardAction('game-1', 'p1', 'ai-1')

      expect(result.success).toBe(true)
      expect(result.data?.selectedCard).toEqual(card)
      expect(selectBestStrategicCard).toHaveBeenCalledWith(
        [card],
        gameState,
        aiPlayer
      )
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await selectAICardAction('game-1', 'p1', 'ai-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when game ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await selectAICardAction('invalid', 'p1', 'ai-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid game ID')
    })

    it('should return error when game not found', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockRejectedValue(
        new GameActionError('Game not found', 'NOT_FOUND')
      )

      const result = await selectAICardAction('game-1', 'p1', 'ai-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })

    it('should return error when AI player not found', async () => {
      const gameState = createGameState([createPlayer('p1')])

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)

      const result = await selectAICardAction('game-1', 'p1', 'ai-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('AI player not found')
    })

    it('should return error when no playable card found', async () => {
      const aiPlayer = createPlayer('ai-1', true, [])
      const gameState = createGameState([aiPlayer, createPlayer('p1')])

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(selectBestStrategicCard as jest.Mock).mockReturnValue(null)

      const result = await selectAICardAction('game-1', 'p1', 'ai-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('No playable card found')
    })
  })

  describe('processAITurnAction', () => {
    it('should process AI turn successfully in PLAYING phase', async () => {
      const aiPlayer = createPlayer('ai-1', true)
      const gameState = createGameState([aiPlayer, createPlayer('p1')])
      const updatedGameState = { ...gameState }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(processAITurn as jest.Mock).mockResolvedValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await processAITurnAction('game-1', 'p1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(
        maskGameStateForPlayer(updatedGameState, 'p1')
      )
      expect(processAITurn).toHaveBeenCalledWith(gameState)
      expect(saveGameStateAction).toHaveBeenCalledWith(updatedGameState, 'p1')
    })

    // COM が副官のとき、processAITurn と DB 保存には未マスクの isAdjutant が渡り、
    // クライアントへのレスポンスだけが伏せられることを保証する。
    // AI 評価層へ渡すビューのマスクは processAITurn の内側で行われるため
    // （tests/lib/game/aiAdjutantVisibility.test.ts）、ここで先にマスクしては
    // ならない。DB へ副官情報を保存できなくなる。
    it('passes the unmasked state to processAITurn and to the DB while masking the response', async () => {
      const aiAdjutant = { ...createPlayer('ai-1', true), isAdjutant: true }
      const gameState = createGameState([aiAdjutant, createPlayer('p1')])
      const updatedGameState = { ...gameState }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(processAITurn as jest.Mock).mockResolvedValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await processAITurnAction('game-1', 'p1')

      // processAITurn への入力は未マスク
      const stateGivenToAI = (processAITurn as jest.Mock).mock
        .calls[0][0] as GameState
      expect(
        stateGivenToAI.players.find((p) => p.id === 'ai-1')?.isAdjutant
      ).toBe(true)

      const savedState = (saveGameStateAction as jest.Mock).mock
        .calls[0][0] as GameState
      expect(savedState.players.find((p) => p.id === 'ai-1')?.isAdjutant).toBe(
        true
      )

      // クライアントへのレスポンスは伏せられている
      expect(
        result.data?.players.find((p) => p.id === 'ai-1')?.isAdjutant
      ).toBe(false)
    })

    it('should process AI turn in NAPOLEON phase', async () => {
      const aiPlayer = createPlayer('ai-1', true)
      const gameState = {
        ...createGameState([aiPlayer, createPlayer('p1')]),
        phase: GAME_PHASES.NAPOLEON,
      }
      const updatedGameState = { ...gameState }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(getNextDeclarationPlayer as jest.Mock).mockReturnValue(aiPlayer)
      ;(processAITurn as jest.Mock).mockResolvedValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await processAITurnAction('game-1', 'p1')

      expect(result.success).toBe(true)
      expect(getNextDeclarationPlayer).toHaveBeenCalledWith(gameState)
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await processAITurnAction('game-1', 'p1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when not AI turn', async () => {
      const humanPlayer = createPlayer('p1', false)
      const gameState = createGameState([humanPlayer])

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)

      const result = await processAITurnAction('game-1', 'p1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not AI turn')
    })

    it('should return error when save fails', async () => {
      const aiPlayer = createPlayer('ai-1', true)
      const gameState = createGameState([aiPlayer, createPlayer('p1')])
      const updatedGameState = { ...gameState }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(processAITurn as jest.Mock).mockResolvedValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await processAITurnAction('game-1', 'p1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save game state')
    })
  })

  describe('evaluateAIStrategyAction', () => {
    it('should evaluate AI strategy in non-production environment', async () => {
      // NODE_ENV is 'test' by default in Jest
      const cards = [
        createCard('spades', 'A', 14),
        createCard('hearts', 'K', 13),
      ]
      const gameState = createGameState([createPlayer('p1')])

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(evaluateCardStrategicValue as jest.Mock)
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(80)

      const result = await evaluateAIStrategyAction('game-1', 'p1', cards)

      expect(result.success).toBe(true)
      expect(result.data).toEqual([
        { card: cards[0], value: 100 },
        { card: cards[1], value: 80 },
      ])
    })

    it('should return error in production environment', async () => {
      // Mock production environment check
      const originalEnv = process.env.NODE_ENV
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: 'production',
        writable: true,
        configurable: true,
      })

      const result = await evaluateAIStrategyAction('game-1', 'p1', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Not available in production')

      // Restore original value
      Object.defineProperty(process.env, 'NODE_ENV', {
        value: originalEnv,
        writable: true,
        configurable: true,
      })
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await evaluateAIStrategyAction('game-1', 'p1', [])

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })
  })

  describe('simulateAIThinkingAction', () => {
    it('should simulate simple AI thinking', async () => {
      const result = await simulateAIThinkingAction('game-1', 'p1', 'simple')

      expect(result.success).toBe(true)
      expect(result.data?.thinkingTime).toBeGreaterThan(0)
      expect(result.data?.thinkingTime).toBeLessThan(1000) // Simple should be < 1s
    })

    it('should simulate normal AI thinking', async () => {
      const result = await simulateAIThinkingAction('game-1', 'p1', 'normal')

      expect(result.success).toBe(true)
      expect(result.data?.thinkingTime).toBeGreaterThan(0)
    })

    it('should simulate complex AI thinking', async () => {
      const result = await simulateAIThinkingAction('game-1', 'p1', 'complex')

      expect(result.success).toBe(true)
      expect(result.data?.thinkingTime).toBeGreaterThan(1000) // Complex should be > 1s
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await simulateAIThinkingAction('game-1', 'p1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })
  })
})
