/**
 * httpOnlyクッキーセッション管理ユーティリティ
 * XSS攻撃からセッショントークンを保護
 */

import { cookies } from 'next/headers'
import {
  SESSION_DURATION_MS,
  SESSION_MAX_AGE_SECONDS,
  SESSION_RENEW_INTERVAL_MS,
} from '@/lib/constants'
import { decryptData, encryptData } from '@/utils/encryption'

export interface SessionCookieData {
  playerId: string
  playerName: string
  sessionToken: string
  createdAt: number
  expiresAt: number
}

const COOKIE_NAME = 'napoleon_session'

/**
 * クッキーオプション設定
 * - httpOnly: JavaScriptからアクセス不可（XSS保護）
 * - secure: HTTPS必須（本番環境のみ）
 * - sameSite: CSRF保護
 */
const getCookieOptions = () => ({
  httpOnly: true,
  secure: true,
  sameSite: 'strict' as const,
  maxAge: SESSION_MAX_AGE_SECONDS,
  path: '/',
})

/**
 * セッションクッキーを設定（暗号化）
 * @param data セッションデータ
 */
export async function setSessionCookie(data: SessionCookieData): Promise<void> {
  try {
    const encrypted = encryptData(JSON.stringify(data))
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, encrypted, getCookieOptions())
  } catch (error) {
    console.error('[SessionCookie] Failed to set session cookie:', error)
    throw new Error('Failed to set session cookie')
  }
}

/**
 * セッションクッキーを取得（復号化）
 * @returns セッションデータ、または存在しない場合null
 */
export async function getSessionCookie(): Promise<SessionCookieData | null> {
  try {
    const cookieStore = await cookies()
    const encrypted = cookieStore.get(COOKIE_NAME)?.value

    if (!encrypted) {
      return null
    }

    const decrypted = decryptData(encrypted)
    const session: SessionCookieData = JSON.parse(decrypted)

    return session
  } catch (error) {
    console.error('[SessionCookie] Failed to get session cookie:', error)
    return null
  }
}

/**
 * セッションクッキーを削除
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
  } catch (error) {
    console.error('[SessionCookie] Failed to clear session cookie:', error)
    throw new Error('Failed to clear session cookie')
  }
}

/**
 * セッション有効性チェック（有効期限確認）
 * @param session セッションデータ
 * @returns 有効ならtrue
 */
export function isSessionValid(session: SessionCookieData): boolean {
  return Date.now() < session.expiresAt
}

/**
 * セッション有効期限を延長（リフレッシュ）
 *
 * 期限は常に「現在時刻 + SESSION_DURATION_MS」の絶対時刻で書き直す。
 * 現在時刻起点なので過去の値になることはない。
 *
 * @param session 既存のセッションデータ
 * @returns 更新されたセッションデータ
 */
export function refreshSession(session: SessionCookieData): SessionCookieData {
  const now = Date.now()
  return {
    ...session,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  }
}

/**
 * セッションクッキーを再発行すべきか判定する（スライディング期限）
 *
 * 全 Server Action の応答に Set-Cookie を付けるのは無駄なので、
 * 前回発行から SESSION_RENEW_INTERVAL_MS 以上経過した場合のみ再発行する。
 *
 * 残り寿命が SESSION_DURATION_MS を超えている場合も再発行する。
 * これは新ポリシーより長い期限を持つ旧クッキー（24時間版）や、
 * 異常に先の時刻が書かれたクッキーを現行ポリシーへ揃えるため。
 *
 * @param session 有効期限内のセッションデータ
 * @param now 判定基準時刻（テスト用。既定は現在時刻）
 * @returns 再発行すべきなら true
 */
export function shouldExtendSession(
  session: SessionCookieData,
  now: number = Date.now()
): boolean {
  const remainingMs = session.expiresAt - now

  if (remainingMs > SESSION_DURATION_MS) {
    return true
  }

  return remainingMs < SESSION_DURATION_MS - SESSION_RENEW_INTERVAL_MS
}
