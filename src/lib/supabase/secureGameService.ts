import { getSessionAction } from '@/app/actions/cookieSessionActions'
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
import { CONNECTION_STATES } from '@/lib/constants'
import type { GameResult, GameRoom, GameState, Player } from '@/types/game'
import { setPlayerSession, supabase } from './client'

// 🚀 リクエスト重複排除キャッシュ（50-100ms削減）
const pendingLoadRequests = new Map<string, Promise<GameState | null>>()

// キャッシュクリーンアップ（メモリリーク防止）
const CACHE_TTL = 5000 // 5秒
const requestTimestamps = new Map<string, number>()

// セキュアなゲームサービス関数（httpOnlyクッキー使用）
// Phase 4: localStorage依存を完全削除、httpOnlyクッキーのみ使用
async function getPlayerId(gameState?: GameState): Promise<string> {
  // httpOnlyクッキーからプレイヤーIDを取得
  const sessionResult = await getSessionAction()

  if (sessionResult.success && sessionResult.data?.playerId) {
    return sessionResult.data.playerId
  }

  // フォールバック: ゲーム状態から取得を試行
  if (gameState && gameState.players.length > 0) {
    return gameState.players[0].id
  }

  throw new Error(
    'Player session not found. Please use usePlayerSession hook to initialize.'
  )
}

/**
 * セキュアなゲーム状態保存
 */
export async function secureGameStateSave(gameState: GameState): Promise<void> {
  const playerId = await getPlayerId(gameState)

  // プレイヤーセッションを現在のゲーム状態の実際のプレイヤーIDに更新
  let actualPlayerId = playerId
  if (gameState.players.length > 0) {
    actualPlayerId = gameState.players[0].id
    if (playerId !== actualPlayerId) {
      console.log(
        `Updating player session from ${playerId} to ${actualPlayerId}`
      )
      try {
        await setPlayerSession(actualPlayerId)
      } catch (sessionError) {
        console.warn('Failed to update player session:', sessionError)
      }
    }
  }

  // ゲーム状態保存の実行
  try {
    const result = await saveGameStateAction(gameState, actualPlayerId)

    if (!result.success) {
      console.error('Server action failed:', result.error)

      // RLS関連エラーの詳細診断
      if (result.error?.includes('row-level security policy')) {
        console.error('🔒 RLS Policy Violation Detected:')
        console.error('- Game ID:', gameState.id)
        console.error('- Player ID:', actualPlayerId)
        console.error(
          '- Players in game:',
          gameState.players.map((p) => ({ id: p.id, name: p.name }))
        )
        console.error('- Game phase:', gameState.phase)

        // 開発環境での追加デバッグ情報
        if (process.env.NODE_ENV === 'development') {
          console.error('🔍 Debug info:')
          console.error(
            '- Current URL:',
            typeof window !== 'undefined' ? window.location.href : 'N/A'
          )
          console.error('- Timestamp:', new Date().toISOString())
        }
      }

      throw new Error(result.error || 'Failed to save game state')
    }
  } catch (actionError) {
    console.error('Server action threw error:', actionError)
    throw actionError
  }
}

/**
 * セキュアなゲーム状態読み込み（最適化版）
 * 🚀 リクエスト重複排除により、同時実行時に50-100ms削減
 */
export async function secureGameStateLoad(
  gameId: string
): Promise<GameState | null> {
  const playerId = await getPlayerId()
  const cacheKey = `${gameId}_${playerId}`

  // 🚀 進行中のリクエストがあれば再利用
  const existingRequest = pendingLoadRequests.get(cacheKey)
  if (existingRequest) {
    const timestamp = requestTimestamps.get(cacheKey)
    // キャッシュが有効期限内かチェック
    if (timestamp && Date.now() - timestamp < CACHE_TTL) {
      return existingRequest
    }
    // 期限切れキャッシュをクリア
    pendingLoadRequests.delete(cacheKey)
    requestTimestamps.delete(cacheKey)
  }

  // 新しいリクエストを作成してキャッシュ
  const promise = loadGameStateAction(gameId, playerId).then(
    (result) => {
      // 完了後にキャッシュから削除
      pendingLoadRequests.delete(cacheKey)
      requestTimestamps.delete(cacheKey)

      if (!result.success) {
        if (result.error === 'Game not found') {
          return null
        }
        throw new Error(result.error || 'Failed to load game state')
      }

      return result.gameState || null
    },
    (error) => {
      // エラー時もキャッシュから削除
      pendingLoadRequests.delete(cacheKey)
      requestTimestamps.delete(cacheKey)
      throw error
    }
  )

  pendingLoadRequests.set(cacheKey, promise)
  requestTimestamps.set(cacheKey, Date.now())

  return promise
}

