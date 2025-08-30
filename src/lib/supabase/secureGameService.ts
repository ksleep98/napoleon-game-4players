import {
  createGameRoomAction,
  createPlayerAction,
  getGameRoomsAction,
  invalidateSessionAction,
  joinGameRoomAction,
  loadGameStateAction,
  refreshSessionAction,
  saveGameResultAction,
  saveGameStateAction,
  setPlayerOfflineAction,
  setPlayerOnlineAction,
  validateSessionAction,
} from '@/app/actions/gameActions'
import type { GameResult, GameRoom, GameState, Player } from '@/types/game'
import { getPlayerSession, supabase } from './client'

// セキュアなゲームサービス関数（サーバーアクション使用）
function getPlayerId(gameState?: GameState): string {
  const playerId = getPlayerSession()
  if (!playerId) {
    // ゲーム状態が提供されている場合は最初のプレイヤーIDを使用
    if (gameState && gameState.players.length > 0) {
      const fallbackPlayerId = gameState.players[0].id
      console.warn(
        `Player session not found, using fallback: ${fallbackPlayerId}`
      )
      return fallbackPlayerId
    }
    throw new Error('Player session not found. Please refresh the page.')
  }
  return playerId
}

/**
 * セキュアなゲーム状態保存
 */
export async function secureGameStateSave(gameState: GameState): Promise<void> {
  const playerId = getPlayerId(gameState)

  // プレイヤーセッションを現在のゲーム状態の実際のプレイヤーIDに更新
  if (gameState.players.length > 0) {
    const actualPlayerId = gameState.players[0].id
    if (playerId !== actualPlayerId) {
      console.log(
        `Updating player session from ${playerId} to ${actualPlayerId}`
      )
      try {
        const { setPlayerSession } = await import('./client')
        await setPlayerSession(actualPlayerId)
      } catch (sessionError) {
        console.warn('Failed to update player session:', sessionError)
      }
    }
    // 実際のプレイヤーIDを使用してサーバーアクションを呼び出し
    const result = await saveGameStateAction(gameState, actualPlayerId)

    if (!result.success) {
      throw new Error(result.error || 'Failed to save game state')
    }
  } else {
    // フォールバック: プレイヤーがいない場合はセッションのIDを使用
    const result = await saveGameStateAction(gameState, playerId)

    if (!result.success) {
      throw new Error(result.error || 'Failed to save game state')
    }
  }
}

/**
 * セキュアなゲーム状態読み込み
 */
export async function secureGameStateLoad(
  gameId: string
): Promise<GameState | null> {
  const playerId = getPlayerId()
  const result = await loadGameStateAction(gameId, playerId)

  if (!result.success) {
    if (result.error === 'Game not found') {
      return null
    }
    throw new Error(result.error || 'Failed to load game state')
  }

  return result.gameState || null
}

/**
 * セキュアなゲーム結果保存
 */
export async function secureGameResultSave(result: GameResult): Promise<void> {
  const playerId = getPlayerId()
  const saveResult = await saveGameResultAction(result, playerId)

  if (!saveResult.success) {
    throw new Error(saveResult.error || 'Failed to save game result')
  }
}

/**
 * セキュアなプレイヤー作成
 */
export async function securePlayerCreate(
  id: string,
  name: string
): Promise<void> {
  const result = await createPlayerAction(id, name)

  if (!result.success) {
    throw new Error(result.error || 'Failed to create player')
  }
}

/**
 * リアルタイム監視（クライアントサイド）
 * RLSポリシーが適用されるため、プレイヤーセッション設定が必要
 */
export function secureSubscribeToGameState(
  gameId: string,
  onUpdate: (gameState: GameState) => void,
  onError?: (error: Error) => void
) {
  const playerId = getPlayerId()

  const channel = supabase
    .channel(`game_${gameId}`, {
      config: {
        broadcast: { self: false },
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

          // プレイヤーがゲームに参加しているかチェック
          const playerInGame = gameState.players.some((p) => p.id === playerId)
          if (!playerInGame) {
            onError?.(new Error('Player not in game'))
            return
          }

          onUpdate(gameState)
        } catch (_error) {
          onError?.(new Error('Failed to parse game state update'))
        }
      }
    )
    .subscribe((status) => {
      if (
        status === 'CLOSED' ||
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT'
      ) {
        onError?.(new Error('Failed to subscribe to game updates'))
      }
    })

  return () => {
    supabase.removeChannel(channel)
  }
}

// 既存のAPIとの互換性を保つためのラッパー関数
export async function saveGameState(gameState: GameState): Promise<void> {
  return secureGameStateSave(gameState)
}

