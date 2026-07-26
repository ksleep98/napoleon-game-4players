/**
 * セッションクッキーユーティリティのユニットテスト
 */

import { SESSION_DURATION_MS, SESSION_RENEW_INTERVAL_MS } from '@/lib/constants'
import {
  isSessionValid,
  refreshSession,
  type SessionCookieData,
  shouldExtendSession,
} from '@/lib/cookies/sessionCookies'

const ONE_MINUTE_MS = 60000

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
        createdAt: Date.now() - SESSION_DURATION_MS / 2, // 1時間前に発行
        expiresAt: Date.now() + SESSION_DURATION_MS / 2, // 残り1時間
      }

      const refreshed = refreshSession(originalSession)

      // プレイヤー情報は変わらない
      expect(refreshed.playerId).toBe(originalSession.playerId)
      expect(refreshed.playerName).toBe(originalSession.playerName)
      expect(refreshed.sessionToken).toBe(originalSession.sessionToken)

      // createdAtが更新される
      expect(refreshed.createdAt).toBeGreaterThan(originalSession.createdAt)

      // expiresAtがアイドルタイムアウト分だけ先に更新される
      const expectedExpiry = refreshed.createdAt + SESSION_DURATION_MS
      expect(Math.abs(refreshed.expiresAt - expectedExpiry)).toBeLessThan(100) // 100ms以内の誤差許容

      // 期限が過去になることは無い
      expect(refreshed.expiresAt).toBeGreaterThan(Date.now())
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

  describe('shouldExtendSession（再発行の閾値判定）', () => {
    const NOW = 1700000000000

    const sessionExpiringAt = (expiresAt: number): SessionCookieData => ({
      playerId: 'test-123',
      playerName: 'TestPlayer',
      sessionToken: 'token-123',
      createdAt: expiresAt - SESSION_DURATION_MS,
      expiresAt,
    })

    it('does not re-issue a freshly issued cookie', () => {
      const session = sessionExpiringAt(NOW + SESSION_DURATION_MS)

      expect(shouldExtendSession(session, NOW)).toBe(false)
    })

    it('does not re-issue before the renew interval has elapsed', () => {
      // 前回発行から「再発行間隔 - 1分」しか経っていない
      const elapsed = SESSION_RENEW_INTERVAL_MS - ONE_MINUTE_MS
      const session = sessionExpiringAt(NOW + SESSION_DURATION_MS - elapsed)

      expect(shouldExtendSession(session, NOW)).toBe(false)
    })

    it('re-issues once the renew interval has elapsed', () => {
      // 前回発行から「再発行間隔 + 1分」経過
      const elapsed = SESSION_RENEW_INTERVAL_MS + ONE_MINUTE_MS
      const session = sessionExpiringAt(NOW + SESSION_DURATION_MS - elapsed)

      expect(shouldExtendSession(session, NOW)).toBe(true)
    })

    it('re-issues a nearly expired cookie', () => {
      const session = sessionExpiringAt(NOW + ONE_MINUTE_MS)

      expect(shouldExtendSession(session, NOW)).toBe(true)
    })

    it('re-issues a legacy cookie whose expiry exceeds the current policy', () => {
      // 旧ポリシー（24時間）のクッキーは現行ポリシーへ縮めて揃える
      const legacyDurationMs = 86400000
      const session = sessionExpiringAt(NOW + legacyDurationMs)

      expect(shouldExtendSession(session, NOW)).toBe(true)
    })
  })

  describe('スライディング期限（2時間アイドルタイムアウト）', () => {
    const START = 1700000000000

    const issueSession = (): SessionCookieData => ({
      playerId: 'test-123',
      playerName: 'TestPlayer',
      sessionToken: 'token-123',
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_DURATION_MS,
    })

    /** 活動1回分（認可成功時の延長処理）を再現する */
    const act = (session: SessionCookieData): SessionCookieData =>
      shouldExtendSession(session) ? refreshSession(session) : session

    beforeEach(() => {
      jest.useFakeTimers()
      jest.setSystemTime(START)
    })

    afterEach(() => {
      jest.useRealTimers()
    })

    it('stays valid indefinitely while the player keeps acting', () => {
      let session = issueSession()

      // 30分間隔で5時間活動し続ける（固定24時間ならこの時点でも有効だが、
      // ここで見たいのは「延長されているので失効しない」こと）
      for (let i = 0; i < 10; i += 1) {
        jest.advanceTimersByTime(30 * ONE_MINUTE_MS)
        session = act(session)
        expect(isSessionValid(session)).toBe(true)
      }

      // 最後の活動時刻から2時間先まではまだ有効
      expect(session.expiresAt).toBe(Date.now() + SESSION_DURATION_MS)
    })

    it('survives an idle gap shorter than the effective idle timeout', () => {
      let session = issueSession()

      // 実効アイドルタイムアウトの下限（2時間 - 再発行間隔）より短い無活動
      jest.advanceTimersByTime(
        SESSION_DURATION_MS - SESSION_RENEW_INTERVAL_MS - ONE_MINUTE_MS
      )

      expect(isSessionValid(session)).toBe(true)

      session = act(session)

      expect(session.expiresAt).toBe(Date.now() + SESSION_DURATION_MS)
    })

    it('expires after 2 hours of inactivity', () => {
      const session = issueSession()

      jest.advanceTimersByTime(SESSION_DURATION_MS - ONE_MINUTE_MS)
      expect(isSessionValid(session)).toBe(true)

      jest.advanceTimersByTime(ONE_MINUTE_MS)
      expect(isSessionValid(session)).toBe(false)
    })

    it('expires 2 hours after the LAST activity, not after creation', () => {
      let session = issueSession()

      // 1時間後に活動 → 期限が「その時刻 + 2時間」へ延びる
      jest.advanceTimersByTime(60 * ONE_MINUTE_MS)
      session = act(session)
      const lastActivityAt = Date.now()

      // 作成から2時間1分後（＝旧仕様の期限切れ相当）でもまだ有効
      jest.advanceTimersByTime(61 * ONE_MINUTE_MS)
      expect(isSessionValid(session)).toBe(true)

      // 最終活動から2時間経過すると失効する
      jest.setSystemTime(lastActivityAt + SESSION_DURATION_MS)
      expect(isSessionValid(session)).toBe(false)
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
