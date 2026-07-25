/**
 * ゲーム状態の内部リポジトリ（Server Action ではない）
 *
 * Server Action からクライアントへ返す状態はマスクされるため、
 * サーバーサイドのゲームロジックは必ずこの未マスクのローダーを使う。
 * 認可はここでは行わない（呼び出し側の Server Action の責務）。
 */

import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import { supabaseAdmin } from '@/lib/supabase/server'
import type { GameState } from '@/types/game'

const NOT_FOUND_ERROR_CODE = 'PGRST116'

export const GAME_NOT_FOUND_MESSAGE = 'Game not found'

/**
 * DB から未マスクのゲーム状態を取得する
 * @returns 見つからない場合は null
 */
export async function fetchGameState(
  gameId: string
): Promise<GameState | null> {
  const { data, error } = await supabaseAdmin
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error) {
    if (error.code === NOT_FOUND_ERROR_CODE) {
      return null
    }
    throw new GameActionError(
      `Failed to load game state: ${error.message}`,
      GAME_ACTION_ERROR_CODES.DATABASE_ERROR
    )
  }

  return data.state as GameState
}

/**
 * 未マスクのゲーム状態を取得する（存在しなければ NOT_FOUND を投げる）
 */
export async function requireGameState(gameId: string): Promise<GameState> {
  const gameState = await fetchGameState(gameId)

  if (!gameState) {
    throw new GameActionError(
      GAME_NOT_FOUND_MESSAGE,
      GAME_ACTION_ERROR_CODES.NOT_FOUND
    )
  }

  return gameState
}