export async function loadGameState(gameId: string): Promise<GameState | null> {
  return secureGameStateLoad(gameId)
}

export async function saveGameResult(result: GameResult): Promise<void> {
  return secureGameResultSave(result)
}

/**
 * セキュアなセッション検証
 */
export async function secureSessionValidate(
  playerId: string
): Promise<boolean> {
  const result = await validateSessionAction(playerId)

  if (!result.success) {
    throw new Error(result.error || 'Failed to validate session')
  }

  return result.valid || false
}

/**
 * セキュアなセッション無効化
 */
export async function secureSessionInvalidate(playerId: string): Promise<void> {
  const result = await invalidateSessionAction(playerId)

  if (!result.success) {
    throw new Error(result.error || 'Failed to invalidate session')
  }
}

/**
 * セキュアなセッション更新
 */
export async function secureSessionRefresh(playerId: string): Promise<void> {
  const result = await refreshSessionAction(playerId)

  if (!result.success) {
    throw new Error(result.error || 'Failed to refresh session')
  }
}

// 既存のAPIとの互換性を保つためのラッパー関数
export async function validateSession(playerId: string): Promise<boolean> {
  return secureSessionValidate(playerId)
}

export async function invalidateSession(playerId: string): Promise<void> {
  return secureSessionInvalidate(playerId)
}

export async function refreshSession(playerId: string): Promise<void> {
  return secureSessionRefresh(playerId)
}

export async function createPlayer(id: string, name: string): Promise<void> {
  return securePlayerCreate(id, name)
}

/**
 * セキュアなゲームルーム作成
 */
export async function secureGameRoomCreate(
  room: Omit<GameRoom, 'createdAt'>
): Promise<GameRoom> {
  const playerId = getPlayerId()
  const result = await createGameRoomAction(room, playerId)

  if (!result.success) {
    throw new Error(result.error || 'Failed to create game room')
  }

  if (!result.gameRoom) {
    throw new Error('Game room creation failed')
  }
  return result.gameRoom
}

/**
 * セキュアなゲームルーム一覧取得
 */
export async function secureGameRoomsGet(): Promise<GameRoom[]> {
  const playerId = getPlayerId()
  const result = await getGameRoomsAction(playerId)

  if (!result.success) {
    throw new Error(result.error || 'Failed to get game rooms')
  }

  return result.gameRooms || []
}

/**
 * セキュアなゲームルーム参加
 */
export async function secureGameRoomJoin(
  roomId: string,
  playerId: string
): Promise<void> {
  const result = await joinGameRoomAction(roomId, playerId)

  if (!result.success) {
    throw new Error(result.error || 'Failed to join game room')
  }
}

/**
 * セキュアなプレイヤーオンライン設定
 */
export async function securePlayerSetOnline(playerId: string): Promise<void> {
  const result = await setPlayerOnlineAction(playerId)

  if (!result.success) {
    throw new Error(result.error || 'Failed to set player online')
  }
}

/**
 * セキュアなプレイヤーオフライン設定
 */
export async function securePlayerSetOffline(playerId: string): Promise<void> {
  const result = await setPlayerOfflineAction(playerId)

  if (!result.success) {
    throw new Error(result.error || 'Failed to set player offline')
  }
}

// 既存のAPIとの互換性を保つためのラッパー関数
export async function createGameRoom(
  room: Omit<GameRoom, 'createdAt'>
): Promise<GameRoom> {
  return secureGameRoomCreate(room)
}

export async function getGameRooms(): Promise<GameRoom[]> {
  return secureGameRoomsGet()
}

export async function joinGameRoom(
  roomId: string,
  playerId: string
): Promise<void> {
  return secureGameRoomJoin(roomId, playerId)
}

export async function setPlayerOnline(playerId: string): Promise<void> {
  return securePlayerSetOnline(playerId)
}

export async function setPlayerOffline(playerId: string): Promise<void> {
  return securePlayerSetOffline(playerId)
}

export function subscribeToGameState(
  gameId: string,
  onUpdate: (gameState: GameState) => void,
  onError?: (error: Error) => void
) {
  return secureSubscribeToGameState(gameId, onUpdate, onError)
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
    .channel(`room_${roomId}`)
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
          callbacks.onError?.(new Error('Failed to process room update'))
        }
      }
    )
    .subscribe()

  // プレイヤー変更を監視
  const playerChannel = supabase
    .channel(`room_players_${roomId}`)
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
                position: 0,
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
          callbacks.onError?.(new Error('Failed to process player update'))
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
