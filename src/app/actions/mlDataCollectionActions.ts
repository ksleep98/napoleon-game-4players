'use server'

import { GAME_PHASES } from '@/lib/constants'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { Card, GameState } from '@/types/game'

/**
 * 機械学習用の訓練データ型定義
 */
export interface MLTrainingData {
  gameId: string
  playerId: string
  trickNumber: number
  hand: Card[]
  tableCards: Card[]
  currentSuit: string | null
  trumpSuit: string | null
  selectedCard: Card
  gamePhase: string
  role: 'napoleon' | 'adjutant' | 'allied'
  isNapoleonTeam: boolean
  gameResult?: 'napoleon_win' | 'allied_win'
  playerFinalScore?: number
  isAiPlayer: boolean
  aiDifficulty?: 'easy' | 'medium' | 'hard'
}

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
 * GameStateから機械学習用データを抽出するヘルパー関数
 *
 * @param gameState - 現在のゲーム状態
 * @param playerId - プレイヤーID
 * @param selectedCard - 選択したカード
 * @returns MLTrainingData
 */
export function extractMLTrainingData(
  gameState: GameState,
  playerId: string,
  selectedCard: Card
): MLTrainingData | null {
  // PLAYINGフェーズのみ記録
  if (gameState.phase !== GAME_PHASES.PLAYING) {
    return null
  }

  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    console.warn('[ML Data Collection] Player not found:', playerId)
    return null
  }

  // プレイヤーの役割を判定
  const role: 'napoleon' | 'adjutant' | 'allied' = player.isNapoleon
    ? 'napoleon'
    : player.isAdjutant
      ? 'adjutant'
      : 'allied'

  const isNapoleonTeam = player.isNapoleon || player.isAdjutant

  // トリック番号を計算（完了したトリック数）
  const trickNumber = gameState.tricks.filter((t) => t.completed).length

  // AI難易度を判定（プレイヤー名から推定）
  let aiDifficulty: 'easy' | 'medium' | 'hard' | undefined
  if (player.isAI) {
    if (player.name.includes('Easy')) aiDifficulty = 'easy'
    else if (player.name.includes('Medium')) aiDifficulty = 'medium'
    else if (player.name.includes('Hard')) aiDifficulty = 'hard'
  }

  return {
    gameId: gameState.id,
    playerId: player.id,
    trickNumber,
    hand: player.hand,
    tableCards: gameState.currentTrick.cards.map((pc) => pc.card),
    currentSuit: gameState.leadingSuit || null,
    trumpSuit: gameState.trumpSuit || null,
    selectedCard,
    gamePhase: gameState.phase,
    role,
    isNapoleonTeam,
    isAiPlayer: player.isAI,
    aiDifficulty,
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
