'use server'

import {
  assertGameParticipant,
  requireAuthenticatedPlayerId,
} from '@/lib/auth/requireSessionOwner'
import { GAME_PHASES, ML_GAME_RESULTS } from '@/lib/constants'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import { requireGameState } from '@/lib/game/gameStateRepository'
import { maskGameStateForPlayer } from '@/lib/game/maskGameState'
import { updateGameResult } from '@/lib/ml/dataCollection'
import {
  calculateGameResult,
  getGameProgress,
  getTeamFaceCardCounts,
  isGameDecided,
} from '@/lib/scoring'
import { validateGameId } from '@/lib/supabase/server'
import type { GameResult, GameState } from '@/types/game'
import { saveGameResultAction, saveGameStateAction } from './gameActions'

/**
 * 共通の認可処理
 * 操作主体は httpOnly クッキーのセッションからのみ決定し、
 * そのゲームの人間プレイヤーとして参加していることを保証する。
 */
async function authorizeGameResultAction(
  gameId: string
): Promise<{ actorId: string; gameState: GameState }> {
  if (!validateGameId(gameId)) {
    throw new GameActionError(
      'Invalid game ID',
      GAME_ACTION_ERROR_CODES.INVALID_GAME_ID
    )
  }

  const actorId = await requireAuthenticatedPlayerId()
  const gameState = await requireGameState(gameId)

  assertGameParticipant(gameState, actorId)

  return { actorId, gameState }
}

export interface GameResultActionResult<T = GameResult> {
  success: boolean
  data?: T
  error?: string
}

/**
 * ゲーム結果計算 Server Action
 * セキュアにスコア計算を実行し、改ざんを防止
 */
export async function calculateGameResultAction(
  gameId: string,
  // 認可はクッキーセッションで行うため引数の playerId は信頼しない（互換のため残す）
  _playerId?: string
): Promise<GameResultActionResult<GameResult>> {
  try {
    // 🔒 認可: クッキーのセッションを操作主体として検証
    const { gameState } = await authorizeGameResultAction(gameId)

    // ゲームが終了していることを確認
    if (gameState.phase !== GAME_PHASES.FINISHED) {
      throw new GameActionError(
        'Game not finished yet',
        GAME_ACTION_ERROR_CODES.INVALID_STATE
      )
    }

    // サーバーサイドで安全にゲーム結果を計算
    const result = calculateGameResult(gameState)

    // 機械学習用データベースにゲーム結果を更新（非同期・エラーは無視）
    const mlGameResult = result.napoleonWon
      ? ML_GAME_RESULTS.NAPOLEON_WIN
      : ML_GAME_RESULTS.ALLIED_WIN
    const playerScores: Record<string, number> = {}
    result.scores.forEach((score) => {
      playerScores[score.playerId] = score.points
    })

    // 非同期実行してエラーは無視（ゲームプレイを妨げない）
    updateGameResult(gameId, mlGameResult, playerScores).catch((error) => {
      console.error(
        '[ML Data Collection] Failed to update game result (non-blocking):',
        error
      )
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('calculateGameResultAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * ゲーム終了判定 Server Action
 * ゲームが決着したかを安全にサーバーサイドで判定
 */
export async function checkGameDecisionAction(
  gameId: string,
  _playerId?: string
): Promise<
  GameResultActionResult<{ isDecided: boolean; result?: GameResult }>
> {
  try {
    // 🔒 認可: クッキーのセッションを操作主体として検証
    const { gameState } = await authorizeGameResultAction(gameId)

    // サーバーサイドでゲーム決着判定
    const decisionCheck = isGameDecided(gameState)

    let result: GameResult | undefined
    if (decisionCheck.decided) {
      result = calculateGameResult(gameState)
    }

    return {
      success: true,
      data: {
        isDecided: decisionCheck.decided,
        result,
      },
    }
  } catch (error) {
    console.error('checkGameDecisionAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * ゲーム終了処理 Server Action
 * ゲーム結果を計算し、データベースに安全に保存
 */
export async function finalizeGameAction(
  gameId: string,
  _playerId?: string
): Promise<
  GameResultActionResult<{ gameState: GameState; result: GameResult }>
> {
  try {
    // 🔒 認可: クッキーのセッションを操作主体として検証
    const { actorId, gameState: loadedGameState } =
      await authorizeGameResultAction(gameId)

    let gameState = loadedGameState

    // ゲームが終了していない場合は終了状態に変更
    if (gameState.phase !== GAME_PHASES.FINISHED) {
      const decisionCheck = isGameDecided(gameState)
      if (!decisionCheck.decided) {
        throw new GameActionError(
          'Game not ready to finalize',
          GAME_ACTION_ERROR_CODES.INVALID_STATE
        )
      }

      // ゲーム状態を終了に変更
      gameState = {
        ...gameState,
        phase: GAME_PHASES.FINISHED,
      }
    }

    // サーバーサイドで安全にゲーム結果を計算
    const result = calculateGameResult(gameState)

    // ゲーム結果をデータベースに保存
    const saveResultSuccess = await saveGameResultAction(result, actorId)
    if (!saveResultSuccess.success) {
      throw new GameActionError(
        'Failed to save game result',
        GAME_ACTION_ERROR_CODES.DATABASE_ERROR
      )
    }

    // 最終ゲーム状態を保存
    const saveStateSuccess = await saveGameStateAction(gameState, actorId)
    if (!saveStateSuccess.success) {
      throw new GameActionError(
        'Failed to save final game state',
        GAME_ACTION_ERROR_CODES.DATABASE_ERROR
      )
    }

    return {
      success: true,
      data: {
        // 🔒 F-3: 他プレイヤーの手札はクライアントへ返さない
        gameState: maskGameStateForPlayer(gameState, actorId),
        result,
      },
    }
  } catch (error) {
    console.error('finalizeGameAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * ゲーム進捗取得 Server Action
 * 現在のゲーム進捗を安全に取得
 */
export async function getGameProgressAction(
  gameId: string,
  _playerId?: string
): Promise<
  GameResultActionResult<{
    progress: ReturnType<typeof getGameProgress>
    teamCounts: ReturnType<typeof getTeamFaceCardCounts>
  }>
> {
  try {
    // 🔒 認可: クッキーのセッションを操作主体として検証
    const { gameState } = await authorizeGameResultAction(gameId)

    // サーバーサイドで安全に進捗を計算
    const progress = getGameProgress(gameState)
    const teamCounts = getTeamFaceCardCounts(gameState)

    return {
      success: true,
      data: {
        progress,
        teamCounts,
      },
    }
  } catch (error) {
    console.error('getGameProgressAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}
