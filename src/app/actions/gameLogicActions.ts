'use server'

import { processAIPlayingPhase } from '@/lib/ai/gameTricks'
import {
  assertCanActAsPlayer,
  requireAuthenticatedPlayerId,
} from '@/lib/auth/requireSessionOwner'
import { GAME_PHASES } from '@/lib/constants'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
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
import { recordGameMove } from '@/lib/ml/dataCollection'
import { extractMLTrainingData } from '@/lib/ml/dataExtractor'
import { validateGameId } from '@/lib/supabase/server'
import type { Card, GameState, NapoleonDeclaration } from '@/types/game'
import { saveGameStateAction } from './gameActions'

export interface GameActionResult<T = GameState> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 共通の認可処理
 *
 * - 操作主体(actor)は httpOnly クッキーのセッションからのみ決まる
 * - 引数の playerId は「操作対象」でしかなく、認証情報としては信頼しない
 * - COM(AI) のターンは同じゲームの人間プレイヤーが代理で進める設計のため、
 *   対象が同一ゲームの AI プレイヤーである場合に限り actor !== target を許可する
 */
async function authorizeGameAction(
  gameId: string,
  targetPlayerId: string
): Promise<{ actorId: string; gameState: GameState }> {
  if (!validateGameId(gameId)) {
    throw new GameActionError(
      'Invalid game ID',
      GAME_ACTION_ERROR_CODES.INVALID_GAME_ID
    )
  }

  const actorId = await requireAuthenticatedPlayerId()
  const gameState = await requireGameState(gameId)

  assertCanActAsPlayer(gameState, actorId, targetPlayerId)

  return { actorId, gameState }
}

function toErrorResult(error: unknown): GameActionResult<never> {
  return {
    success: false,
    error: error instanceof GameActionError ? error.message : 'Unknown error',
  }
}

/**
 * ナポレオン宣言 Server Action
 */
export async function declareNapoleonAction(
  gameId: string,
  playerId: string,
  declaration: NapoleonDeclaration
): Promise<GameActionResult<GameState>> {
  try {
    const { actorId, gameState: currentGameState } = await authorizeGameAction(
      gameId,
      playerId
    )

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ゲームロジック実行（サーバーサイドで検証）
    const updatedGameState = declareNapoleon(currentGameState, declaration)

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, actorId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: maskGameStateForPlayer(updatedGameState, actorId),
    }
  } catch (error) {
    console.error('declareNapoleonAction failed:', error)
    return toErrorResult(error)
  }
}

/**
 * ナポレオン宣言パス Server Action
 */
export async function passNapoleonAction(
  gameId: string,
  playerId: string
): Promise<GameActionResult<GameState>> {
  try {
    const { actorId, gameState: currentGameState } = await authorizeGameAction(
      gameId,
      playerId
    )

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ゲームロジック実行
    const updatedGameState = passNapoleonDeclaration(currentGameState, playerId)

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, actorId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: maskGameStateForPlayer(updatedGameState, actorId),
    }
  } catch (error) {
    console.error('passNapoleonAction failed:', error)
    return toErrorResult(error)
  }
}

/**
 * 配り直し Server Action
 */
export async function redealCardsAction(
  gameId: string,
  playerId: string
): Promise<GameActionResult<GameState>> {
  try {
    const { actorId, gameState: currentGameState } = await authorizeGameAction(
      gameId,
      playerId
    )

    // 配り直しが必要かチェック
    if (!currentGameState.needsRedeal) {
      throw new GameActionError(
        'Redeal is not needed',
        GAME_ACTION_ERROR_CODES.INVALID_STATE
      )
    }

    // ゲームロジック実行（カードを配り直し）
    const updatedGameState = redealCards(currentGameState)

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, actorId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    console.log('Cards redealt successfully - all players passed')

    return {
      success: true,
      data: maskGameStateForPlayer(updatedGameState, actorId),
    }
  } catch (error) {
    console.error('redealCardsAction failed:', error)
    return toErrorResult(error)
  }
}

/**
 * 副官設定 Server Action
 */
