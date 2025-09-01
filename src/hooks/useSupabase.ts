'use client'

import { useCallback, useEffect, useState } from 'react'
import { setPlayerSession } from '@/lib/supabase/client'
import {
  setPlayerOffline,
  setPlayerOnline,
  subscribeToConnectionState,
  subscribeToGameRoom,
  subscribeToGameState,
} from '@/lib/supabase/secureGameService'
import type { GameRoom, GameState, Player } from '@/types/game'
import {
  clearSecurePlayer,
  getSecurePlayerId,
  getSecurePlayerName,
  isSecureSessionValid,
  setSecurePlayer,
} from '@/utils/secureStorage'

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
  const { playerId, isAuthenticated } = usePlayerSession()

  useEffect(() => {
    if (!gameId || !isAuthenticated || !playerId) return

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
  }, [gameId, isAuthenticated, playerId])

  return { gameState, loading, error }
}

// ゲームルーム監視フック
export function useGameRoom(roomId: string | null) {
  const [room, setRoom] = useState<GameRoom | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const { playerId, isAuthenticated } = usePlayerSession()

  useEffect(() => {
    if (!roomId || !isAuthenticated || !playerId) return

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
  }, [roomId, isAuthenticated, playerId])

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
        // セキュアストレージから取得を試行
        const securePlayerId = getSecurePlayerId()
        const securePlayerName = getSecurePlayerName()

        if (securePlayerId && isSecureSessionValid()) {
          setPlayerId(securePlayerId)
          setPlayerName(securePlayerName)
        }
      } catch (error) {
        console.warn('Failed to initialize secure session:', error)
      }
    }

    initializeSession()
  }, [])

  const initializePlayer = useCallback(async (id: string, name: string) => {
    try {
      // セキュアストレージにプレイヤー情報を保存
      setSecurePlayer(id, name)

      await setPlayerSession(id)
      setPlayerId(id)
      setPlayerName(name)

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
      clearSecurePlayer()

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
