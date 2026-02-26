/**
 * セッションクッキーユーティリティのユニットテスト
 */

import {
  isSessionValid,
  refreshSession,
  type SessionCookieData,
} from '@/lib/cookies/sessionCookies'

describe('Session Cookie Utilities', () => {
  describe('isSessionValid', () => {
    it('should return true for valid session', () => {
      const session: SessionCookieData = {
        playerId: 'test-123',
        playerName: 'TestPlayer',
        sessionToken: 'token-123',
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000, // 24時間後
      }

      expect(isSessionValid(session)).toBe(true)
    })

    it('should return false for expired session', () => {
      const session: SessionCookieData = {
        playerId: 'test-123',
        playerName: 'TestPlayer',
        sessionToken: 'token-123',
        createdAt: Date.now() - 90000000, // 25時間前
        expiresAt: Date.now() - 3600000, // 1時間前（期限切れ）
      }

      expect(isSessionValid(session)).toBe(false)
    })

    it('should return false for session expiring now', () => {
      const session: SessionCookieData = {
        playerId: 'test-123',
        playerName: 'TestPlayer',
        sessionToken: 'token-123',
        createdAt: Date.now() - 86400000,
        expiresAt: Date.now(), // 今まさに期限切れ
      }

      expect(isSessionValid(session)).toBe(false)
    })

    it('should return true for session expiring in 1 minute', () => {
      const session: SessionCookieData = {
        playerId: 'test-123',
        playerName: 'TestPlayer',
        sessionToken: 'token-123',
        createdAt: Date.now() - 86340000, // 23時間59分前
        expiresAt: Date.now() + 60000, // 1分後
      }

      expect(isSessionValid(session)).toBe(true)
    })
  })

  describe('refreshSession', () => {
    it('should extend session expiration', () => {
      const originalSession: SessionCookieData = {
        playerId: 'test-123',
        playerName: 'TestPlayer',
        sessionToken: 'token-123',
        createdAt: Date.now() - 43200000, // 12時間前
        expiresAt: Date.now() + 43200000, // 12時間後
      }

      const refreshed = refreshSession(originalSession)

      // プレイヤー情報は変わらない
      expect(refreshed.playerId).toBe(originalSession.playerId)
      expect(refreshed.playerName).toBe(originalSession.playerName)
      expect(refreshed.sessionToken).toBe(originalSession.sessionToken)

      // createdAtが更新される
      expect(refreshed.createdAt).toBeGreaterThan(originalSession.createdAt)

      // expiresAtが24時間後に更新される
      const expectedExpiry = refreshed.createdAt + 86400000
      expect(Math.abs(refreshed.expiresAt - expectedExpiry)).toBeLessThan(100) // 100ms以内の誤差許容
    })

    it('should create new timestamps while preserving session data', () => {
      const session: SessionCookieData = {
        playerId: 'player-abc',
        playerName: 'Alice',
        sessionToken: 'token-xyz',
        createdAt: 1000000000,
        expiresAt: 1000086400,
      }

      const refreshed = refreshSession(session)

      expect(refreshed.playerId).toBe('player-abc')
      expect(refreshed.playerName).toBe('Alice')
      expect(refreshed.sessionToken).toBe('token-xyz')
      expect(refreshed.createdAt).toBeGreaterThan(session.createdAt)
      expect(refreshed.expiresAt).toBeGreaterThan(session.expiresAt)
    })

    it('should make expired session valid again', () => {
      const expiredSession: SessionCookieData = {
        playerId: 'test-123',
        playerName: 'TestPlayer',
        sessionToken: 'token-123',
        createdAt: Date.now() - 90000000, // 25時間前
        expiresAt: Date.now() - 3600000, // 1時間前（期限切れ）
      }

      expect(isSessionValid(expiredSession)).toBe(false)

      const refreshed = refreshSession(expiredSession)

      expect(isSessionValid(refreshed)).toBe(true)
    })
  })

  describe('SessionCookieData structure', () => {
    it('should have correct data structure', () => {
      const session: SessionCookieData = {
        playerId: 'id-123',
        playerName: 'Player One',
        sessionToken: 'token-abc',
        createdAt: 1234567890,
        expiresAt: 1234654290,
      }

      expect(typeof session.playerId).toBe('string')
      expect(typeof session.playerName).toBe('string')
      expect(typeof session.sessionToken).toBe('string')
      expect(typeof session.createdAt).toBe('number')
      expect(typeof session.expiresAt).toBe('number')
    })

    it('should serialize to JSON correctly', () => {
      const session: SessionCookieData = {
        playerId: 'id-123',
        playerName: 'Player One',
        sessionToken: 'token-abc',
        createdAt: Date.now(),
        expiresAt: Date.now() + 86400000,
      }

      const json = JSON.stringify(session)
      const parsed: SessionCookieData = JSON.parse(json)

      expect(parsed.playerId).toBe(session.playerId)
      expect(parsed.playerName).toBe(session.playerName)
      expect(parsed.sessionToken).toBe(session.sessionToken)
      expect(parsed.createdAt).toBe(session.createdAt)
      expect(parsed.expiresAt).toBe(session.expiresAt)
    })
  })
})