export async function setAdjutantAction(
  gameId: string,
  playerId: string,
  adjutantCard: Card
): Promise<GameActionResult<GameState>> {
  try {
    const { actorId, gameState: currentGameState } = await authorizeGameAction(
      gameId,
      playerId
    )

    // プレイヤーの存在確認と権限チェック
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ナポレオンかどうかチェック
    if (currentGameState.napoleonDeclaration?.playerId !== playerId) {
      throw new GameActionError(
        'Only Napoleon can set adjutant',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // ゲームロジック実行
    const updatedGameState = setAdjutant(currentGameState, adjutantCard)

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, actorId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: maskGameStateForPlayer(updatedGameState, actorId),
    }
  } catch (error) {
    console.error('setAdjutantAction failed:', error)
    return toErrorResult(error)
  }
}

/**
 * カード交換 Server Action
 */
export async function exchangeCardsAction(
  gameId: string,
  playerId: string,
  cardsToDiscard: Card[]
): Promise<GameActionResult<GameState>> {
  try {
    const { actorId, gameState: currentGameState } = await authorizeGameAction(
      gameId,
      playerId
    )

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ナポレオンかどうかチェック
    if (currentGameState.napoleonDeclaration?.playerId !== playerId) {
      throw new GameActionError(
        'Only Napoleon can exchange cards',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // ゲームロジック実行
    const updatedGameState = exchangeCards(
      currentGameState,
      playerId,
      cardsToDiscard
    )

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, actorId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: maskGameStateForPlayer(updatedGameState, actorId),
    }
  } catch (error) {
    console.error('exchangeCardsAction failed:', error)
    return toErrorResult(error)
  }
}

/**
 * カードプレイ Server Action
 */
export async function playCardAction(
  gameId: string,
  playerId: string,
  cardId: string
): Promise<GameActionResult<GameState>> {
  try {
    const { actorId, gameState: currentGameState } = await authorizeGameAction(
      gameId,
      playerId
    )

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // 現在のプレイヤーかどうかチェック
    const currentPlayer = getCurrentPlayer(currentGameState)
    if (!currentPlayer || currentPlayer.id !== playerId) {
      throw new GameActionError(
        'Not your turn',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // カードをプレイする前に、選択されたカードを取得
    const selectedCard = player.hand.find((c) => c.id === cardId)
    if (!selectedCard) {
      throw new GameActionError(
        'Card not found in hand',
        GAME_ACTION_ERROR_CODES.INVALID_INPUT
      )
    }

    // 機械学習用データ収集（非同期・エラーは無視）
    // プレイ前の状態を記録するため、playCard実行前に実行
    if (currentGameState.phase === GAME_PHASES.PLAYING) {
      const mlData = extractMLTrainingData(
        currentGameState,
        playerId,
        selectedCard
      )
      if (mlData) {
        // 非同期実行してエラーは無視（ゲームプレイを妨げない）
        recordGameMove(mlData).catch((error) => {
          console.error(
            '[ML Data Collection] Failed to record move (non-blocking):',
            error
          )
        })
      }
    }

    // ゲームロジック実行
    const updatedGameState = playCard(currentGameState, playerId, cardId)

    // AI処理はクライアントサイドで行うため、ここでは実行しない
    // これによりプレイヤーのモーダルが閉じるまでAIが待機する

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, actorId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: maskGameStateForPlayer(updatedGameState, actorId),
    }
  } catch (error) {
    console.error('playCardAction failed:', error)
    return toErrorResult(error)
  }
}

/**
 * トリック結果を閉じる Server Action
 */
export async function closeTrickResultAction(
  gameId: string,
  playerId: string
): Promise<GameActionResult<GameState>> {
  try {
    const { actorId, gameState: currentGameState } = await authorizeGameAction(
      gameId,
      playerId
    )

    // ゲームロジック実行
    let updatedGameState = closeTrickResult(currentGameState)

    // AI処理が必要な場合は実行
    if (updatedGameState.phase === GAME_PHASES.PLAYING) {
      const nextPlayer = getCurrentPlayer(updatedGameState)
      if (nextPlayer?.isAI) {
        // AIの処理を実行（サーバーサイドで）
        updatedGameState = await processAIPlayingPhase(updatedGameState)
      }
    }

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, actorId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: maskGameStateForPlayer(updatedGameState, actorId),
    }
  } catch (error) {
    console.error('closeTrickResultAction failed:', error)
    return toErrorResult(error)
  }
}
