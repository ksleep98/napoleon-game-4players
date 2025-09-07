'use server'

import {
  evaluateCardStrategicValue,
  selectBestStrategicCard,
} from '@/lib/ai/strategicCardEvaluator'
import { GAME_PHASES } from '@/lib/constants'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import { processAITurn } from '@/lib/gameLogic'
import { getNextDeclarationPlayer } from '@/lib/napoleonRules'
import { validateGameId } from '@/lib/supabase/server'
import type { Card, GameState, Player } from '@/types/game'
import {
  loadGameStateAction,
  saveGameStateAction,
  validateSessionAction,
} from './gameActions'

export interface AIStrategyActionResult<T = GameState> {
  success: boolean
  data?: T
  error?: string
}

/**
 * AI戦略的カード選択 Server Action
 * AI戦略をサーバーサイドで隠蔽し、チート防止
 */
export async function selectAICardAction(
  gameId: string,
  playerId: string,
  aiPlayerId: string
): Promise<
  AIStrategyActionResult<{ selectedCard: Card; updatedGameState: GameState }>
> {
  try {
    // セッション検証（人間プレイヤーのみ許可）
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

    // AIプレイヤーの確認
    const aiPlayer = gameState.players.find(
      (p) => p.id === aiPlayerId && p.isAI
    )
    if (!aiPlayer) {
      throw new GameActionError(
        'AI player not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // プレイ可能なカードを取得
    const playableCards = aiPlayer.hand // 実際にはルールに基づいてフィルタリング必要

    // サーバーサイドでAI戦略を実行（クライアントから隠蔽）
    const selectedCard = selectBestStrategicCard(
      playableCards,
      gameState,
      aiPlayer
    )

    if (!selectedCard) {
      throw new GameActionError(
        'No playable card found',
        GAME_ACTION_ERROR_CODES.INVALID_STATE
      )
    }

    // ゲーム状態を更新（実際の処理）
    const updatedGameState = { ...gameState } // ここで実際のカードプレイ処理を行う

    return {
      success: true,
      data: {
        selectedCard,
        updatedGameState,
      },
    }
  } catch (error) {
    console.error('selectAICardAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * AI自動ターン処理 Server Action
 * AI思考過程を完全にサーバーサイドで隠蔽
 */
export async function processAITurnAction(
  gameId: string,
  playerId: string
): Promise<AIStrategyActionResult<GameState>> {
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

    // AIターンかどうか確認
    let nextPlayer: Player | null = null

    if (gameState.phase === GAME_PHASES.NAPOLEON) {
      nextPlayer = getNextDeclarationPlayer(gameState)
    } else if (gameState.phase === GAME_PHASES.ADJUTANT) {
      // 副官フェーズではナポレオンプレイヤーが副官を選択
      const napoleonPlayer = gameState.players.find(
        (p) => p.id === gameState.napoleonDeclaration?.playerId
      )
      nextPlayer = napoleonPlayer || null
    } else if (gameState.phase === GAME_PHASES.EXCHANGE) {
      // カード交換フェーズでもナポレオンプレイヤーがカード交換
      const napoleonPlayer = gameState.players.find(
        (p) => p.id === gameState.napoleonDeclaration?.playerId
      )
      nextPlayer = napoleonPlayer || null
    } else if (gameState.phase === GAME_PHASES.PLAYING) {
      nextPlayer = gameState.players[gameState.currentPlayerIndex]
    }

    if (!nextPlayer || !nextPlayer.isAI) {
      console.log(
        `Not AI turn - Phase: ${gameState.phase}, NextPlayer: ${nextPlayer?.name} (isAI: ${nextPlayer?.isAI})`
      )
      throw new GameActionError(
        'Not AI turn',
        GAME_ACTION_ERROR_CODES.INVALID_STATE
      )
    }

    console.log(
      `Processing AI turn for ${nextPlayer.name} in ${gameState.phase} phase`
    )

    // サーバーサイドでAI処理を実行（戦略を完全隠蔽）
    const updatedGameState = await processAITurn(gameState)

    // 状態をデータベースに保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: updatedGameState,
    }
  } catch (error) {
    console.error('processAITurnAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * AI戦略評価 Server Action（デバッグ用、本番では無効化）
 * 開発時のみ使用し、本番ではAI戦略を完全隠蔽
 */
export async function evaluateAIStrategyAction(
  gameId: string,
  playerId: string,
  cards: Card[]
): Promise<AIStrategyActionResult<Array<{ card: Card; value: number }>>> {
  try {
    // 本番環境では無効化
    if (process.env.NODE_ENV === 'production') {
      throw new GameActionError(
        'Not available in production',
        GAME_ACTION_ERROR_CODES.FORBIDDEN
      )
    }

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
    const currentPlayer = gameState.players[gameState.currentPlayerIndex]

    // 各カードの戦略的価値を評価
    const evaluations = cards.map((card) => ({
      card,
      value: evaluateCardStrategicValue(card, gameState, currentPlayer),
    }))

    return {
      success: true,
      data: evaluations,
    }
  } catch (error) {
    console.error('evaluateAIStrategyAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * AI思考遅延 Server Action
 * 人間らしいAI思考時間をサーバーサイドで制御
 */
export async function simulateAIThinkingAction(
  _gameId: string,
  playerId: string,
  complexityLevel: 'simple' | 'normal' | 'complex' = 'normal'
): Promise<AIStrategyActionResult<{ thinkingTime: number }>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 思考時間の計算（サーバーサイドで制御）
    const baseTime = 1000 // 1秒
    const complexityMultiplier = {
      simple: 0.5,
      normal: 1.0,
      complex: 1.8,
    }

    const randomFactor = 0.7 + Math.random() * 0.6 // 0.7-1.3の範囲
    const thinkingTime = Math.round(
      baseTime * complexityMultiplier[complexityLevel] * randomFactor
    )

    // サーバーサイドで思考時間を制御
    await new Promise((resolve) => setTimeout(resolve, thinkingTime))

    return {
      success: true,
      data: { thinkingTime },
    }
  } catch (error) {
    console.error('simulateAIThinkingAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}
