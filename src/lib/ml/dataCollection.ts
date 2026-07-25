/**
 * 機械学習用データ収集の内部実装（Server Action ではない）
 *
 * ⚠️ この層には認可を置かない。認可・レート制限は Server Action ラッパー
 * (`src/app/actions/mlDataCollectionActions.ts`) の責務。
 *
 * 理由: ヘッドレスシミュレータ（`scripts/simulate-games.ts` → `pnpm sim`）と
 * `processAIPlayingPhase` は Next.js のリクエストスコープ外で動作し、
 * `cookies()` を呼べない（呼ぶと "cookies was called outside a request scope"
 * が発生し `getSessionCookie()` は null を返す）。
 * そのためサーバー内部処理はこの内部関数を直接呼ぶ。
 */

import {
  ML_GAME_RESULTS,
  ML_VALIDATION_ERRORS,
  ML_VALIDATION_LIMITS,
} from '@/lib/constants'
import type { MLTrainingData } from '@/lib/ml/dataExtractor'
import {
  supabaseAdmin,
  validateGameId,
  validatePlayerId,
} from '@/lib/supabase/server'
import type { Card } from '@/types/game'

export type MLGameResult =
  (typeof ML_GAME_RESULTS)[keyof typeof ML_GAME_RESULTS]

export interface MLCollectionResult {
  success: boolean
  error?: string
  data?: unknown
}

const ML_TRAINING_TABLE = 'ml_training_data'
const ML_STATS_VIEW = 'ml_training_stats'
const ML_ROLE_STATS_VIEW = 'ml_training_role_stats'
const ML_AI_STATS_VIEW = 'ml_training_ai_stats'

function isCard(value: unknown): value is Card {
  if (!value || typeof value !== 'object') {
    return false
  }
  const card = value as Partial<Card>
  return (
    typeof card.id === 'string' &&
    typeof card.suit === 'string' &&
    typeof card.rank === 'string' &&
    typeof card.value === 'number'
  )
}

function isCardCollection(value: unknown, maxLength: number): value is Card[] {
  return (
    Array.isArray(value) && value.length <= maxLength && value.every(isCard)
  )
}

/**
 * 学習データ 1 レコードの入力検証（データ汚染防止）
 * @returns 問題があればエラーメッセージ、なければ null
 */
export function validateMLTrainingData(data: MLTrainingData): string | null {
  if (!validateGameId(data.gameId)) {
    return ML_VALIDATION_ERRORS.INVALID_GAME_ID
  }

  if (!validatePlayerId(data.playerId)) {
    return ML_VALIDATION_ERRORS.INVALID_PLAYER_ID
  }

  if (
    !Number.isInteger(data.trickNumber) ||
    data.trickNumber < 0 ||
    data.trickNumber > ML_VALIDATION_LIMITS.MAX_TRICK_NUMBER
  ) {
    return ML_VALIDATION_ERRORS.INVALID_TRICK_NUMBER
  }

  if (!isCardCollection(data.hand, ML_VALIDATION_LIMITS.MAX_HAND_SIZE)) {
    return ML_VALIDATION_ERRORS.INVALID_CARD_COLLECTION
  }

  if (
    !isCardCollection(data.tableCards, ML_VALIDATION_LIMITS.MAX_TABLE_CARDS)
  ) {
    return ML_VALIDATION_ERRORS.INVALID_CARD_COLLECTION
  }

  if (!isCard(data.selectedCard)) {
    return ML_VALIDATION_ERRORS.INVALID_SELECTED_CARD
  }

  return null
}

/**
 * ゲーム結果更新の入力検証
 */
