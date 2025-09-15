import { CONNECTION_STATES } from '@/lib/constants'
import type { GameRoom, GameState, Player } from '@/types/game'
import { supabase } from './client'

// カスタムエラー型
export class GameServiceError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message)
    this.name = 'GameServiceError'
  }
}

/**
 * ゲーム状態の変更をリアルタイムで監視（改良版）
 */
export function subscribeToGameState(
  gameId: string,
  onUpdate: (gameState: GameState) => void,
  onError?: (error: Error) => void
) {
  const channel = supabase
    .channel(`game_${gameId}`, {
      config: {
        broadcast: { self: false }, // 自分の変更は除外
        presence: { key: gameId },
      },
    })
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        try {
          const gameState = payload.new.state as GameState
          onUpdate(gameState)
        } catch (_error) {
          onError?.(new GameServiceError('Failed to parse game state update'))
        }
      }
    )
    .subscribe((status) => {
      if (
        status === CONNECTION_STATES.CLOSED ||
        status === CONNECTION_STATES.CHANNEL_ERROR ||
        status === CONNECTION_STATES.TIMED_OUT
      ) {
        onError?.(new GameServiceError('Failed to subscribe to game updates'))
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * ゲームルームとプレイヤーの変更を統合監視
 */
export function subscribeToGameRoom(
  roomId: string,
  callbacks: {
    onRoomUpdate?: (room: GameRoom) => void
    onPlayerJoin?: (player: Player) => void
    onPlayerLeave?: (playerId: string) => void
    onError?: (error: Error) => void
  }
) {
  // ルーム更新を監視
  const roomChannel = supabase
    .channel(`room_${roomId}`, {
      config: {
        broadcast: { self: false },
      },
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'game_rooms',
        filter: `id=eq.${roomId}`,
      },
      (payload) => {
        try {
          if (payload.new && callbacks.onRoomUpdate) {
            const newData = payload.new as Record<string, unknown>
            const room: GameRoom = {
              id: newData.id as string,
              name: newData.name as string,
              playerCount: newData.player_count as number,
              maxPlayers: newData.max_players as number,
              status: newData.status as 'waiting' | 'playing' | 'finished',
              hostPlayerId: newData.host_player_id as string,
              createdAt: new Date(newData.created_at as string),
            }
            callbacks.onRoomUpdate(room)
          }
        } catch (_error) {
          callbacks.onError?.(
            new GameServiceError('Failed to process room update')
          )
        }
      }
    )
    .subscribe()

  // プレイヤー変更を監視
  const playerChannel = supabase
    .channel(`room_players_${roomId}`, {
      config: {
        broadcast: { self: false },
      },
    })
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `room_id=eq.${roomId}`,
      },
      (payload) => {
        try {
          if (
            payload.eventType === 'INSERT' ||
            payload.eventType === 'UPDATE'
          ) {
            if (payload.new.connected && callbacks.onPlayerJoin) {
              const player: Player = {
                id: payload.new.id,
                name: payload.new.name,
                hand: [],
                isNapoleon: false,
                isAdjutant: false,
                position: 0, // 実際の位置は別途設定
                isAI: false,
              }
              callbacks.onPlayerJoin(player)
            }
          } else if (
            payload.eventType === 'DELETE' &&
            callbacks.onPlayerLeave
          ) {
            callbacks.onPlayerLeave(payload.old.id)
          }
        } catch (_error) {
          callbacks.onError?.(
            new GameServiceError('Failed to process player update')
          )
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(roomChannel)
    supabase.removeChannel(playerChannel)
  }
}

/**
 * 接続状態を監視し、自動再接続を行う
 */
export function subscribeToConnectionState(
  onStateChange: (state: 'CONNECTING' | 'OPEN' | 'CLOSED') => void
) {
  // Simplified connection state monitoring
  const channel = supabase.channel('connection_monitor').subscribe((status) => {
    switch (status) {
      case 'SUBSCRIBED':
        onStateChange('OPEN')
        break
      case 'CLOSED':
      case 'CHANNEL_ERROR':
      case 'TIMED_OUT':
        onStateChange('CLOSED')
        break
      default:
        onStateChange('CONNECTING')
    }
  })

  return () => {
    supabase.removeChannel(channel)
  }
}
