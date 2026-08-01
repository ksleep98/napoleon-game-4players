'use server'

import {
  assertGameParticipant,
  requireAuthenticatedPlayerId,
} from '@/lib/auth/requireSessionOwner'
import { GAME_PHASES } from '@/lib/constants'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import { requireGameState } from '@/lib/game/gameStateRepository'
import { maskGameStateForPlayer } from '@/lib/game/maskGameState'
import { processAITurn } from '@/lib/gameLogic'
import { getNextDeclarationPlayer } from '@/lib/napoleonRules'
import { validateGameId } from '@/lib/supabase/server'
import type { GameState, Player } from '@/types/game'
import { saveGameStateAction } from './gameActions'

export interface AIStrategyActionResult<T = GameState> {
  success: boolean
  data?: T
  error?: string
}

/**
 * 共通の認可処理
 *
 * COM(AI) はクッキーを持たないため、AI のターンは
 * 「そのゲームに参加している人間プレイヤーのセッション」が代理で進める。
 * ここでは操作主体（actor）がゲームの人間参加者であることだけを保証する。
 */
async function authorizeAIAction(
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

/**
 * AI自動ターン処理 Server Action
 * AI思考過程を完全にサーバーサイドで隠蔽
 */
export async function processAITurnAction(
  gameId: string,
  _playerId?: string
): Promise<AIStrategyActionResult<GameState>> {
  try {
    // 🔒 認可: 人間プレイヤーのセッションのみ AI ターンを進められる
    const { actorId, gameState } = await authorizeAIAction(gameId)

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
    const saveResult = await saveGameStateAction(updatedGameState, actorId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      // 🔒 F-3: 他プレイヤーの手札はクライアントへ返さない
      data: maskGameStateForPlayer(updatedGameState, actorId),
    }
  } catch (error) {
    console.error('processAITurnAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}
