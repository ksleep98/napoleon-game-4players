/**
 * Server Action の認可テスト（F-1 / F-2 / F-5）
 *
 * 「他人の playerId を渡すと拒否される」ことを Server Action レベルで検証する。
 */

import { processAITurnAction } from '@/app/actions/aiStrategyActions'
import {
  deleteGameRoomAction,
  getGameRoomsAction,
  invalidateSessionAction,
  loadGameStateAction,
  refreshSessionAction,
  saveGameResultAction,
  saveGameStateAction,
  setPlayerOfflineAction,
  setPlayerOnlineAction,
  startGameFromRoomAction,
  validateSessionAction,
} from '@/app/actions/gameActions'
import { initializeAIGameAction } from '@/app/actions/gameInitActions'
import {
  declareNapoleonAction,
  playCardAction,
} from '@/app/actions/gameLogicActions'
import {
  recordGameMoveAction,
  updateGameResultAction,
} from '@/app/actions/mlDataCollectionActions'
import { AUTH_ERRORS, GAME_PHASES, ML_GAME_RESULTS } from '@/lib/constants'
import type { MLTrainingData } from '@/lib/ml/dataExtractor'
import type { Card, GameResult, GameState, Player } from '@/types/game'

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

jest.mock('@/lib/game/gameStateRepository', () => ({
  requireGameState: jest.fn(),
  fetchGameState: jest.fn(),
  GAME_NOT_FOUND_MESSAGE: 'Game not found',
}))

jest.mock('@/lib/ml/dataCollection', () => ({
  recordGameMove: jest.fn(),
  updateGameResult: jest.fn(),
  getMLTrainingStats: jest.fn(),
  getMLRoleStats: jest.fn(),
  getMLAIStats: jest.fn(),
}))

import {
  fetchGameState,
  requireGameState,
} from '@/lib/game/gameStateRepository'
import { recordGameMove, updateGameResult } from '@/lib/ml/dataCollection'
import {
  mockAuthenticatedSession,
  mockNoSession,
} from '../../utils/sessionTestUtils'

const ATTACKER = 'attacker-player'
const VICTIM = 'victim-player'

const createCard = (id: string): Card => ({
  id,
  suit: 'spades',
  rank: 'A',
  value: 14,
})

const createPlayer = (id: string, isAI = false): Player => ({
  id,
  name: `Player ${id}`,
  hand: [createCard(`${id}-card`)],
  isNapoleon: false,
  isAdjutant: false,
  position: 1,
  isAI,
})

