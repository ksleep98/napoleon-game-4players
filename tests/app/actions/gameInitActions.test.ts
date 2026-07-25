/**
 * Tests for Game Initialization Server Actions
 */

import {
  initializeAIGameAction,
  initializeGameAction,
  reshuffleGameDeckAction,
} from '@/app/actions/gameInitActions'
import { AUTH_ERRORS, GAME_PHASES } from '@/lib/constants'
import type { GameState, Player } from '@/types/game'

// Mock all dependencies
jest.mock('@/lib/cookies/sessionCookies', () => ({
  getSessionCookie: jest.fn(),
  isSessionValid: jest.fn(),
}))

jest.mock('@/lib/game/gameStateRepository', () => ({
  requireGameState: jest.fn(),
  fetchGameState: jest.fn(),
  GAME_NOT_FOUND_MESSAGE: 'Game not found',
}))

jest.mock('@/app/actions/gameActions', () => ({
  saveGameStateAction: jest.fn(),
}))

jest.mock('@/lib/game/playerRepository', () => ({
  createPlayers: jest.fn(),
  ensurePlayerExists: jest.fn(),
}))

jest.mock('@/lib/gameLogic', () => ({
  initializeAIGame: jest.fn(),
  initializeGame: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  checkRateLimit: jest.fn(),
  validateGameId: jest.fn(),
}))

jest.mock('@/utils/cardUtils', () => ({
  dealCards: jest.fn(),
  generateGameId: jest.fn(),
  generatePlayerId: jest.fn(),
}))

// Import mocked functions
import { saveGameStateAction } from '@/app/actions/gameActions'
import { GameActionError } from '@/lib/errors/GameActionError'
import { requireGameState } from '@/lib/game/gameStateRepository'
import { createPlayers, ensurePlayerExists } from '@/lib/game/playerRepository'
import { initializeAIGame, initializeGame } from '@/lib/gameLogic'
import { checkRateLimit, validateGameId } from '@/lib/supabase/server'
import { dealCards, generateGameId, generatePlayerId } from '@/utils/cardUtils'
import {
  mockAuthenticatedSession,
  mockNoSession,
} from '../../utils/sessionTestUtils'

// Mock data creators
const createPlayer = (id: string, name: string, isAI = false): Player => ({
  id,
  name,
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI,
})

