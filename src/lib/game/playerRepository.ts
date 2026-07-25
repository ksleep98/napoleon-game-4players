/**
 * プレイヤーレコードの内部リポジトリ（Server Action ではない）
 * 認可は呼び出し側の Server Action の責務。
 */

import { supabaseAdmin } from '@/lib/supabase/server'

const PLAYERS_TABLE = 'players'
const UNIQUE_VIOLATION_CODE = '23505'

export const PLAYER_ALREADY_EXISTS_MESSAGE = 'Player already exists'
export const PLAYERS_ALREADY_EXIST_MESSAGE = 'Some players already exist'

export interface PlayerRecordInput {
  id: string
  name: string
}

/**
 * プレイヤーレコードが既に存在するかを返す
 *
 * セッション発行時のなりすまし防止に使う。
 * 判定不能（DBエラー）の場合は安全側に倒して true を返す。
 */
export async function playerExists(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from(PLAYERS_TABLE)
    .select('id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[PlayerRepository] Failed to check player existence:', error)
    return true
  }

  return !!data
}

export interface PlayerRepositoryResult {
  success: boolean
  error?: string
  /** 一意制約違反（既に存在）だったかどうか */
  alreadyExists?: boolean
}

/**
 * 複数プレイヤーをバッチ作成（N+1問題対策）
 */
export async function createPlayers(
  players: PlayerRecordInput[]
): Promise<PlayerRepositoryResult> {
  const { error } = await supabaseAdmin.from(PLAYERS_TABLE).insert(
    players.map((p) => ({
      id: p.id,
      name: p.name.trim(),
      connected: true,
    }))
  )

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return {
        success: false,
        error: PLAYERS_ALREADY_EXIST_MESSAGE,
        alreadyExists: true,
      }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * プレイヤーを1件作成
 */
export async function createPlayer(
  id: string,
  name: string
): Promise<PlayerRepositoryResult> {
  const { error } = await supabaseAdmin.from(PLAYERS_TABLE).insert({
    id,
    name: name.trim(),
    connected: true,
  })

  if (error) {
    if (error.code === UNIQUE_VIOLATION_CODE) {
      return {
        success: false,
        error: PLAYER_ALREADY_EXISTS_MESSAGE,
        alreadyExists: true,
      }
    }
    return { success: false, error: error.message }
  }

  return { success: true }
}

/**
 * プレイヤーレコードの存在を保証する（既存なら接続状態のみ更新）
 *
 * 同じセッション（同じ playerId）で 2 回目以降のゲームを開始した場合、
 * 単純な insert は一意制約違反になるため冪等化が必要。
 */
export async function ensurePlayerExists(
  id: string,
  name: string
): Promise<PlayerRepositoryResult> {
  const created = await createPlayer(id, name)

  if (created.success) {
    return created
  }

  if (!created.alreadyExists) {
    return created
  }

  const { error } = await supabaseAdmin
    .from(PLAYERS_TABLE)
    .update({ connected: true })
    .eq('id', id)

  if (error) {
    return { success: false, error: error.message }
  }

  return { success: true, alreadyExists: true }
}