const createGameState = (): GameState => ({
  id: 'game_test',
  players: [createPlayer(ATTACKER), createPlayer(VICTIM)],
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

const createGameResult = (): GameResult => ({
  gameId: 'game_test',
  napoleonWon: true,
  napoleonPlayerId: VICTIM,
  faceCardsWon: 15,
  scores: [],
})

const createMLData = (playerId: string): MLTrainingData => ({
  gameId: 'game_test',
  playerId,
  trickNumber: 1,
  hand: [createCard('c1')],
  tableCards: [],
  currentSuit: null,
  trumpSuit: 'spades',
  selectedCard: createCard('c1'),
  gamePhase: GAME_PHASES.PLAYING,
  role: 'allied',
  isNapoleonTeam: false,
  isAiPlayer: false,
})

describe('Server Action authorization', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation()
    jest.spyOn(console, 'log').mockImplementation()
    jest.spyOn(console, 'warn').mockImplementation()
    // 攻撃者は「自分自身の」正当なセッションを持っている前提
    mockAuthenticatedSession(ATTACKER)
    ;(requireGameState as jest.Mock).mockResolvedValue(createGameState())
    ;(fetchGameState as jest.Mock).mockResolvedValue(createGameState())
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('他人の playerId を渡した場合は拒否される (F-1)', () => {
    it.each([
      ['loadGameStateAction', () => loadGameStateAction('game_test', VICTIM)],
      [
        'saveGameStateAction',
        () => saveGameStateAction(createGameState(), VICTIM),
      ],
      [
        'saveGameResultAction',
        () => saveGameResultAction(createGameResult(), VICTIM),
      ],
      ['setPlayerOnlineAction', () => setPlayerOnlineAction(VICTIM)],
      ['setPlayerOfflineAction', () => setPlayerOfflineAction(VICTIM)],
      ['validateSessionAction', () => validateSessionAction(VICTIM)],
      ['invalidateSessionAction', () => invalidateSessionAction(VICTIM)],
      ['refreshSessionAction', () => refreshSessionAction(VICTIM)],
      ['getGameRoomsAction', () => getGameRoomsAction(VICTIM)],
      [
        'deleteGameRoomAction',
        () => deleteGameRoomAction('game_room1', VICTIM),
      ],
      [
        'startGameFromRoomAction',
        () => startGameFromRoomAction('game_room1', VICTIM),
      ],
      [
        'initializeAIGameAction',
        () => initializeAIGameAction('Victim', VICTIM),
      ],
    ])('%s rejects a foreign playerId', async (_name, run) => {
      const result = (await run()) as { success: boolean; error?: string }

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.FORBIDDEN_PLAYER)
    })

    it('playCardAction rejects playing on behalf of another human', async () => {
      const result = await playCardAction('game_test', VICTIM, 'card-1')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.FORBIDDEN_PLAYER)
    })

    it('declareNapoleonAction rejects declaring on behalf of another human', async () => {
      const result = await declareNapoleonAction('game_test', VICTIM, {
        playerId: VICTIM,
        suit: 'spades',
        targetTricks: 13,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.FORBIDDEN_PLAYER)
    })
  })

  describe('セッションが無い場合は拒否される (F-1)', () => {
    beforeEach(() => {
      mockNoSession()
    })

    it.each([
      ['loadGameStateAction', () => loadGameStateAction('game_test', VICTIM)],
      ['setPlayerOnlineAction', () => setPlayerOnlineAction(VICTIM)],
      ['getGameRoomsAction', () => getGameRoomsAction(VICTIM)],
      ['playCardAction', () => playCardAction('game_test', VICTIM, 'card-1')],
      ['processAITurnAction', () => processAITurnAction('game_test')],
    ])('%s requires an authenticated session', async (_name, run) => {
      const result = (await run()) as { success: boolean; error?: string }

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
    })
  })

  describe('ゲームに参加していないプレイヤーは拒否される (F-1)', () => {
    it('processAITurnAction rejects a non-participant session', async () => {
      mockAuthenticatedSession('outsider')

      const result = await processAITurnAction('game_test')

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.NOT_A_PARTICIPANT)
    })
  })

  describe('ML データ収集エンドポイント (F-5)', () => {
    it('rejects recording a move for another playerId', async () => {
      const result = await recordGameMoveAction(createMLData(VICTIM))

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.FORBIDDEN_PLAYER)
      expect(recordGameMove).not.toHaveBeenCalled()
    })

    it('rejects recording a move without a session', async () => {
      mockNoSession()

      const result = await recordGameMoveAction(createMLData(ATTACKER))

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.SESSION_REQUIRED)
      expect(recordGameMove).not.toHaveBeenCalled()
    })

    it('accepts recording a move for the session owner', async () => {
      ;(recordGameMove as jest.Mock).mockResolvedValue({ success: true })

      const result = await recordGameMoveAction(createMLData(ATTACKER))

      expect(result.success).toBe(true)
      expect(recordGameMove).toHaveBeenCalledTimes(1)
    })

    it('rejects updating results for a game the caller did not play', async () => {
      const result = await updateGameResultAction(
        'game_test',
        ML_GAME_RESULTS.NAPOLEON_WIN,
        { [VICTIM]: 10 }
      )

      expect(result.success).toBe(false)
      expect(result.error).toBe(AUTH_ERRORS.FORBIDDEN_PLAYER)
      expect(updateGameResult).not.toHaveBeenCalled()
    })

    it('accepts updating results when the caller is part of the scores', async () => {
      ;(updateGameResult as jest.Mock).mockResolvedValue({ success: true })

      const result = await updateGameResultAction(
        'game_test',
        ML_GAME_RESULTS.NAPOLEON_WIN,
        { [ATTACKER]: 10, [VICTIM]: -10 }
      )

      expect(result.success).toBe(true)
      expect(updateGameResult).toHaveBeenCalledTimes(1)
    })
  })
})
