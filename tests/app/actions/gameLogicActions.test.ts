/**
 * Tests for Game Logic Server Actions
 */

import {
  closeTrickResultAction,
  declareNapoleonAction,
  exchangeCardsAction,
  passNapoleonAction,
  playCardAction,
  redealCardsAction,
  setAdjutantAction,
} from '@/app/actions/gameLogicActions'
import { AUTH_ERRORS, GAME_PHASES } from '@/lib/constants'
import type { Card, GameState, NapoleonDeclaration, Player } from '@/types/game'

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

jest.mock('@/lib/gameLogic', () => ({
  closeTrickResult: jest.fn(),
  declareNapoleon: jest.fn(),
  exchangeCards: jest.fn(),
  getCurrentPlayer: jest.fn(),
  passNapoleonDeclaration: jest.fn(),
  playCard: jest.fn(),
  redealCards: jest.fn(),
  setAdjutant: jest.fn(),
}))

jest.mock('@/lib/ai/gameTricks', () => ({
  processAIPlayingPhase: jest.fn(),
}))

// Import mocked functions
import { saveGameStateAction } from '@/app/actions/gameActions'
import { processAIPlayingPhase } from '@/lib/ai/gameTricks'
import { GameActionError } from '@/lib/errors/GameActionError'
import { requireGameState } from '@/lib/game/gameStateRepository'
import { maskGameStateForPlayer } from '@/lib/game/maskGameState'
import {
  closeTrickResult,
  declareNapoleon,
  exchangeCards,
  getCurrentPlayer,
  passNapoleonDeclaration,
  playCard,
  redealCards,
  setAdjutant,
} from '@/lib/gameLogic'
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

const createPlayer = (id: string, name: string): Player => ({
  id,
  name,
  hand: [createCard('spades', 'A', 14)],
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI: false,
})

