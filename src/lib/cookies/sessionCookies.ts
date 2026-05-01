/**
 * httpOnlyクッキーセッション管理ユーティリティ
 * XSS攻撃からセッショントークンを保護
 */

import { cookies } from 'next/headers'
import { decryptData, encryptData } from '@/utils/encryption'

export interface SessionCookieData {
  playerId: string
  playerName: string
  sessionToken: string
  createdAt: number
  expiresAt: number
}

const COOKIE_NAME = 'napoleon_session'
const COOKIE_MAX_AGE = 86400 // 24時間（秒）

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
  maxAge: COOKIE_MAX_AGE,
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
 * @param session 既存のセッションデータ
 * @returns 更新されたセッションデータ
 */
export function refreshSession(session: SessionCookieData): SessionCookieData {
  const now = Date.now()
  return {
    ...session,
    createdAt: now,
    expiresAt: now + COOKIE_MAX_AGE * 1000, // ミリ秒に変換
  }
}
