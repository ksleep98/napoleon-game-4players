import { GAME_PHASES } from '@/lib/constants'
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

  // AI難易度を判定（env varを参照、コードの 'normal' は DB の 'medium' に正規化）
  let aiDifficulty: 'easy' | 'medium' | 'hard' | undefined
  if (player.isAI) {
    const level = process.env.NEXT_PUBLIC_AI_DIFFICULTY || 'normal'
    if (level === 'easy') aiDifficulty = 'easy'
    else if (level === 'hard') aiDifficulty = 'hard'
    else aiDifficulty = 'medium'
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
