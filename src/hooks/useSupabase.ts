'use client'

import { useCallback, useEffect, useState } from 'react'
import { getPlayerSession, setPlayerSession } from '@/lib/supabase/client'
import {
  setPlayerOffline,
  setPlayerOnline,
  subscribeToConnectionState,
  subscribeToGameRoom,
  subscribeToGameState,
} from '@/lib/supabase/secureGameService'
import type { GameRoom, GameState, Player } from '@/types/game'

// 接続状態フック
export function useConnectionState() {
  const [connectionState, setConnectionState] = useState<
    'CONNECTING' | 'OPEN' | 'CLOSED'
  >('CONNECTING')
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    // ネットワーク状態監視
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Supabase接続状態監視
    const unsubscribe = subscribeToConnectionState(setConnectionState)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      unsubscribe()
    }
  }, [])

  return {
    connectionState,
    isOnline,
    isConnected: connectionState === 'OPEN' && isOnline,
  }
}

// ゲーム状態監視フック
export function useGameState(gameId: string | null) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!gameId) return

    setLoading(true)
    setError(null)

    const unsubscribe = subscribeToGameState(
      gameId,
      (newGameState) => {
        setGameState(newGameState)
        setLoading(false)
      },
      (err) => {
        setError(err)
        setLoading(false)
      }
    )

    return unsubscribe
  }, [gameId])

  return { gameState, loading, error }
}

// ゲームルーム監視フック
export function useGameRoom(roomId: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!roomId) return

    setLoading(true)
    setError(null)

    const unsubscribe = subscribeToGameRoom(roomId, {
      onRoomUpdate: (updatedRoom) => {
        setRoom(updatedRoom)
        setLoading(false)
      },
      onPlayerJoin: (player) => {
        setPlayers((prev) => {
          const exists = prev.some((p) => p.id === player.id)
          return exists ? prev : [...prev, player]
        })
      },
      onPlayerLeave: (playerId) => {
        setPlayers((prev) => prev.filter((p) => p.id !== playerId))
      },
      onError: (err) => {
        setError(err)
        setLoading(false)
      },
    })

    return unsubscribe
  }, [roomId])

  return { room, players, loading, error }
}

// プレイヤーセッション管理フック
export function usePlayerSession() {
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [playerName, setPlayerName] = useState<string | null>(null)

  useEffect(() => {
    // 初期化時にセキュアストレージから復元
    const initializeSession = async () => {
      try {
        const { SecurePlayerSession } = await import('@/utils/secureStorage')

        // セキュアストレージから取得を試行
        const securePlayerId = SecurePlayerSession.getPlayerId()
        const securePlayerName = SecurePlayerSession.getPlayerName()

        if (securePlayerId && SecurePlayerSession.isValid()) {
          setPlayerId(securePlayerId)
          setPlayerName(securePlayerName)
        } else {
          // フォールバック: 従来のlocalStorageから取得
          const legacyPlayerId = getPlayerSession()
          const legacyPlayerName = localStorage.getItem('napoleon_player_name')

          if (legacyPlayerId && legacyPlayerName) {
            // セキュアストレージに移行
            SecurePlayerSession.setPlayer(legacyPlayerId, legacyPlayerName)
            setPlayerId(legacyPlayerId)
            setPlayerName(legacyPlayerName)
          }
        }
      } catch (error) {
        console.warn(
          'Failed to initialize secure session, using fallback:',
          error
        )
        // 完全なフォールバック
        const savedPlayerId = getPlayerSession()
        const savedPlayerName = localStorage.getItem('napoleon_player_name')
        setPlayerId(savedPlayerId)
        setPlayerName(savedPlayerName)
      }
    }

    initializeSession()
  }, [])

  const initializePlayer = useCallback(async (id: string, name: string) => {
    try {
      // セキュアストレージにプレイヤー情報を保存
      const { SecurePlayerSession } = await import('@/utils/secureStorage')
      SecurePlayerSession.setPlayer(id, name)

      await setPlayerSession(id)
      setPlayerId(id)
      setPlayerName(name)

      // レガシーサポート（段階的移行のため）
      localStorage.setItem('napoleon_player_name', name)

      // オンライン状態に設定
      await setPlayerOnline(id)
    } catch (error) {
      throw new Error(`Failed to initialize player: ${error}`)
    }
  }, [])

  const clearPlayer = useCallback(async () => {
    try {
      if (playerId) {
        await setPlayerOffline(playerId)
      }

      // セキュアストレージをクリア
      const { SecurePlayerSession } = await import('@/utils/secureStorage')
      SecurePlayerSession.clearPlayer()

      // レガシーサポート
      localStorage.removeItem('napoleon_player_id')
      localStorage.removeItem('napoleon_player_name')

      setPlayerId(null)
      setPlayerName(null)
    } catch (error) {
      console.warn('Failed to clear player session:', error)
    }
  }, [playerId])

  return {
    playerId,
    playerName,
    isAuthenticated: !!playerId,
    initializePlayer,
    clearPlayer,
  }
}

// ゲーム操作用フック
export function useGameActions() {
  const { isConnected } = useConnectionState()
  const { playerId } = usePlayerSession()

  const executeAction = useCallback(
    async <T>(
      action: () => Promise<T>,
      errorMessage = 'Game action failed'
    ): Promise<T> => {
      if (!isConnected) {
        throw new Error('Not connected to server')
      }

      if (!playerId) {
        throw new Error('Player not authenticated')
      }

      try {
        return await action()
      } catch (error) {
        const message = error instanceof Error ? error.message : errorMessage
        throw new Error(message)
      }
    },
    [isConnected, playerId]
  )

  return {
    executeAction,
    canExecuteActions: isConnected && !!playerId,
  }
}
