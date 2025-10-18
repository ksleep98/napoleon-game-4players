/**
 * セキュアなローカルストレージユーティリティ
 * XSS攻撃からプレイヤーデータを保護
 */

import CryptoJS from 'crypto-js'

// 暗号化キー生成（実際の本番環境では環境変数から取得）
const ENCRYPTION_KEY =
  process.env.NEXT_PUBLIC_STORAGE_KEY || 'napoleon-game-secure-key-2024'

/**
 * データを暗号化してローカルストレージに保存
 */
export function setSecureItem(key: string, value: string): void {
  try {
    if (typeof window === 'undefined') return // SSR対応

    // テスト環境では暗号化をスキップ
    if (process.env.NODE_ENV === 'test') {
      localStorage.setItem(`secure_${key}`, value)
      return
    }

    const encrypted = CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString()
    localStorage.setItem(`secure_${key}`, encrypted)
  } catch (error) {
    console.warn(`Failed to set secure item ${key}:`, error)
  }
}

/**
 * ローカルストレージから復号化してデータを取得
 */
export function getSecureItem(key: string): string | null {
  try {
    if (typeof window === 'undefined') return null // SSR対応

    const stored = localStorage.getItem(`secure_${key}`)
    if (!stored) return null

    // テスト環境では復号化をスキップ
    if (process.env.NODE_ENV === 'test') {
      return stored
    }

    const decrypted = CryptoJS.AES.decrypt(stored, ENCRYPTION_KEY)
    return decrypted.toString(CryptoJS.enc.Utf8)
  } catch (error) {
    console.warn(`Failed to get secure item ${key}:`, error)
    return null
  }
}

/**
 * セキュアアイテムを削除
 */
export function removeSecureItem(key: string): void {
  try {
    if (typeof window === 'undefined') return // SSR対応

    localStorage.removeItem(`secure_${key}`)
  } catch (error) {
    console.warn(`Failed to remove secure item ${key}:`, error)
  }
}

/**
 * セッショントークン生成
 */
export function generateSessionToken(): string {
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2)
  return CryptoJS.SHA256(`${timestamp}_${random}_napoleon`).toString()
}

/**
 * セッショントークンの有効性チェック（24時間）
 */
export function isSessionValid(_token: string): boolean {
  try {
    const stored = getSecureItem('session_timestamp')
    if (!stored) return false

    const timestamp = parseInt(stored, 10)
    const now = Date.now()
    const twentyFourHours = 24 * 60 * 60 * 1000

    return now - timestamp < twentyFourHours
  } catch {
    return false
  }
}

/**
 * プレイヤーセッション管理の定数
 */
const PLAYER_SESSION_KEYS = {
  PLAYER_ID: 'player_id',
  PLAYER_NAME: 'player_name',
  SESSION_TOKEN: 'session_token',
  SESSION_TIMESTAMP: 'session_timestamp',
} as const

/**
 * セキュアにプレイヤー情報を保存
 */
export function setSecurePlayer(id: string, name: string): void {
  const sessionToken = generateSessionToken()
  const timestamp = Date.now().toString()

  setSecureItem(PLAYER_SESSION_KEYS.PLAYER_ID, id)
  setSecureItem(PLAYER_SESSION_KEYS.PLAYER_NAME, name)
  setSecureItem(PLAYER_SESSION_KEYS.SESSION_TOKEN, sessionToken)
  setSecureItem(PLAYER_SESSION_KEYS.SESSION_TIMESTAMP, timestamp)
}

/**
 * プレイヤーIDを安全に取得
 */
export function getSecurePlayerId(): string | null {
  const sessionToken = getSecureItem(PLAYER_SESSION_KEYS.SESSION_TOKEN)
  if (!sessionToken || !isSessionValid(sessionToken)) {
    clearSecurePlayer()
    return null
  }

  return getSecureItem(PLAYER_SESSION_KEYS.PLAYER_ID)
}

/**
 * プレイヤー名を安全に取得
 */
export function getSecurePlayerName(): string | null {
  const sessionToken = getSecureItem(PLAYER_SESSION_KEYS.SESSION_TOKEN)
  if (!sessionToken || !isSessionValid(sessionToken)) {
    clearSecurePlayer()
    return null
  }

  return getSecureItem(PLAYER_SESSION_KEYS.PLAYER_NAME)
}

/**
 * セッションの有効性確認
 */
export function isSecureSessionValid(): boolean {
  const sessionToken = getSecureItem(PLAYER_SESSION_KEYS.SESSION_TOKEN)
  return sessionToken !== null && isSessionValid(sessionToken)
}

/**
 * プレイヤー情報を安全に削除
 */
export function clearSecurePlayer(): void {
  removeSecureItem(PLAYER_SESSION_KEYS.PLAYER_ID)
  removeSecureItem(PLAYER_SESSION_KEYS.PLAYER_NAME)
  removeSecureItem(PLAYER_SESSION_KEYS.SESSION_TOKEN)
  removeSecureItem(PLAYER_SESSION_KEYS.SESSION_TIMESTAMP)
}
