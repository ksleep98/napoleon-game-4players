/**
 * Tests for Server Action authorization helpers (F-1)
 */

import {
  assertCanActAsPlayer,
  assertGameParticipant,
  getAuthenticatedPlayerId,
  requireAuthenticatedPlayerId,
  requireSessionOwner,
} from '@/lib/auth/requireSessionOwner'
import { AUTH_ERRORS, GAME_PHASES } from '@/lib/constants'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import type { GameState, Player } from '@/types/game'

jest.mock('@/lib/cookies/sessionCookies', () => ({
  getSessionCookie: jest.fn(),
  isSessionValid: jest.fn(),
}))

import {
  mockAuthenticatedSession,
  mockExpiredSession,
  mockNoSession,
} from '../../utils/sessionTestUtils'

const createPlayer = (id: string, isAI = false): Player => ({
  id,
  name: `Player ${id}`,
  hand: [],
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI,
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

describe('requireSessionOwner helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('getAuthenticatedPlayerId', () => {
    it('returns the playerId from a valid cookie session', async () => {
      mockAuthenticatedSession('human-1')

      await expect(getAuthenticatedPlayerId()).resolves.toBe('human-1')
    })

    it('returns null when no cookie session exists', async () => {
      mockNoSession()

      await expect(getAuthenticatedPlayerId()).resolves.toBeNull()
    })

    it('returns null when the session is expired', async () => {
      mockExpiredSession('human-1')

      await expect(getAuthenticatedPlayerId()).resolves.toBeNull()
    })
  })

  describe('requireAuthenticatedPlayerId', () => {
    it('throws UNAUTHORIZED without a session', async () => {
      mockNoSession()

      await expect(requireAuthenticatedPlayerId()).rejects.toMatchObject({
        message: AUTH_ERRORS.SESSION_REQUIRED,
        code: GAME_ACTION_ERROR_CODES.UNAUTHORIZED,
      })
    })
  })

  describe('requireSessionOwner', () => {
    it('accepts the session owner', async () => {
      mockAuthenticatedSession('human-1')

      await expect(requireSessionOwner('human-1')).resolves.toBe('human-1')
    })

    it('rejects when acting as ANOTHER player id (F-1 core case)', async () => {
      mockAuthenticatedSession('attacker')

      await expect(requireSessionOwner('victim')).rejects.toMatchObject({
        message: AUTH_ERRORS.FORBIDDEN_PLAYER,
        code: GAME_ACTION_ERROR_CODES.FORBIDDEN,
      })
    })

    it('rejects a forged playerId when there is no session at all', async () => {
      mockNoSession()

      await expect(requireSessionOwner('anything')).rejects.toBeInstanceOf(
        GameActionError
      )
    })
  })

  describe('assertGameParticipant', () => {
    it('accepts a human participant', () => {
      const gameState = createGameState([
        createPlayer('human-1'),
        createPlayer('ai-1', true),
      ])

      expect(() => assertGameParticipant(gameState, 'human-1')).not.toThrow()
    })

    it('rejects a player that is not in the game', () => {
      const gameState = createGameState([createPlayer('human-1')])

      expect(() => assertGameParticipant(gameState, 'outsider')).toThrow(
        AUTH_ERRORS.NOT_A_PARTICIPANT
      )
    })

    it('rejects an AI player acting as the operator', () => {
      const gameState = createGameState([createPlayer('ai-1', true)])

      expect(() => assertGameParticipant(gameState, 'ai-1')).toThrow(
        AUTH_ERRORS.NOT_A_PARTICIPANT
      )
    })
  })

  describe('assertCanActAsPlayer', () => {
    it('allows acting as yourself', () => {
      const gameState = createGameState([createPlayer('human-1')])

      expect(() =>
        assertCanActAsPlayer(gameState, 'human-1', 'human-1')
      ).not.toThrow()
    })

    it('allows a human participant to drive an AI player in the same game', () => {
      const gameState = createGameState([
        createPlayer('human-1'),
        createPlayer('ai-1', true),
      ])

      expect(() =>
        assertCanActAsPlayer(gameState, 'human-1', 'ai-1')
      ).not.toThrow()
    })

    it('rejects acting as another HUMAN player', () => {
      const gameState = createGameState([
        createPlayer('human-1'),
        createPlayer('human-2'),
      ])

      expect(() =>
        assertCanActAsPlayer(gameState, 'human-1', 'human-2')
      ).toThrow(AUTH_ERRORS.FORBIDDEN_PLAYER)
    })

    it('rejects acting as an AI player of a DIFFERENT game', () => {
      const gameState = createGameState([createPlayer('human-1')])

      expect(() =>
        assertCanActAsPlayer(gameState, 'human-1', 'ai-from-other-game')
      ).toThrow(AUTH_ERRORS.FORBIDDEN_PLAYER)
    })

    it('rejects a non-participant even when the target is an AI', () => {
      const gameState = createGameState([
        createPlayer('human-1'),
        createPlayer('ai-1', true),
      ])

      expect(() => assertCanActAsPlayer(gameState, 'outsider', 'ai-1')).toThrow(
        AUTH_ERRORS.NOT_A_PARTICIPANT
      )
    })
  })
})
