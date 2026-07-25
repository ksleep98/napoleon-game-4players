'use client'

import { useCallback, useEffect, useReducer, useState } from 'react'
import {
  clearSessionAction,
  createSessionAction,
  getSessionAction,
} from '@/app/actions/cookieSessionActions'
import { ACTION_TYPES, CONNECTION_STATES } from '@/lib/constants'
import { setPlayerSession } from '@/lib/supabase/client'
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
    keyof typeof CONNECTION_STATES
  >(CONNECTION_STATES.CONNECTING)
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
    isConnected: connectionState === CONNECTION_STATES.OPEN && isOnline,
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
      playerId, // Phase 4: playerId引数追加（localStorage依存削除）
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
interface PlayerSessionState {
  playerId: string | null
  playerName: string | null
  isAuthenticated: boolean
}

interface PlayerSessionAction {
  type:
    | typeof ACTION_TYPES.PLAYER_SESSION.INITIALIZE_PLAYER
    | typeof ACTION_TYPES.PLAYER_SESSION.CLEAR_PLAYER
    | typeof ACTION_TYPES.PLAYER_SESSION.SET_SESSION_FROM_SECURE
  payload?: {
    id?: string | null
    name?: string | null
  }
}

function playerSessionReducer(
  state: PlayerSessionState,
  action: PlayerSessionAction
): PlayerSessionState {
  switch (action.type) {
    case ACTION_TYPES.PLAYER_SESSION.INITIALIZE_PLAYER:
      return {
        playerId: action.payload?.id || null,
        playerName: action.payload?.name || null,
        isAuthenticated: !!action.payload?.id,
      }
    case ACTION_TYPES.PLAYER_SESSION.SET_SESSION_FROM_SECURE:
      return {
        playerId: action.payload?.id || null,
        playerName: action.payload?.name || null,
        isAuthenticated: !!action.payload?.id,
      }
    case ACTION_TYPES.PLAYER_SESSION.CLEAR_PLAYER:
      return {
        playerId: null,
        playerName: null,
        isAuthenticated: false,
      }
    default:
      return state
  }
}

export function usePlayerSession() {
  const [state, dispatch] = useReducer(playerSessionReducer, {
    playerId: null,
    playerName: null,
    isAuthenticated: false,
  })
  // クッキーの初回読み込みが完了したか（セッション未確立との区別に必要）
  const [isSessionLoaded, setIsSessionLoaded] = useState(false)

  useEffect(() => {
    const initializeSession = async () => {
      try {
        // Phase 5: httpOnlyクッキーのみ使用（localStorage完全削除）
        const cookieResult = await getSessionAction()

        if (cookieResult.success && cookieResult.data) {
          dispatch({
            type: ACTION_TYPES.PLAYER_SESSION.SET_SESSION_FROM_SECURE,
            payload: {
              id: cookieResult.data.playerId,
              name: cookieResult.data.playerName,
            },
          })
        }
      } catch (error) {
        console.warn('Failed to initialize session:', error)
      } finally {
        setIsSessionLoaded(true)
      }
    }

    initializeSession()
  }, [])

  const initializePlayer = useCallback(async (id: string, name: string) => {
    try {
      // Phase 5: httpOnlyクッキーのみ使用（localStorage完全削除）
      const cookieResult = await createSessionAction(id, name)

      if (!cookieResult.success) {
        throw new Error(
          `Failed to create session: ${cookieResult.error || 'Unknown error'}`
        )
      }

      // Supabase RLS設定
      await setPlayerSession(id)

      dispatch({
        type: ACTION_TYPES.PLAYER_SESSION.INITIALIZE_PLAYER,
        payload: { id, name },
      })

      await setPlayerOnline(id)
    } catch (error) {
      throw new Error(`Failed to initialize player: ${error}`)
    }
  }, [])

  const clearPlayer = useCallback(async () => {
    try {
      if (state.playerId) {
        await setPlayerOffline(state.playerId)
      }

      // Phase 5: httpOnlyクッキーのみクリア（localStorage完全削除）
      const cookieResult = await clearSessionAction()

      if (!cookieResult.success) {
        console.warn('[Session] Cookie clear failed:', cookieResult.error)
      }

      dispatch({ type: ACTION_TYPES.PLAYER_SESSION.CLEAR_PLAYER })
    } catch (error) {
      console.warn('Failed to clear player session:', error)
    }
  }, [state.playerId])

  return {
    playerId: state.playerId,
    playerName: state.playerName,
    isAuthenticated: state.isAuthenticated,
    isSessionLoaded,
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
