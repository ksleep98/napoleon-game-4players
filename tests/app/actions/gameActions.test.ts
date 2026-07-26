/**
 * Tests for Core Game Server Actions
 */

import {
  createPlayerAction,
  createPlayersAction,
  loadGameStateAction,
  saveGameResultAction,
  validateSessionAction,
} from '@/app/actions/gameActions'
import { GAME_PHASES } from '@/lib/constants'
import type { GameResult, GameState } from '@/types/game'

// Mock all dependencies
jest.mock('@/lib/supabase/server', () => ({
  checkRateLimit: jest.fn(),
  supabaseAdmin: {
    from: jest.fn(),
  },
  validateGameId: jest.fn(),
  validatePlayerId: jest.fn(),
  diagnoseServiceRoleKey: jest.fn(),
}))

jest.mock('@/lib/cookies/sessionCookies', () => ({
  getSessionCookie: jest.fn(),
  isSessionValid: jest.fn(),
  refreshSession: jest.fn(),
  setSessionCookie: jest.fn(),
  shouldExtendSession: jest.fn(),
}))

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

// Import mocked functions
import {
  checkRateLimit,
  supabaseAdmin,
  validateGameId,
  validatePlayerId,
} from '@/lib/supabase/server'
import { mockAuthenticatedSession } from '../../utils/sessionTestUtils'

// Mock data creators
const createGameState = (): GameState => ({
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

const createGameResult = (): GameResult => ({
  gameId: 'test-game',
  napoleonWon: true,
  napoleonPlayerId: 'player-1',
  faceCardsWon: 15,
  scores: [],
})

describe('Core Game Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthenticatedSession('player-1')
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('validateSessionAction', () => {
    it('should validate session successfully', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'player-1',
                connected: true,
                created_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await validateSessionAction('player-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(true)
    })

    it('should return valid=false when player not found', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await validateSessionAction('player-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(false)
    })

    it('should return valid=false when session expired (stale)', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      // Session older than 24 hours
      const staleDate = new Date()
      staleDate.setHours(staleDate.getHours() - 25)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'player-1',
                connected: true,
                created_at: staleDate.toISOString(),
              },
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await validateSessionAction('player-1')

      expect(result.success).toBe(true)
      expect(result.valid).toBe(false)
    })

    it('should return error when player ID invalid', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await validateSessionAction('invalid-player')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })
  })

  describe('loadGameStateAction', () => {
    it('should load game state successfully', async () => {
      const gameState = createGameState()

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'test-game', state: gameState },
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await loadGameStateAction('test-game', 'player-1')

      expect(result.success).toBe(true)
      expect(result.gameState).toEqual(gameState)
    })

    it('should return error when game ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await loadGameStateAction('invalid', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid game ID')
    })

    it('should return error when player ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await loadGameStateAction('test-game', 'invalid')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })

    it('should return error when rate limit exceeded', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(false)

      const result = await loadGameStateAction('test-game', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should return error when game not found', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await loadGameStateAction('test-game', 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })

    it('should return error when player not in game', async () => {
      const gameState = createGameState()

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'test-game', state: gameState },
              error: null,
            }),
          }),
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      // 認証済みだがゲームに参加していないプレイヤー
      mockAuthenticatedSession('player-999')

      const result = await loadGameStateAction('test-game', 'player-999')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Player not in game')
    })
  })

  describe('saveGameResultAction', () => {
    it('should save game result successfully', async () => {
      const gameResult = createGameResult()

      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: {},
          error: null,
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await saveGameResultAction(gameResult, 'player-1')

      expect(result.success).toBe(true)
    })

    it('should return error when game ID invalid', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await saveGameResultAction(createGameResult(), 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid game ID')
    })

    it('should return error when database insert fails', async () => {
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await saveGameResultAction(createGameResult(), 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to save game result')
    })
  })

  describe('createPlayerAction', () => {
    it('should create player successfully', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: { id: 'player-1', name: 'Alice' },
          error: null,
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await createPlayerAction('player-1', 'Alice')

      expect(result.success).toBe(true)
    })

    it('should return error when player ID invalid', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await createPlayerAction('invalid', 'Alice')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })

    it('should return error when rate limit exceeded', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(false)

      const result = await createPlayerAction('player-1', 'Alice')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })
  })

  describe('createPlayersAction', () => {
    it('should create multiple players successfully', async () => {
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: [
            { id: 'player-1', name: 'Alice' },
            { id: 'player-2', name: 'Bob' },
          ],
          error: null,
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await createPlayersAction([
        { id: 'player-1', name: 'Alice' },
        { id: 'player-2', name: 'Bob' },
      ])

      expect(result.success).toBe(true)
    })

    it('should return error when players array is empty', async () => {
      const result = await createPlayersAction([])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid players array')
    })

    it('should return error when rate limit exceeded', async () => {
      ;(checkRateLimit as jest.Mock).mockReturnValue(false)

      const result = await createPlayersAction([
        { id: 'player-1', name: 'Alice' },
      ])

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should return error when database insert fails', async () => {
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await createPlayersAction([
        { id: 'player-1', name: 'Alice' },
      ])

      expect(result.success).toBe(false)
      expect(result.error).toContain('Failed to create players')
    })
  })
})
