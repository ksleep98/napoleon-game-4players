'use server'

import type { MLTrainingData } from '@/lib/ml/dataExtractor'
import { supabaseAdmin } from '@/lib/supabase/server'

/**
 * ゲームの各手を機械学習用に記録
 *
 * @param data - 記録するプレイデータ
 * @returns 記録結果
 */
export async function recordGameMove(data: MLTrainingData) {
  try {
    const supabase = supabaseAdmin

    const { error } = await supabase.from('ml_training_data').insert({
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
 *
 * @param gameId - ゲームID
 * @param gameResult - ゲーム結果
 * @param playerScores - プレイヤーごとの最終スコア
 * @returns 更新結果
 */
export async function updateGameResult(
  gameId: string,
  gameResult: 'napoleon_win' | 'allied_win',
  playerScores: Record<string, number>
) {
  try {
    const supabase = supabaseAdmin

    // 各プレイヤーのデータを個別に更新
    const updatePromises = Object.entries(playerScores).map(
      ([playerId, score]) =>
        supabase
          .from('ml_training_data')
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

/**
 * 訓練データの統計情報を取得
 *
 * @returns 統計情報
 */
export async function getMLTrainingStats() {
  try {
    const supabase = supabaseAdmin

    const { data, error } = await supabase
      .from('ml_training_stats')
      .select('*')
      .single()

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
 * 役割別統計を取得
 *
 * @returns 役割別統計
 */
export async function getMLRoleStats() {
  try {
    const supabase = supabaseAdmin

    const { data, error } = await supabase
      .from('ml_training_role_stats')
      .select('*')

    if (error) {
      console.error('[ML Data Collection] Error fetching role stats:', error)
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
 * AI難易度別統計を取得
 *
 * @returns AI難易度別統計
 */
export async function getMLAIStats() {
  try {
    const supabase = supabaseAdmin

    const { data, error } = await supabase
      .from('ml_training_ai_stats')
      .select('*')

    if (error) {
      console.error('[ML Data Collection] Error fetching AI stats:', error)
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