/**
 * セキュアなゲーム結果保存
 */
export async function secureGameResultSave(result: GameResult): Promise<void> {
  const playerId = await getPlayerId()
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
 * Phase 4: playerId引数を受け取るように変更（localStorage依存削除）
 */
export function secureSubscribeToGameState(
  gameId: string,
  playerId: string,
  onUpdate: (gameState: GameState) => void,
  onError?: (error: Error) => void
) {
  console.log(
    '📡 Setting up subscription for game:',
    gameId,
    'playerId:',
    playerId
  )

  let currentChannel: ReturnType<typeof supabase.channel> | null = null
  let reconnectAttempts = 0
  const MAX_RECONNECT_ATTEMPTS = 5
  const RECONNECT_DELAY = 2000 // 2秒
  let reconnectTimer: NodeJS.Timeout | null = null
  let isUnsubscribed = false

  const setupSubscription = () => {
    // 既存のチャンネルがあればクリーンアップ
    if (currentChannel) {
      supabase.removeChannel(currentChannel)
      currentChannel = null
    }

    // チャンネルを作成して購読
    currentChannel = supabase
      .channel(`game_${gameId}_${Date.now()}`, {
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
            const playerInGame = gameState.players.some(
              (p) => p.id === playerId
            )
            if (!playerInGame) {
              console.error(
                '❌ Player not in game:',
                playerId,
                'players:',
                gameState.players.map((p) => p.id)
              )
              onError?.(new Error('Player not in game'))
              return
            }

            // 成功したら再接続カウントをリセット
            reconnectAttempts = 0
            onUpdate(gameState)
          } catch (_error) {
            console.error('❌ Failed to parse game state update:', _error)
            onError?.(new Error('Failed to parse game state update'))
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Subscription status:', status)

        if (status === CONNECTION_STATES.SUBSCRIBED) {
          console.log('✅ Successfully subscribed to game updates')
          reconnectAttempts = 0
        } else if (
          status === CONNECTION_STATES.CLOSED ||
          status === CONNECTION_STATES.CHANNEL_ERROR ||
          status === CONNECTION_STATES.TIMED_OUT
        ) {
          console.error('❌ Subscription failed with status:', status)

          // 購読解除されていない場合のみ再接続を試みる
          if (!isUnsubscribed && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++
            const delay = RECONNECT_DELAY * reconnectAttempts // バックオフ戦略
            console.log(
              `🔄 Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms...`
            )

            reconnectTimer = setTimeout(() => {
              if (!isUnsubscribed) {
                setupSubscription()
              }
            }, delay)
          } else if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('❌ Max reconnection attempts reached. Giving up.')
            onError?.(
              new Error(
                'Failed to subscribe to game updates after multiple attempts'
              )
            )
          }
        }
      })
  }

  // 初回接続
  setupSubscription()

  // クリーンアップ関数
  return () => {
    isUnsubscribed = true
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (currentChannel) {
      supabase.removeChannel(currentChannel)
      currentChannel = null
    }
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
  // ルーム作成時はホストプレイヤーIDを使用（まだストレージに保存されていない可能性があるため）
  const playerId = room.hostPlayerId
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
 * Phase 4: localStorage依存削除、playerIdは不要（ルーム一覧は公開情報）
 */
export async function secureGameRoomsGet(): Promise<GameRoom[]> {
  const result = await getGameRoomsAction(undefined)

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
  playerId: string,
  onUpdate: (gameState: GameState) => void,
  onError?: (error: Error) => void
) {
  return secureSubscribeToGameState(gameId, playerId, onUpdate, onError)
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
              gameId: (newData.game_id as string | null) || undefined,
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
