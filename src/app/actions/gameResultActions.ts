'use server'

import { GAME_PHASES } from '@/lib/constants'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import {
  calculateGameResult,
  getGameProgress,
  getTeamFaceCardCounts,
  isGameDecided,
} from '@/lib/scoring'
import { validateGameId } from '@/lib/supabase/server'
import type { GameResult, GameState } from '@/types/game'
import {
  loadGameStateAction,
  saveGameResultAction,
  saveGameStateAction,
  validateSessionAction,
} from './gameActions'

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
  playerId: string
): Promise<GameResultActionResult<GameResult>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 入力検証
    if (!validateGameId(gameId)) {
      throw new GameActionError(
        'Invalid game ID',
        GAME_ACTION_ERROR_CODES.INVALID_GAME_ID
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const gameState = gameResult.gameState

    // ゲームが終了していることを確認
    if (gameState.phase !== GAME_PHASES.FINISHED) {
      throw new GameActionError(
        'Game not finished yet',
        GAME_ACTION_ERROR_CODES.INVALID_STATE
      )
    }

    // サーバーサイドで安全にゲーム結果を計算
    const result = calculateGameResult(gameState)

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
  playerId: string
): Promise<
  GameResultActionResult<{ isDecided: boolean; result?: GameResult }>
> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const gameState = gameResult.gameState

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
  playerId: string
): Promise<
  GameResultActionResult<{ gameState: GameState; result: GameResult }>
> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    let gameState = gameResult.gameState

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
    const saveResultSuccess = await saveGameResultAction(result, playerId)
    if (!saveResultSuccess.success) {
      throw new GameActionError(
        'Failed to save game result',
        GAME_ACTION_ERROR_CODES.DATABASE_ERROR
      )
    }

    // 最終ゲーム状態を保存
    const saveStateSuccess = await saveGameStateAction(gameState, playerId)
    if (!saveStateSuccess.success) {
      throw new GameActionError(
        'Failed to save final game state',
        GAME_ACTION_ERROR_CODES.DATABASE_ERROR
      )
    }

    return {
      success: true,
      data: {
        gameState,
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
  playerId: string
): Promise<
  GameResultActionResult<{
    progress: ReturnType<typeof getGameProgress>
    teamCounts: ReturnType<typeof getTeamFaceCardCounts>
  }>
> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const gameState = gameResult.gameState

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