const createGameState = (): GameState => ({
  id: 'test-game',
  // 認可はゲーム参加者チェックを伴うため、既定で人間プレイヤー p1 を含める
  players: [createPlayer('p1', 'Alice')],
  phase: GAME_PHASES.NAPOLEON,
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

describe('Game Initialization Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthenticatedSession('host-id')
    ;(ensurePlayerExists as jest.Mock).mockResolvedValue({ success: true })
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('initializeGameAction', () => {
    it('should initialize game successfully', async () => {
      const playerNames = ['Alice', 'Bob', 'Carol', 'Dave']
      const players = playerNames.map((name, i) =>
        createPlayer(`player-${i}`, name)
      )
      const gameState = createGameState()

      ;(checkRateLimit as jest.Mock).mockReturnValue(true)
      ;(generateGameId as jest.Mock).mockReturnValue('game-123')
      ;(generatePlayerId as jest.Mock)
        .mockReturnValueOnce('player-0')
        .mockReturnValueOnce('player-1')
        .mockReturnValueOnce('player-2')
        .mockReturnValueOnce('player-3')
      ;(dealCards as jest.Mock).mockReturnValue({
        players,
        hiddenCards: [],
      })
      ;(initializeGame as jest.Mock).mockReturnValue(gameState)
      ;(createPlayers as jest.Mock).mockResolvedValue({ success: true })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await initializeGameAction(
        playerNames,
        'host-id',
        undefined,
        undefined
      )

      expect(result.success).toBe(true)
      expect(result.data?.gameId).toBe('game-123')
      expect(result.data?.gameState.players).toHaveLength(4)
      expect(dealCards).toHaveBeenCalled()
      expect(createPlayers).toHaveBeenCalled()
      expect(saveGameStateAction).toHaveBeenCalled()
    })

    it('should initialize game with provided player IDs', async () => {
      const playerNames = ['Alice', 'Bob', 'Carol', 'Dave']
      const playerIds = ['id-1', 'id-2', 'id-3', 'id-4']
      const players = playerNames.map((name, i) =>
        createPlayer(playerIds[i], name)
      )
      const gameState = createGameState()

      ;(checkRateLimit as jest.Mock).mockReturnValue(true)
      ;(generateGameId as jest.Mock).mockReturnValue('game-123')
      ;(dealCards as jest.Mock).mockReturnValue({
        players,
        hiddenCards: [],
      })
      ;(initializeGame as jest.Mock).mockReturnValue(gameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await initializeGameAction(
        playerNames,
        'host-id',
        playerIds,
        'room-1'
      )

      expect(result.success).toBe(true)
      expect(createPlayers).not.toHaveBeenCalled() // Skip when IDs provided
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await initializeGameAction(
        ['Alice', 'Bob', 'Carol', 'Dave'],
        'host-id'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when not exactly 4 players', async () => {
      const result = await initializeGameAction(
        ['Alice', 'Bob', 'Carol'],
        'host-id'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Must have exactly 4 players')
    })

    it('should return error when player name is invalid', async () => {
      const result = await initializeGameAction(
        ['Alice', '', 'Carol', 'Dave'],
        'host-id'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player name')
    })

    it('should return error when player name is too long', async () => {
      const result = await initializeGameAction(
        [
          'Alice',
          'BobWithAVeryLongNameThatExceeds20Characters',
          'Carol',
          'Dave',
        ],
        'host-id'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Player name too long')
    })

    it('should return error when rate limit exceeded', async () => {
      ;(checkRateLimit as jest.Mock).mockReturnValue(false)

      const result = await initializeGameAction(
        ['Alice', 'Bob', 'Carol', 'Dave'],
        'host-id'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should return error when player IDs count mismatch', async () => {
      const result = await initializeGameAction(
        ['Alice', 'Bob', 'Carol', 'Dave'],
        'host-id',
        ['id-1', 'id-2'] // Only 2 IDs
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Must provide exactly 4 player IDs')
    })

    it('should return error when create players fails', async () => {
      const playerNames = ['Alice', 'Bob', 'Carol', 'Dave']
      const players = playerNames.map((name, i) =>
        createPlayer(`player-${i}`, name)
      )
      const gameState = createGameState()

      ;(checkRateLimit as jest.Mock).mockReturnValue(true)
      ;(generateGameId as jest.Mock).mockReturnValue('game-123')
      ;(generatePlayerId as jest.Mock).mockReturnValue('player-id')
      ;(dealCards as jest.Mock).mockReturnValue({
        players,
        hiddenCards: [],
      })
      ;(initializeGame as jest.Mock).mockReturnValue(gameState)
      ;(createPlayers as jest.Mock).mockResolvedValue({ success: false })

      const result = await initializeGameAction(playerNames, 'host-id')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create players')
    })

    it('should return error when save fails', async () => {
      const playerNames = ['Alice', 'Bob', 'Carol', 'Dave']
      const players = playerNames.map((name, i) =>
        createPlayer(`player-${i}`, name)
      )
      const gameState = createGameState()

      ;(checkRateLimit as jest.Mock).mockReturnValue(true)
      ;(generateGameId as jest.Mock).mockReturnValue('game-123')
      ;(generatePlayerId as jest.Mock).mockReturnValue('player-id')
      ;(dealCards as jest.Mock).mockReturnValue({
        players,
        hiddenCards: [],
      })
      ;(initializeGame as jest.Mock).mockReturnValue(gameState)
      ;(createPlayers as jest.Mock).mockResolvedValue({ success: true })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await initializeGameAction(playerNames, 'host-id')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save game state')
    })
  })

  describe('initializeAIGameAction', () => {
    beforeEach(() => {
      mockAuthenticatedSession('human-1')
    })

    it('should initialize AI game successfully', async () => {
      const humanPlayer = createPlayer('human-1', 'Alice', false)
      const aiPlayers = [
        createPlayer('ai-1', 'AI Player 1', true),
        createPlayer('ai-2', 'AI Player 2', true),
        createPlayer('ai-3', 'AI Player 3', true),
      ]
      const gameState = createGameState()

      ;(checkRateLimit as jest.Mock).mockReturnValue(true)
      ;(generateGameId as jest.Mock).mockReturnValue('game-ai-123')
      ;(generatePlayerId as jest.Mock)
        .mockReturnValueOnce('ai-1')
        .mockReturnValueOnce('ai-2')
        .mockReturnValueOnce('ai-3')
      ;(dealCards as jest.Mock).mockReturnValue({
        players: [humanPlayer, ...aiPlayers],
        hiddenCards: [],
      })
      ;(initializeAIGame as jest.Mock).mockReturnValue(gameState)
      ;(createPlayers as jest.Mock).mockResolvedValue({ success: true })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await initializeAIGameAction('Alice', 'human-1')

      expect(result.success).toBe(true)
      expect(result.data?.gameId).toBe('game-ai-123')
      expect(result.data?.gameState.players).toHaveLength(4)
      expect(dealCards).toHaveBeenCalled()
      expect(createPlayers).toHaveBeenCalled()
      expect(saveGameStateAction).toHaveBeenCalled()
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await initializeAIGameAction('Alice', 'human-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when player name is invalid', async () => {
      const result = await initializeAIGameAction('', 'human-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player name')
    })

    it('should return error when player name is too long', async () => {
      const result = await initializeAIGameAction(
        'AliceWithAVeryLongNameThatExceeds20Characters',
        'human-1'
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player name length')
    })

    it('should return error when rate limit exceeded', async () => {
      ;(checkRateLimit as jest.Mock).mockReturnValue(false)

      const result = await initializeAIGameAction('Alice', 'human-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should return error when create players fails', async () => {
      const gameState = createGameState()

      ;(checkRateLimit as jest.Mock).mockReturnValue(true)
      ;(generateGameId as jest.Mock).mockReturnValue('game-ai-123')
      ;(generatePlayerId as jest.Mock).mockReturnValue('ai-id')
      ;(dealCards as jest.Mock).mockReturnValue({
        players: [createPlayer('ai-id', 'AI Player 1', true)],
        hiddenCards: [],
      })
      ;(initializeAIGame as jest.Mock).mockReturnValue(gameState)
      ;(createPlayers as jest.Mock).mockResolvedValue({ success: false })

      const result = await initializeAIGameAction('Alice', 'human-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to create players')
    })

    it('should return error when save fails', async () => {
      const gameState = createGameState()

      ;(checkRateLimit as jest.Mock).mockReturnValue(true)
      ;(generateGameId as jest.Mock).mockReturnValue('game-ai-123')
      ;(generatePlayerId as jest.Mock).mockReturnValue('ai-id')
      ;(dealCards as jest.Mock).mockReturnValue({
        players: [],
        hiddenCards: [],
      })
      ;(initializeAIGame as jest.Mock).mockReturnValue(gameState)
      ;(createPlayers as jest.Mock).mockResolvedValue({ success: true })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await initializeAIGameAction('Alice', 'human-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to save AI game state')
    })
  })

  describe('reshuffleGameDeckAction', () => {
    beforeEach(() => {
      mockAuthenticatedSession('p1')
    })

    it('should reshuffle deck successfully', async () => {
      const players = [
        createPlayer('p1', 'Alice'),
        createPlayer('p2', 'Bob'),
        createPlayer('p3', 'Carol'),
        createPlayer('p4', 'Dave'),
      ]
      const gameState = {
        ...createGameState(),
        players,
        phase: GAME_PHASES.NAPOLEON,
      }

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(dealCards as jest.Mock).mockReturnValue({
        players,
        hiddenCards: [],
      })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await reshuffleGameDeckAction(
        'game-1',
        'p1',
        'Too few face cards'
      )

      expect(result.success).toBe(true)
      expect(result.data?.reshuffleCount).toBe(1)
      expect(result.data?.lastReshuffleReason).toBe('Too few face cards')
      expect(dealCards).toHaveBeenCalled()
      expect(saveGameStateAction).toHaveBeenCalled()
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await reshuffleGameDeckAction('game-1', 'p1', 'reason')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when game ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await reshuffleGameDeckAction('invalid', 'p1', 'reason')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid game ID')
    })

    it('should return error when game not found', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockRejectedValue(
        new GameActionError('Game not found', 'NOT_FOUND')
      )

      const result = await reshuffleGameDeckAction('game-1', 'p1', 'reason')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })

    it('should return error when not in NAPOLEON phase', async () => {
      const gameState = {
        ...createGameState(),
        phase: GAME_PHASES.PLAYING,
      }

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)

      const result = await reshuffleGameDeckAction('game-1', 'p1', 'reason')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Can only reshuffle during napoleon phase')
    })

    it('should return error when save fails', async () => {
      const gameState = {
        ...createGameState(),
        phase: GAME_PHASES.NAPOLEON,
      }

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(dealCards as jest.Mock).mockReturnValue({
        players: [],
        hiddenCards: [],
      })
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await reshuffleGameDeckAction('game-1', 'p1', 'reason')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save reshuffled game state')
    })
  })
})
