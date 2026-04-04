/**
 * Tests for Game State Server Actions
 */

import { saveGameStateAction } from '@/app/actions/gameActions'
import { GAME_PHASES } from '@/lib/constants'
import type { GameState } from '@/types/game'

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

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}))

import { revalidatePath } from 'next/cache'
// Import mocked functions
import {
  checkRateLimit,
  diagnoseServiceRoleKey,
  supabaseAdmin,
  validateGameId,
  validatePlayerId,
} from '@/lib/supabase/server'

// Mock fetch globally
global.fetch = jest.fn()

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
    {
      id: 'player-2',
      name: 'Bob',
      hand: [],
      isNapoleon: false,
      isAdjutant: false,
      position: 2,
      isAI: false,
    },
  ],
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

describe('Game State Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()

    // Default environment setup
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock_service_role_key'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://mock.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock_anon_key'
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('saveGameStateAction', () => {
    it('should save game state successfully', async () => {
      const gameState = createGameState()

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: true,
        isNewApiKey: false,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: [{ id: 'test-game' }],
          error: null,
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await saveGameStateAction(gameState, 'player-1')

      expect(result.success).toBe(true)
      expect(revalidatePath).toHaveBeenCalledWith('/game/test-game')
    })

    it('should return error when service role key missing', async () => {
      const gameState = createGameState()

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: false,
        isNewApiKey: false,
      })

      const result = await saveGameStateAction(gameState, 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Service Role Key is required')
    })

    it('should return error when game ID invalid', async () => {
      const gameState = createGameState()

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: true,
        isNewApiKey: false,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(false)

      const result = await saveGameStateAction(gameState, 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid game ID')
    })

    it('should return error when player ID invalid', async () => {
      const gameState = createGameState()

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: true,
        isNewApiKey: false,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await saveGameStateAction(gameState, 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Invalid player ID')
    })

    it('should return error when rate limit exceeded', async () => {
      const gameState = createGameState()

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: true,
        isNewApiKey: false,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(false)

      const result = await saveGameStateAction(gameState, 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Rate limit exceeded')
    })

    it('should return error when player not in game', async () => {
      const gameState = createGameState()

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: true,
        isNewApiKey: false,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const result = await saveGameStateAction(gameState, 'player-999')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Player not in game')
    })

    it('should return error when database upsert fails', async () => {
      const gameState = createGameState()

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: true,
        isNewApiKey: false,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error', code: 'DB_ERROR' },
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await saveGameStateAction(gameState, 'player-1')

      expect(result.success).toBe(false)
      expect(result.error).toContain('Database operation failed')
    })

    it('should use REST API fallback on 401 error', async () => {
      const gameState = createGameState()

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: true,
        isNewApiKey: false,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error: { message: '401 Unauthorized' },
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      // Mock successful REST API call
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: jest.fn().mockResolvedValue(JSON.stringify({ success: true })),
      })

      const result = await saveGameStateAction(gameState, 'player-1')

      expect(result.success).toBe(true)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/rest/v1/games'),
        expect.objectContaining({
          method: 'POST',
        })
      )
    })

    it('should handle finished game phase correctly', async () => {
      const gameState = createGameState()
      gameState.phase = GAME_PHASES.FINISHED
      gameState.players[0].isNapoleon = true

      ;(diagnoseServiceRoleKey as jest.Mock).mockReturnValue({
        exists: true,
        isNewApiKey: false,
      })
      ;(validateGameId as jest.Mock).mockReturnValue(true)
      ;(validatePlayerId as jest.Mock).mockReturnValue(true)
      ;(checkRateLimit as jest.Mock).mockReturnValue(true)

      const mockFrom = jest.fn().mockReturnValue({
        upsert: jest.fn().mockImplementation((data) => {
          expect(data.winner_team).toBe('napoleon')
          return Promise.resolve({
            data: [{ id: 'test-game' }],
            error: null,
          })
        }),
      })
      ;(supabaseAdmin.from as jest.Mock).mockImplementation(mockFrom)

      const result = await saveGameStateAction(gameState, 'player-1')

      expect(result.success).toBe(true)
    })
  })
})
