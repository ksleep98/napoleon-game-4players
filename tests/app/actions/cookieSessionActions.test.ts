/**
 * Tests for Cookie Session Server Actions
 */

import {
  clearSessionAction,
  createSessionAction,
  getSessionAction,
  refreshSessionAction,
  validateSessionAction,
} from '@/app/actions/cookieSessionActions'
import { SESSION_ERRORS } from '@/lib/constants'
import type { SessionCookieData } from '@/lib/cookies/sessionCookies'

// Mock all dependencies
jest.mock('@/lib/cookies/sessionCookies', () => ({
  clearSessionCookie: jest.fn(),
  getSessionCookie: jest.fn(),
  isSessionValid: jest.fn(),
  refreshSession: jest.fn(),
  setSessionCookie: jest.fn(),
}))

jest.mock('@/lib/supabase/client', () => ({
  setPlayerSession: jest.fn(),
}))

jest.mock('@/utils/encryption', () => ({
  generateSessionToken: jest.fn(),
}))

jest.mock('@/lib/game/playerRepository', () => ({
  playerExists: jest.fn(),
}))

jest.mock('@/lib/supabase/server', () => ({
  checkRateLimit: jest.fn(),
  validatePlayerId: jest.fn(),
}))

// Import mocked functions
import {
  clearSessionCookie,
  getSessionCookie,
  isSessionValid,
  refreshSession,
  setSessionCookie,
} from '@/lib/cookies/sessionCookies'
import { playerExists } from '@/lib/game/playerRepository'
import { setPlayerSession } from '@/lib/supabase/client'
import { checkRateLimit, validatePlayerId } from '@/lib/supabase/server'
import { generateSessionToken } from '@/utils/encryption'

// Mock session data creator
const createMockSession = (
  playerId = 'player-1',
  playerName = 'Test Player'
): SessionCookieData => ({
  playerId,
  playerName,
  sessionToken: 'mock-token',
  createdAt: Date.now(),
  expiresAt: Date.now() + 86400000,
})

