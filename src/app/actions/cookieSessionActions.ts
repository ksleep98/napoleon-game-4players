/**
 * httpOnlyクッキーセッション管理用 Server Actions
 * クライアントから呼び出し可能なサーバーサイド関数
 */

'use server'

import {
  PLAYER_NAME_MAX_LENGTH,
  SESSION_DURATION_MS,
  SESSION_ERRORS,
  SESSION_RATE_LIMIT,
} from '@/lib/constants'
import {
  clearSessionCookie,
  getSessionCookie,
  isSessionValid,
  refreshSession,
  type SessionCookieData,
  setSessionCookie,
} from '@/lib/cookies/sessionCookies'
import { playerExists } from '@/lib/game/playerRepository'
import { setPlayerSession } from '@/lib/supabase/client'
import { checkRateLimit, validatePlayerId } from '@/lib/supabase/server'
import { generateSessionToken } from '@/utils/encryption'

/**
 * Server Action レスポンス型定義
 */
export type ActionResult<T = void> = {
  success: boolean
  data?: T
  error?: string
}

/**
 * セッションを作成してクッキーに保存
 *
 * ⚠️ これは唯一のセッション発行口であり、他の全 Server Action の認可の起点になる。
 * 認証基盤（パスワード等）が無いため「未使用の playerId を自己申告で確保する」
 * モデルを採る。したがって **既に存在する playerId は奪えない** ようにする必要がある。
 * これが無いと `requireSessionOwner()` は任意の playerId になりすまして突破できる。
 *
 * @param playerId プレイヤーID
 * @param playerName プレイヤー名
 * @returns 成功/失敗の結果
 */
export async function createSessionAction(
  playerId: string,
  playerName: string
): Promise<ActionResult> {
  try {
    // 入力検証
    if (!playerId || !playerName) {
      return {
        success: false,
        error: SESSION_ERRORS.REQUIRED,
      }
    }

    if (!validatePlayerId(playerId)) {
      return { success: false, error: SESSION_ERRORS.INVALID_PLAYER_ID }
    }

    if (
      typeof playerName !== 'string' ||
      playerName.trim().length === 0 ||
      playerName.length > PLAYER_NAME_MAX_LENGTH
    ) {
      return { success: false, error: SESSION_ERRORS.INVALID_PLAYER_NAME }
    }

    if (
      !checkRateLimit(
        `create_session_${playerId}`,
        SESSION_RATE_LIMIT.MAX,
        SESSION_RATE_LIMIT.WINDOW_MS
      )
    ) {
      return { success: false, error: SESSION_ERRORS.RATE_LIMITED }
    }

    // 🔒 なりすまし防止:
    //   - 同じ playerId の有効なクッキーを既に持っている場合のみ再発行を許可
    //     （表示名の変更・セッション延長）
    //   - それ以外で players テーブルに既存の playerId は奪取不可
    const existingSession = await getSessionCookie()
    const ownsPlayerId =
      existingSession?.playerId === playerId && isSessionValid(existingSession)

    if (!ownsPlayerId && (await playerExists(playerId))) {
      return { success: false, error: SESSION_ERRORS.PLAYER_ID_TAKEN }
    }

    const now = Date.now()
    const sessionToken = generateSessionToken(playerId)

    const sessionData: SessionCookieData = {
      playerId,
      playerName,
      sessionToken,
      createdAt: now,
      expiresAt: now + SESSION_DURATION_MS,
    }

    // httpOnlyクッキーに保存
    await setSessionCookie(sessionData)

    // Supabase RLSコンテキスト設定（既存システムとの互換性）
    try {
      await setPlayerSession(playerId)
    } catch (rlsError) {
      // RLS設定失敗は警告のみ（開発環境では続行可能）
      console.warn('[Session] RLS setup warning:', rlsError)
    }

    return { success: true }
  } catch (error) {
    console.error('[Session] Failed to create session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * セッションを取得して検証
 * @returns セッションデータ、または失敗の結果
 */
export async function getSessionAction(): Promise<
  ActionResult<SessionCookieData>
> {
  try {
    const session = await getSessionCookie()

    if (!session) {
      return {
        success: false,
        error: SESSION_ERRORS.NOT_FOUND,
      }
    }

    // セッション有効期限チェック
    if (!isSessionValid(session)) {
      await clearSessionCookie()
      return {
        success: false,
        error: SESSION_ERRORS.EXPIRED,
      }
    }

    // RLSコンテキスト再設定（ページリフレッシュ時など）
    try {
      await setPlayerSession(session.playerId)
    } catch (rlsError) {
      console.warn('[Session] RLS setup warning:', rlsError)
    }

    return {
      success: true,
      data: session,
    }
  } catch (error) {
    console.error('[Session] Failed to get session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * セッションを無効化（ログアウト）
 * @returns 成功/失敗の結果
 */
export async function clearSessionAction(): Promise<ActionResult> {
  try {
    await clearSessionCookie()
    return { success: true }
  } catch (error) {
    console.error('[Session] Failed to clear session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * セッションを検証（有効性チェックのみ）
 * @returns 検証結果
 */
export async function validateSessionAction(): Promise<
  ActionResult<{ valid: boolean; session?: SessionCookieData }>
> {
  try {
    const session = await getSessionCookie()

    if (!session) {
      return {
        success: true,
        data: { valid: false },
      }
    }

    const valid = isSessionValid(session)

    if (!valid) {
      await clearSessionCookie()
    }

    return {
      success: true,
      data: {
        valid,
        session: valid ? session : undefined,
      },
    }
  } catch (error) {
    console.error('[Session] Failed to validate session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * セッションをリフレッシュ（有効期限延長）
 *
 * 通常の延長は `getAuthenticatedPlayerId()` のスライディング期限
 * （全 Server Action の認可時に自動延長）が担当するため、この Server Action は
 * 「操作なしで明示的に延長したい」場合の入口として残している。
 * 閾値判定を挟まず無条件に再発行するので、ポーリングから呼ばないこと。
 *
 * @returns リフレッシュされたセッション、または失敗の結果
 */
export async function refreshSessionAction(): Promise<
  ActionResult<SessionCookieData>
> {
  try {
    const session = await getSessionCookie()

    if (!session) {
      return {
        success: false,
        error: SESSION_ERRORS.NOT_FOUND,
      }
    }

    if (!isSessionValid(session)) {
      await clearSessionCookie()
      return {
        success: false,
        error: SESSION_ERRORS.EXPIRED,
      }
    }

    // セッションをリフレッシュ
    const refreshedSession = refreshSession(session)
    await setSessionCookie(refreshedSession)

    return {
      success: true,
      data: refreshedSession,
    }
  } catch (error) {
    console.error('[Session] Failed to refresh session:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
