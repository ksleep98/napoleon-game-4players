'use server'

/**
 * 機械学習データ収集 Server Action（薄いラッパー）
 *
 * F-5 対策:
 * - 実際の書き込み／読み取りロジックは `@/lib/ml/dataCollection` にある。
 * - この層はブラウザから到達可能なエンドポイントなので、
 *   クッキー照合・所有者チェック・レート制限・入力検証を必ず行う。
 * - サーバー内部処理（`processAIPlayingPhase`）とヘッドレスシミュレータ
 *   （`pnpm sim`）は、リクエストスコープ外で `cookies()` を呼べないため
 *   このラッパーを経由せず内部関数を直接呼ぶ。
 */

import { requireAuthenticatedPlayerId } from '@/lib/auth/requireSessionOwner'
import { AUTH_ERRORS, ML_RATE_LIMITS } from '@/lib/constants'
import { GameActionError } from '@/lib/errors/GameActionError'
import {
  getMLAIStats as getMLAIStatsInternal,
  getMLRoleStats as getMLRoleStatsInternal,
  getMLTrainingStats as getMLTrainingStatsInternal,
  type MLCollectionResult,
  type MLGameResult,
  recordGameMove as recordGameMoveInternal,
  updateGameResult as updateGameResultInternal,
} from '@/lib/ml/dataCollection'
import type { MLTrainingData } from '@/lib/ml/dataExtractor'
import { checkRateLimit } from '@/lib/supabase/server'

const RATE_LIMIT_ERROR = 'Rate limit exceeded'

function toFailure(error: unknown): MLCollectionResult {
  return {
    success: false,
    error:
      error instanceof GameActionError || error instanceof Error
        ? error.message
        : 'Unknown error',
  }
}

function assertRateLimit(key: string, max: number, windowMs: number): void {
  if (!checkRateLimit(key, max, windowMs)) {
    throw new Error(RATE_LIMIT_ERROR)
  }
}

/**
 * ゲームの各手を記録（ブラウザからの呼び出し用）
 * 自分自身の playerId のデータしか記録できない
 */
export async function recordGameMoveAction(
  data: MLTrainingData
): Promise<MLCollectionResult> {
  try {
    const actorId = await requireAuthenticatedPlayerId()

    assertRateLimit(
      `ml_record_move_${actorId}`,
      ML_RATE_LIMITS.RECORD_MOVE.MAX,
      ML_RATE_LIMITS.RECORD_MOVE.WINDOW_MS
    )

    // 他人の playerId でのデータ投入を禁止（学習データ汚染防止）
    if (data?.playerId !== actorId) {
      throw new Error(AUTH_ERRORS.FORBIDDEN_PLAYER)
    }

    return await recordGameMoveInternal(data)
  } catch (error) {
    console.error('[ML Data Collection] recordGameMoveAction failed:', error)
    return toFailure(error)
  }
}

/**
 * ゲーム結果を記録（ブラウザからの呼び出し用）
 * 自分がスコアに含まれるゲームのみ更新できる
 */
export async function updateGameResultAction(
  gameId: string,
  gameResult: MLGameResult,
  playerScores: Record<string, number>
): Promise<MLCollectionResult> {
  try {
    const actorId = await requireAuthenticatedPlayerId()

    assertRateLimit(
      `ml_update_result_${actorId}`,
      ML_RATE_LIMITS.UPDATE_RESULT.MAX,
      ML_RATE_LIMITS.UPDATE_RESULT.WINDOW_MS
    )

    if (!playerScores || !(actorId in playerScores)) {
      throw new Error(AUTH_ERRORS.FORBIDDEN_PLAYER)
    }

    return await updateGameResultInternal(gameId, gameResult, playerScores)
  } catch (error) {
    console.error('[ML Data Collection] updateGameResultAction failed:', error)
    return toFailure(error)
  }
}

async function guardedStats(
  key: string,
  fetcher: () => Promise<MLCollectionResult>
): Promise<MLCollectionResult> {
  try {
    const actorId = await requireAuthenticatedPlayerId()

    assertRateLimit(
      `${key}_${actorId}`,
      ML_RATE_LIMITS.STATS.MAX,
      ML_RATE_LIMITS.STATS.WINDOW_MS
    )

    return await fetcher()
  } catch (error) {
    console.error('[ML Data Collection] stats action failed:', error)
    return toFailure(error)
  }
}

/**
 * 訓練データの統計情報を取得
 */
export async function getMLTrainingStatsAction(): Promise<MLCollectionResult> {
  return guardedStats('ml_stats', getMLTrainingStatsInternal)
}

/**
 * 役割別統計を取得
 */
export async function getMLRoleStatsAction(): Promise<MLCollectionResult> {
  return guardedStats('ml_role_stats', getMLRoleStatsInternal)
}

/**
 * AI難易度別統計を取得
 */
export async function getMLAIStatsAction(): Promise<MLCollectionResult> {
  return guardedStats('ml_ai_stats', getMLAIStatsInternal)
}