const createGameState = (
  phase: GameState['phase'] = GAME_PHASES.NAPOLEON
): GameState => ({
  id: 'test-game',
  players: [
    createPlayer('p1', 'Alice'),
    createPlayer('p2', 'Bob'),
    createPlayer('p3', 'Carol'),
    createPlayer('p4', 'Dave'),
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

const createDeclaration = (): NapoleonDeclaration => ({
  playerId: 'p1',
  suit: 'spades',
  targetTricks: 12,
})

describe('Game Logic Actions', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAuthenticatedSession('p1')
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('declareNapoleonAction', () => {
    it('should declare Napoleon successfully', async () => {
      const gameState = createGameState()
      const declaration = createDeclaration()
      const updatedGameState = {
        ...gameState,
        napoleonDeclaration: declaration,
      }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(declareNapoleon as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await declareNapoleonAction('game-1', 'p1', declaration)

      expect(result.success).toBe(true)
      expect(result.data).toEqual(
        maskGameStateForPlayer(updatedGameState, 'p1')
      )
      expect(declareNapoleon).toHaveBeenCalledWith(gameState, declaration)
      expect(saveGameStateAction).toHaveBeenCalledWith(updatedGameState, 'p1')
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await declareNapoleonAction(
        'game-1',
        'p1',
        createDeclaration()
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })

    it('should return error when game not found', async () => {
      ;(requireGameState as jest.Mock).mockRejectedValue(
        new GameActionError('Game not found', 'NOT_FOUND')
      )

      const result = await declareNapoleonAction(
        'game-1',
        'p1',
        createDeclaration()
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Game not found')
    })

    it('should reject acting as an unknown player', async () => {
      const gameState = createGameState()

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)

      const result = await declareNapoleonAction(
        'game-1',
        'unknown-player',
        createDeclaration()
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.FORBIDDEN_PLAYER)
    })

    it('should return error when save fails', async () => {
      const gameState = createGameState()
      const updatedGameState = { ...gameState }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(declareNapoleon as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await declareNapoleonAction(
        'game-1',
        'p1',
        createDeclaration()
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save game state')
    })
  })

  describe('passNapoleonAction', () => {
    it('should pass Napoleon successfully', async () => {
      const gameState = createGameState()
      const updatedGameState = { ...gameState, passedPlayers: ['p1'] }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(passNapoleonDeclaration as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await passNapoleonAction('game-1', 'p1')

      expect(result.success).toBe(true)
      expect(result.data).toEqual(
        maskGameStateForPlayer(updatedGameState, 'p1')
      )
      expect(passNapoleonDeclaration).toHaveBeenCalledWith(gameState, 'p1')
    })

    it('should return error when session invalid', async () => {
      mockNoSession()

      const result = await passNapoleonAction('game-1', 'p1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })
  })

  describe('redealCardsAction', () => {
    it('should redeal cards successfully', async () => {
      const gameState = {
        ...createGameState(),
        needsRedeal: true,
      }
      const updatedGameState = { ...gameState, needsRedeal: false }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(redealCards as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await redealCardsAction('game-1', 'p1')

      expect(result.success).toBe(true)
      expect(redealCards).toHaveBeenCalledWith(gameState)
    })

    it('should return error when redeal not needed', async () => {
      const gameState = {
        ...createGameState(),
        needsRedeal: false,
      }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)

      const result = await redealCardsAction('game-1', 'p1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Redeal is not needed')
    })
  })

  describe('setAdjutantAction', () => {
    it('should set adjutant successfully', async () => {
      const gameState = createGameState(GAME_PHASES.ADJUTANT)
      gameState.napoleonDeclaration = createDeclaration()
      const card = createCard('hearts', 'A', 14)
      const updatedGameState = { ...gameState, phase: GAME_PHASES.EXCHANGE }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(setAdjutant as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })

      const result = await setAdjutantAction('game-1', 'p1', card)

      expect(result.success).toBe(true)
      expect(setAdjutant).toHaveBeenCalledWith(gameState, card)
    })
  })

  describe('exchangeCardsAction', () => {
    it('should exchange cards successfully', async () => {
      const gameState = createGameState(GAME_PHASES.EXCHANGE)
      gameState.napoleonDeclaration = createDeclaration()
      const cards = [createCard('spades', 'A', 14)]
      const updatedGameState = { ...gameState, phase: GAME_PHASES.PLAYING }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(exchangeCards as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })
      ;(processAIPlayingPhase as jest.Mock).mockResolvedValue(updatedGameState)

      const result = await exchangeCardsAction('game-1', 'p1', cards)

      expect(result.success).toBe(true)
      expect(exchangeCards).toHaveBeenCalledWith(gameState, 'p1', cards)
    })
  })

  describe('playCardAction', () => {
    it('should play card successfully', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)
      const cardId = 'spades-A'
      const updatedGameState = { ...gameState }
      const currentPlayer = gameState.players[0]

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(getCurrentPlayer as jest.Mock).mockReturnValue(currentPlayer)
      ;(playCard as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })
      ;(processAIPlayingPhase as jest.Mock).mockResolvedValue(updatedGameState)

      const result = await playCardAction('game-1', 'p1', cardId)

      expect(result.success).toBe(true)
      expect(playCard).toHaveBeenCalledWith(gameState, 'p1', cardId)
    })
  })

  describe('closeTrickResultAction', () => {
    it('should close trick result successfully', async () => {
      const gameState = createGameState(GAME_PHASES.PLAYING)
      const updatedGameState = { ...gameState }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(closeTrickResult as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: true })
      ;(processAIPlayingPhase as jest.Mock).mockResolvedValue(updatedGameState)

      const result = await closeTrickResultAction('game-1', 'p1')

      expect(result.success).toBe(true)
      expect(closeTrickResult).toHaveBeenCalledWith(gameState)
    })

    it('should return error when save fails', async () => {
      const gameState = createGameState()
      const updatedGameState = { ...gameState }

      ;(requireGameState as jest.Mock).mockResolvedValue(gameState)
      ;(closeTrickResult as jest.Mock).mockReturnValue(updatedGameState)
      ;(saveGameStateAction as jest.Mock).mockResolvedValue({ success: false })

      const result = await closeTrickResultAction('game-1', 'p1')

      expect(result.success).toBe(false)
      expect(result.error).toBe('Failed to save game state')
    })
  })
})
