/**
 * useSessionMigration Hook 統合テスト
 */

import { renderHook, waitFor } from '@testing-library/react'
import { createSessionAction } from '@/app/actions/cookieSessionActions'
import { useSessionMigration } from '@/hooks/useSessionMigration'
import {
  clearSecurePlayer,
  getSecurePlayerId,
  getSecurePlayerName,
  setSecurePlayer,
} from '@/utils/secureStorage'

// Server Actionsのモック
jest.mock('@/app/actions/cookieSessionActions', () => ({
  createSessionAction: jest.fn(),
}))

describe('useSessionMigration', () => {
  beforeEach(() => {
    // localStorageをクリア
    localStorage.clear()
    clearSecurePlayer()
    jest.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
    clearSecurePlayer()
  })

  describe('Migration Flow', () => {
    it('should not migrate when no localStorage session exists', async () => {
      const { result } = renderHook(() => useSessionMigration())

      // セッションがないため、すぐに完了
      await waitFor(() => {
        expect(result.current.migrated).toBe(true)
        expect(result.current.migrating).toBe(false)
        expect(result.current.error).toBeNull()
      })

      // createSessionActionは呼ばれない
      expect(createSessionAction).not.toHaveBeenCalled()
    })

    it('should migrate localStorage session to cookie', async () => {
      // localStorageにセッションを設定
      setSecurePlayer('player-123', 'TestPlayer')

      // createSessionActionをモック（成功）
      ;(createSessionAction as jest.Mock).mockResolvedValue({ success: true })

      const { result } = renderHook(() => useSessionMigration())

      // 初期状態
      expect(result.current.migrating).toBe(true)

      // 移行完了を待つ
      await waitFor(() => {
        expect(result.current.migrated).toBe(true)
        expect(result.current.migrating).toBe(false)
        expect(result.current.error).toBeNull()
      })

      // createSessionActionが正しい引数で呼ばれたか確認
      expect(createSessionAction).toHaveBeenCalledWith(
        'player-123',
        'TestPlayer'
      )
      expect(createSessionAction).toHaveBeenCalledTimes(1)

      // localStorageがクリアされたか確認
      expect(getSecurePlayerId()).toBeNull()
      expect(getSecurePlayerName()).toBeNull()
    })

    it('should handle migration failure gracefully', async () => {
      // localStorageにセッションを設定
      setSecurePlayer('player-456', 'FailPlayer')

      // createSessionActionをモック（失敗）
      ;(createSessionAction as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Migration failed',
      })

      const { result } = renderHook(() => useSessionMigration())

      // 移行完了（エラー）を待つ
      await waitFor(() => {
        expect(result.current.migrated).toBe(false)
        expect(result.current.migrating).toBe(false)
        expect(result.current.error).toBe('Migration failed')
      })

      // createSessionActionが呼ばれた
      expect(createSessionAction).toHaveBeenCalledWith(
        'player-456',
        'FailPlayer'
      )

      // localStorageは保持される（フォールバック用）
      expect(getSecurePlayerId()).toBe('player-456')
      expect(getSecurePlayerName()).toBe('FailPlayer')
    })

    it('should handle unexpected errors during migration', async () => {
      // localStorageにセッションを設定
      setSecurePlayer('player-789', 'ErrorPlayer')

      // createSessionActionをモック（例外スロー）
      ;(createSessionAction as jest.Mock).mockRejectedValue(
        new Error('Network error')
      )

      const { result } = renderHook(() => useSessionMigration())

      // エラーハンドリングを待つ
      await waitFor(() => {
        expect(result.current.migrated).toBe(false)
        expect(result.current.migrating).toBe(false)
        expect(result.current.error).toBe('Network error')
      })

      // localStorageは保持される
      expect(getSecurePlayerId()).toBe('player-789')
      expect(getSecurePlayerName()).toBe('ErrorPlayer')
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing playerName', async () => {
      // playerIdのみ設定（playerNameなし）
      localStorage.setItem('secure_player_id', 'encrypted-id')

      const { result } = renderHook(() => useSessionMigration())

      await waitFor(() => {
        expect(result.current.migrated).toBe(true)
        expect(result.current.migrating).toBe(false)
      })

      // playerNameがないため移行されない
      expect(createSessionAction).not.toHaveBeenCalled()
    })

    it('should handle missing playerId', async () => {
      // playerNameのみ設定（playerIdなし）
      localStorage.setItem('secure_player_name', 'encrypted-name')

      const { result } = renderHook(() => useSessionMigration())

      await waitFor(() => {
        expect(result.current.migrated).toBe(true)
        expect(result.current.migrating).toBe(false)
      })

      // playerIdがないため移行されない
      expect(createSessionAction).not.toHaveBeenCalled()
    })
  })

  describe('Migration State', () => {
    it('should complete migration quickly when no session exists', async () => {
      const { result } = renderHook(() => useSessionMigration())

      // useEffectは非同期なので、完了を待つ
      await waitFor(() => {
        expect(result.current.migrating).toBe(false)
        expect(result.current.migrated).toBe(true)
        expect(result.current.error).toBeNull()
      })
    })

    it('should transition through states correctly', async () => {
      setSecurePlayer('player-999', 'StatePlayer')
      ;(createSessionAction as jest.Mock).mockResolvedValue({ success: true })

      const { result } = renderHook(() => useSessionMigration())

      // 初期: migrating
      expect(result.current.migrating).toBe(true)
      expect(result.current.migrated).toBe(false)

      // 完了: migrated
      await waitFor(() => {
        expect(result.current.migrating).toBe(false)
        expect(result.current.migrated).toBe(true)
      })
    })
  })
})
