/**
 * usePlayerSession Hook テスト
 * Phase 5: httpOnly Cookie only (localStorage完全削除)
 */

import { renderHook, waitFor } from '@testing-library/react'
import { act } from 'react'
import {
  clearSessionAction,
  createSessionAction,
  getSessionAction,
} from '@/app/actions/cookieSessionActions'
import { usePlayerSession } from '@/hooks/useSupabase'
import { setPlayerSession } from '@/lib/supabase/client'
import {
  setPlayerOffline,
  setPlayerOnline,
} from '@/lib/supabase/secureGameService'

// Server Actionsのモック
jest.mock('@/app/actions/cookieSessionActions', () => ({
  createSessionAction: jest.fn(),
  getSessionAction: jest.fn(),
  clearSessionAction: jest.fn(),
}))

// Supabaseクライアントのモック
jest.mock('@/lib/supabase/client', () => ({
  setPlayerSession: jest.fn(),
}))

// Supabaseゲームサービスのモック
jest.mock('@/lib/supabase/secureGameService', () => ({
  setPlayerOnline: jest.fn(),
  setPlayerOffline: jest.fn(),
}))

describe('usePlayerSession (Phase 5: httpOnly Cookie Only)', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('Initialization', () => {
    it('should initialize from httpOnly cookie', async () => {
      // クッキーセッションをモック
      ;(getSessionAction as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          playerId: 'cookie-player-id',
          playerName: 'CookiePlayer',
        },
      })

      const { result } = renderHook(() => usePlayerSession())

      // 初期状態
      expect(result.current.isAuthenticated).toBe(false)

      // クッキーセッション読み込み完了を待つ
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.playerId).toBe('cookie-player-id')
        expect(result.current.playerName).toBe('CookiePlayer')
      })

      // クッキーが読み込まれた
      expect(getSessionAction).toHaveBeenCalledTimes(1)
    })

    it('should not authenticate when no cookie exists', async () => {
      // クッキーなし
      ;(getSessionAction as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Session not found',
      })

      const { result } = renderHook(() => usePlayerSession())

      // セッションなしのまま
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.playerId).toBeNull()
        expect(result.current.playerName).toBeNull()
      })

      expect(getSessionAction).toHaveBeenCalledTimes(1)
    })

    it('should handle getSessionAction error', async () => {
      // getSessionAction が例外をスロー
      ;(getSessionAction as jest.Mock).mockRejectedValue(
        new Error('Network error')
      )

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      const { result } = renderHook(() => usePlayerSession())

      // エラーハンドリング
      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to initialize session:',
          expect.any(Error)
        )
        expect(result.current.isAuthenticated).toBe(false)
      })

      consoleWarnSpy.mockRestore()
    })
  })

  describe('initializePlayer (httpOnly Cookie Only)', () => {
    it('should save to httpOnly cookie', async () => {
      // クッキー保存成功
      ;(createSessionAction as jest.Mock).mockResolvedValue({ success: true })
      ;(setPlayerSession as jest.Mock).mockResolvedValue(undefined)
      ;(setPlayerOnline as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => usePlayerSession())

      await act(async () => {
        await result.current.initializePlayer('player-123', 'TestPlayer')
      })

      // クッキー保存が呼ばれた
      expect(createSessionAction).toHaveBeenCalledWith(
        'player-123',
        'TestPlayer'
      )
      expect(createSessionAction).toHaveBeenCalledTimes(1)

      // Supabase RLS設定
      expect(setPlayerSession).toHaveBeenCalledWith('player-123')
      expect(setPlayerOnline).toHaveBeenCalledWith('player-123')

      // プレイヤーが認証された
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
        expect(result.current.playerId).toBe('player-123')
        expect(result.current.playerName).toBe('TestPlayer')
      })
    })

    it('should throw error when cookie save fails', async () => {
      // クッキー保存失敗
      ;(createSessionAction as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Cookie save failed',
      })
      ;(setPlayerSession as jest.Mock).mockResolvedValue(undefined)

      const { result } = renderHook(() => usePlayerSession())

      await expect(
        act(async () => {
          await result.current.initializePlayer('player-456', 'FailPlayer')
        })
      ).rejects.toThrow('Failed to create session: Cookie save failed')

      // クッキー保存が試行された
      expect(createSessionAction).toHaveBeenCalledWith(
        'player-456',
        'FailPlayer'
      )

      // プレイヤーは認証されない
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('clearPlayer (httpOnly Cookie Only)', () => {
    it('should clear httpOnly cookie', async () => {
      // 初期セッション設定
      ;(getSessionAction as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          playerId: 'player-789',
          playerName: 'ClearPlayer',
        },
      })

      const { result } = renderHook(() => usePlayerSession())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // クッキークリア成功
      ;(clearSessionAction as jest.Mock).mockResolvedValue({ success: true })
      ;(setPlayerOffline as jest.Mock).mockResolvedValue(undefined)

      await act(async () => {
        await result.current.clearPlayer()
      })

      // クッキークリアが呼ばれた
      expect(clearSessionAction).toHaveBeenCalledTimes(1)
      expect(setPlayerOffline).toHaveBeenCalledWith('player-789')

      // セッションがクリアされた
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
        expect(result.current.playerId).toBeNull()
        expect(result.current.playerName).toBeNull()
      })
    })

    it('should handle cookie clear failure gracefully', async () => {
      // 初期セッション設定
      ;(getSessionAction as jest.Mock).mockResolvedValue({
        success: true,
        data: {
          playerId: 'player-999',
          playerName: 'ErrorPlayer',
        },
      })

      const { result } = renderHook(() => usePlayerSession())

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true)
      })

      // クッキークリア失敗
      ;(clearSessionAction as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Clear failed',
      })
      ;(setPlayerOffline as jest.Mock).mockResolvedValue(undefined)

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()

      await act(async () => {
        await result.current.clearPlayer()
      })

      // エラーログ出力
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[Session] Cookie clear failed:',
        'Clear failed'
      )

      // それでもセッションはクリアされる
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false)
      })

      consoleWarnSpy.mockRestore()
    })
  })
})
