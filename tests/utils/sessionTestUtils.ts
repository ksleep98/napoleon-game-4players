/**
 * Server Action 認可テスト用ヘルパー
 *
 * 利用するテストファイルは必ず以下のモックを宣言すること:
 *
 * ```ts
 * jest.mock('@/lib/cookies/sessionCookies', () => ({
 *   getSessionCookie: jest.fn(),
 *   isSessionValid: jest.fn(),
 *   refreshSession: jest.fn(),
 *   setSessionCookie: jest.fn(),
 *   shouldExtendSession: jest.fn(),
 * }))
 * ```
 *
 * `refreshSession` / `setSessionCookie` / `shouldExtendSession` は
 * `getAuthenticatedPlayerId()` のスライディング期限延長で使われる。
 * 既定では `shouldExtendSession` が undefined を返すため延長は発生しない。
 */

import type { SessionCookieData } from '@/lib/cookies/sessionCookies'
import { getSessionCookie, isSessionValid } from '@/lib/cookies/sessionCookies'

const ONE_HOUR_MS = 3600000

export function createSessionData(playerId: string): SessionCookieData {
  const now = Date.now()
  return {
    playerId,
    playerName: 'Test Player',
    sessionToken: 'test-session-token',
    createdAt: now,
    expiresAt: now + ONE_HOUR_MS,
  }
}

/** 指定 playerId で認証済みのクッキーセッションを再現する */
export function mockAuthenticatedSession(playerId: string): void {
  ;(getSessionCookie as jest.Mock).mockResolvedValue(
    createSessionData(playerId)
  )
  ;(isSessionValid as jest.Mock).mockReturnValue(true)
}

/** クッキーが存在しない（未認証）状態を再現する */
export function mockNoSession(): void {
  ;(getSessionCookie as jest.Mock).mockResolvedValue(null)
  ;(isSessionValid as jest.Mock).mockReturnValue(false)
}

/** クッキーは存在するが期限切れの状態を再現する */
export function mockExpiredSession(playerId: string): void {
  ;(getSessionCookie as jest.Mock).mockResolvedValue(
    createSessionData(playerId)
  )
  ;(isSessionValid as jest.Mock).mockReturnValue(false)
}