describe('Cookie Session Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // 既定は「未使用の playerId を自己申告で確保できる」状態
    ;(validatePlayerId as jest.Mock).mockReturnValue(true)
    ;(checkRateLimit as jest.Mock).mockReturnValue(true)
    ;(playerExists as jest.Mock).mockResolvedValue(false)
    // Suppress console errors in tests
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('createSessionAction', () => {
    it('should create session successfully', async () => {
      ;(generateSessionToken as jest.Mock).mockReturnValue('generated-token')
      ;(setSessionCookie as jest.Mock).mockResolvedValue(undefined)
      ;(setPlayerSession as jest.Mock).mockResolvedValue(undefined)

      const result = await createSessionAction('player-1', 'Player One')

      expect(result.success).toBe(true)
      expect(generateSessionToken).toHaveBeenCalledWith('player-1')
      expect(setSessionCookie).toHaveBeenCalledWith(
        expect.objectContaining({
          playerId: 'player-1',
          playerName: 'Player One',
          sessionToken: 'generated-token',
        })
      )
      expect(setPlayerSession).toHaveBeenCalledWith('player-1')
    })

    it('should return error when playerId is empty', async () => {
      const result = await createSessionAction('', 'Player One')

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.REQUIRED)
      expect(setSessionCookie).not.toHaveBeenCalled()
    })

    it('should return error when playerName is empty', async () => {
      const result = await createSessionAction('player-1', '')

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.REQUIRED)
      expect(setSessionCookie).not.toHaveBeenCalled()
    })

    it('refuses to mint a session for an EXISTING playerId (impersonation)', async () => {
      ;(playerExists as jest.Mock).mockResolvedValue(true)
      ;(getSessionCookie as jest.Mock).mockResolvedValue(null)

      const result = await createSessionAction('victim-player', 'Attacker')

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.PLAYER_ID_TAKEN)
      expect(setSessionCookie).not.toHaveBeenCalled()
    })

    it('refuses impersonation even when holding a session for another player', async () => {
      ;(playerExists as jest.Mock).mockResolvedValue(true)
      ;(getSessionCookie as jest.Mock).mockResolvedValue(
        createMockSession('attacker-player')
      )
      ;(isSessionValid as jest.Mock).mockReturnValue(true)

      const result = await createSessionAction('victim-player', 'Attacker')

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.PLAYER_ID_TAKEN)
      expect(setSessionCookie).not.toHaveBeenCalled()
    })

    it('allows re-issuing a session for a playerId the caller already owns', async () => {
      ;(playerExists as jest.Mock).mockResolvedValue(true)
      ;(getSessionCookie as jest.Mock).mockResolvedValue(
        createMockSession('player-1')
      )
      ;(isSessionValid as jest.Mock).mockReturnValue(true)
      ;(generateSessionToken as jest.Mock).mockReturnValue('generated-token')
      ;(setSessionCookie as jest.Mock).mockResolvedValue(undefined)
      ;(setPlayerSession as jest.Mock).mockResolvedValue(undefined)

      const result = await createSessionAction('player-1', 'Renamed')

      expect(result.success).toBe(true)
      expect(setSessionCookie).toHaveBeenCalled()
    })

    it('rejects an invalid playerId format', async () => {
      ;(validatePlayerId as jest.Mock).mockReturnValue(false)

      const result = await createSessionAction('bad id!', 'Player One')

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.INVALID_PLAYER_ID)
      expect(setSessionCookie).not.toHaveBeenCalled()
    })

    it('rejects when the session creation rate limit is exceeded', async () => {
      ;(checkRateLimit as jest.Mock).mockReturnValue(false)

      const result = await createSessionAction('player-1', 'Player One')

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.RATE_LIMITED)
      expect(setSessionCookie).not.toHaveBeenCalled()
    })

    it('should succeed even if RLS setup fails', async () => {
      ;(generateSessionToken as jest.Mock).mockReturnValue('generated-token')
      ;(setSessionCookie as jest.Mock).mockResolvedValue(undefined)
      ;(setPlayerSession as jest.Mock).mockRejectedValue(new Error('RLS error'))

      const result = await createSessionAction('player-1', 'Player One')

      expect(result.success).toBe(true)
      expect(console.warn).toHaveBeenCalledWith(
        '[Session] RLS setup warning:',
        expect.any(Error)
      )
    })

    it('should handle unexpected errors', async () => {
      ;(generateSessionToken as jest.Mock).mockImplementation(() => {
        throw new Error('Unexpected error')
      })

      const result = await createSessionAction('player-1', 'Player One')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unexpected error')
    })
  })

  describe('getSessionAction', () => {
    it('should get valid session successfully', async () => {
      const mockSession = createMockSession()
      ;(getSessionCookie as jest.Mock).mockResolvedValue(mockSession)
      ;(isSessionValid as jest.Mock).mockReturnValue(true)
      ;(setPlayerSession as jest.Mock).mockResolvedValue(undefined)

      const result = await getSessionAction()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockSession)
      expect(setPlayerSession).toHaveBeenCalledWith('player-1')
    })

    it('should return error when session not found', async () => {
      ;(getSessionCookie as jest.Mock).mockResolvedValue(null)

      const result = await getSessionAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.NOT_FOUND)
    })

    it('should clear expired session', async () => {
      const mockSession = createMockSession()
      ;(getSessionCookie as jest.Mock).mockResolvedValue(mockSession)
      ;(isSessionValid as jest.Mock).mockReturnValue(false)
      ;(clearSessionCookie as jest.Mock).mockResolvedValue(undefined)

      const result = await getSessionAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.EXPIRED)
      expect(clearSessionCookie).toHaveBeenCalled()
    })

    it('should succeed even if RLS setup fails', async () => {
      const mockSession = createMockSession()
      ;(getSessionCookie as jest.Mock).mockResolvedValue(mockSession)
      ;(isSessionValid as jest.Mock).mockReturnValue(true)
      ;(setPlayerSession as jest.Mock).mockRejectedValue(new Error('RLS error'))

      const result = await getSessionAction()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockSession)
      expect(console.warn).toHaveBeenCalledWith(
        '[Session] RLS setup warning:',
        expect.any(Error)
      )
    })
  })

  describe('clearSessionAction', () => {
    it('should clear session successfully', async () => {
      ;(clearSessionCookie as jest.Mock).mockResolvedValue(undefined)

      const result = await clearSessionAction()

      expect(result.success).toBe(true)
      expect(clearSessionCookie).toHaveBeenCalled()
    })

    it('should handle errors when clearing session', async () => {
      ;(clearSessionCookie as jest.Mock).mockRejectedValue(
        new Error('Clear error')
      )

      const result = await clearSessionAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Clear error')
    })
  })

  describe('validateSessionAction', () => {
    it('should validate valid session', async () => {
      const mockSession = createMockSession()
      ;(getSessionCookie as jest.Mock).mockResolvedValue(mockSession)
      ;(isSessionValid as jest.Mock).mockReturnValue(true)

      const result = await validateSessionAction()

      expect(result.success).toBe(true)
      expect(result.data?.valid).toBe(true)
      expect(result.data?.session).toEqual(mockSession)
    })

    it('should return invalid when session not found', async () => {
      ;(getSessionCookie as jest.Mock).mockResolvedValue(null)

      const result = await validateSessionAction()

      expect(result.success).toBe(true)
      expect(result.data?.valid).toBe(false)
      expect(result.data?.session).toBeUndefined()
    })

    it('should clear invalid session', async () => {
      const mockSession = createMockSession()
      ;(getSessionCookie as jest.Mock).mockResolvedValue(mockSession)
      ;(isSessionValid as jest.Mock).mockReturnValue(false)
      ;(clearSessionCookie as jest.Mock).mockResolvedValue(undefined)

      const result = await validateSessionAction()

      expect(result.success).toBe(true)
      expect(result.data?.valid).toBe(false)
      expect(result.data?.session).toBeUndefined()
      expect(clearSessionCookie).toHaveBeenCalled()
    })

    it('should handle errors during validation', async () => {
      ;(getSessionCookie as jest.Mock).mockRejectedValue(
        new Error('Validation error')
      )

      const result = await validateSessionAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Validation error')
    })
  })

  describe('refreshSessionAction', () => {
    it('should refresh valid session', async () => {
      const mockSession = createMockSession()
      const refreshedSession = {
        ...mockSession,
        expiresAt: mockSession.expiresAt + 86400000,
      }
      ;(getSessionCookie as jest.Mock).mockResolvedValue(mockSession)
      ;(isSessionValid as jest.Mock).mockReturnValue(true)
      ;(refreshSession as jest.Mock).mockReturnValue(refreshedSession)
      ;(setSessionCookie as jest.Mock).mockResolvedValue(undefined)

      const result = await refreshSessionAction()

      expect(result.success).toBe(true)
      expect(result.data).toEqual(refreshedSession)
      expect(refreshSession).toHaveBeenCalledWith(mockSession)
      expect(setSessionCookie).toHaveBeenCalledWith(refreshedSession)
    })

    it('should return error when session not found', async () => {
      ;(getSessionCookie as jest.Mock).mockResolvedValue(null)

      const result = await refreshSessionAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.NOT_FOUND)
      expect(refreshSession).not.toHaveBeenCalled()
    })

    it('should return error when session is expired', async () => {
      const mockSession = createMockSession()
      ;(getSessionCookie as jest.Mock).mockResolvedValue(mockSession)
      ;(isSessionValid as jest.Mock).mockReturnValue(false)
      ;(clearSessionCookie as jest.Mock).mockResolvedValue(undefined)

      const result = await refreshSessionAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe(SESSION_ERRORS.EXPIRED)
      expect(clearSessionCookie).toHaveBeenCalled()
      expect(refreshSession).not.toHaveBeenCalled()
    })

    it('should handle errors during refresh', async () => {
      const mockSession = createMockSession()
      ;(getSessionCookie as jest.Mock).mockResolvedValue(mockSession)
      ;(isSessionValid as jest.Mock).mockReturnValue(true)
      ;(refreshSession as jest.Mock).mockImplementation(() => {
        throw new Error('Refresh error')
      })

      const result = await refreshSessionAction()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Refresh error')
    })
  })
})
