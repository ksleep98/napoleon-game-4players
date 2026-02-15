/**
 * httpOnlyクッキーセッション管理Hook
 * Phase 3（クッキー優先フェーズ）で使用
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  clearSessionAction,
  getSessionAction,
  refreshSessionAction,
} from '@/app/actions/cookieSessionActions'
import type { SessionCookieData } from '@/lib/cookies/sessionCookies'

export interface CookieSessionState {
  session: SessionCookieData | null
  loading: boolean
  error: string | null
  playerId: string | null
  playerName: string | null
}

export interface CookieSessionActions {
  refresh: () => Promise<void>
  logout: () => Promise<void>
  refreshWithExtension: () => Promise<void>
}

/**
 * httpOnlyクッキーセッションを管理するHook
 *
 * 使用例:
 * ```tsx
 * function GameComponent() {
 *   const { session, loading, playerId, playerName, logout, refresh } = useCookieSession();
 *
 *   if (loading) {
 *     return <LoadingSpinner />;
 *   }
 *
 *   if (!session) {
 *     return <LoginPrompt />;
 *   }
 *
 *   return (
 *     <div>
 *       <p>Welcome, {playerName}!</p>
 *       <button onClick={logout}>Logout</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCookieSession(): CookieSessionState & CookieSessionActions {
  const [state, setState] = useState<CookieSessionState>({
    session: null,
    loading: true,
    error: null,
    playerId: null,
    playerName: null,
  })

  /**
   * セッションを読み込む
   */
  const loadSession = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))

    try {
      const result = await getSessionAction()

      if (result.success && result.data) {
        setState({
          session: result.data,
          loading: false,
          error: null,
          playerId: result.data.playerId,
          playerName: result.data.playerName,
        })
      } else {
        setState({
          session: null,
          loading: false,
          error: result.error || null,
          playerId: null,
          playerName: null,
        })
      }
    } catch (error) {
      console.error('[CookieSession] Failed to load session:', error)
      setState({
        session: null,
        loading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        playerId: null,
        playerName: null,
      })
    }
  }, [])

  /**
   * ログアウト（セッションクリア）
   */
  const logout = useCallback(async () => {
    try {
      await clearSessionAction()
      setState({
        session: null,
        loading: false,
        error: null,
        playerId: null,
        playerName: null,
      })
    } catch (error) {
      console.error('[CookieSession] Failed to logout:', error)
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Logout failed',
      }))
    }
  }, [])

  /**
   * セッションをリフレッシュ（再読み込み）
   */
  const refresh = useCallback(async () => {
    await loadSession()
  }, [loadSession])

  /**
   * セッションをリフレッシュ（有効期限延長）
   */
  const refreshWithExtension = useCallback(async () => {
    try {
      const result = await refreshSessionAction()

      if (result.success && result.data) {
        setState({
          session: result.data,
          loading: false,
          error: null,
          playerId: result.data.playerId,
          playerName: result.data.playerName,
        })
      } else {
        // リフレッシュ失敗時はログアウト状態に
        setState({
          session: null,
          loading: false,
          error: result.error || null,
          playerId: null,
          playerName: null,
        })
      }
    } catch (error) {
      console.error('[CookieSession] Failed to refresh session:', error)
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Refresh failed',
      }))
    }
  }, [])

  // 初回マウント時にセッション読み込み
  useEffect(() => {
    loadSession()
  }, [loadSession])

  return {
    ...state,
    refresh,
    logout,
    refreshWithExtension,
  }
}

/**
 * セッション存在確認のみのシンプル版Hook
 */
export function useCookieSessionSimple(): {
  isAuthenticated: boolean
  loading: boolean
} {
  const { session, loading } = useCookieSession()

  return {
    isAuthenticated: session !== null,
    loading,
  }
}