export function validateMLGameResultUpdate(
  gameId: string,
  gameResult: MLGameResult,
  playerScores: Record<string, number>
): string | null {
  if (!validateGameId(gameId)) {
    return ML_VALIDATION_ERRORS.INVALID_GAME_ID
  }

  if (
    gameResult !== ML_GAME_RESULTS.NAPOLEON_WIN &&
    gameResult !== ML_GAME_RESULTS.ALLIED_WIN
  ) {
    return ML_VALIDATION_ERRORS.INVALID_GAME_RESULT
  }

  const entries = Object.entries(playerScores ?? {})
  if (
    entries.length === 0 ||
    entries.length > ML_VALIDATION_LIMITS.MAX_SCORE_ENTRIES
  ) {
    return ML_VALIDATION_ERRORS.INVALID_SCORES
  }

  for (const [playerId, score] of entries) {
    if (!validatePlayerId(playerId) || !Number.isFinite(score)) {
      return ML_VALIDATION_ERRORS.INVALID_SCORES
    }
  }

  return null
}

/**
 * ゲームの各手を機械学習用に記録
 */
export async function recordGameMove(
  data: MLTrainingData
): Promise<MLCollectionResult> {
  try {
    const validationError = validateMLTrainingData(data)
    if (validationError) {
      console.error('[ML Data Collection] Invalid move data:', validationError)
      return { success: false, error: validationError }
    }

    const { error } = await supabaseAdmin.from(ML_TRAINING_TABLE).insert({
      game_id: data.gameId,
      player_id: data.playerId,
      trick_number: data.trickNumber,
      hand: data.hand,
      table_cards: data.tableCards,
      current_suit: data.currentSuit,
      trump_suit: data.trumpSuit,
      selected_card: data.selectedCard,
      game_phase: data.gamePhase,
      role: data.role,
      is_napoleon_team: data.isNapoleonTeam,
      game_result: data.gameResult,
      player_final_score: data.playerFinalScore,
      is_ai_player: data.isAiPlayer,
      ai_difficulty: data.aiDifficulty,
    })

    if (error) {
      console.error('[ML Data Collection] Error recording move:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('[ML Data Collection] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * ゲーム終了時に全レコードにゲーム結果を更新
 */
export async function updateGameResult(
  gameId: string,
  gameResult: MLGameResult,
  playerScores: Record<string, number>
): Promise<MLCollectionResult> {
  try {
    const validationError = validateMLGameResultUpdate(
      gameId,
      gameResult,
      playerScores
    )
    if (validationError) {
      console.error(
        '[ML Data Collection] Invalid game result update:',
        validationError
      )
      return { success: false, error: validationError }
    }

    // 各プレイヤーのデータを個別に更新
    const updatePromises = Object.entries(playerScores).map(
      ([playerId, score]) =>
        supabaseAdmin
          .from(ML_TRAINING_TABLE)
          .update({
            game_result: gameResult,
            player_final_score: score,
          })
          .eq('game_id', gameId)
          .eq('player_id', playerId)
    )

    const results = await Promise.all(updatePromises)

    const errors = results.filter((r: { error: unknown }) => r.error)
    if (errors.length > 0) {
      console.error('[ML Data Collection] Error updating game results:', errors)
      return { success: false, error: 'Failed to update some records' }
    }

    return { success: true }
  } catch (error) {
    console.error('[ML Data Collection] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

async function fetchStats(
  viewName: string,
  single: boolean
): Promise<MLCollectionResult> {
  try {
    const query = supabaseAdmin.from(viewName).select('*')
    const { data, error } = single ? await query.single() : await query

    if (error) {
      console.error('[ML Data Collection] Error fetching stats:', error)
      return { success: false, error: error.message }
    }

    return { success: true, data }
  } catch (error) {
    console.error('[ML Data Collection] Unexpected error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * 訓練データの統計情報を取得
 */
export async function getMLTrainingStats(): Promise<MLCollectionResult> {
  return fetchStats(ML_STATS_VIEW, true)
}

/**
 * 役割別統計を取得
 */
export async function getMLRoleStats(): Promise<MLCollectionResult> {
  return fetchStats(ML_ROLE_STATS_VIEW, false)
}

/**
 * AI難易度別統計を取得
 */
export async function getMLAIStats(): Promise<MLCollectionResult> {
  return fetchStats(ML_AI_STATS_VIEW, false)
}
