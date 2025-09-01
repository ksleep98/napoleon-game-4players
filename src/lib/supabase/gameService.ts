import { GAME_PHASES, WINNER_TEAMS } from '@/lib/constants'
import type { GameResult, GameRoom, GameState, Player } from '@/types/game'
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

// リトライ機能付きヘルパー
async function _retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error as Error
      if (attempt === maxRetries) break

      // 指数バックオフで待機
      await new Promise((resolve) =>
        setTimeout(resolve, delay * 2 ** (attempt - 1))
      )
    }
  }

  throw new GameServiceError(
    `Operation failed after ${maxRetries} attempts: ${lastError?.message}`,
    'RETRY_EXHAUSTED'
  )
}

/**
 * ゲーム状態をSupabaseに保存
 */
export async function saveGameState(gameState: GameState): Promise<void> {
  const { error } = await supabase.from('games').upsert({
    id: gameState.id,
    state: gameState,
    phase: gameState.phase,
    updated_at: new Date().toISOString(),
    winner_team:
      gameState.phase === GAME_PHASES.FINISHED
        ? gameState.players.find((p) => p.isNapoleon)
          ? WINNER_TEAMS.NAPOLEON
          : WINNER_TEAMS.CITIZEN
        : null,
  })

  if (error) {
    throw new Error(`Failed to save game state: ${error.message}`)
  }
}

/**
 * ゲーム状態をSupabaseから読み込み
 */
export async function loadGameState(gameId: string): Promise<GameState | null> {
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // ゲームが見つからない
    }
    throw new Error(`Failed to load game state: ${error.message}`)
  }

  return data.state as GameState
}

/**
 * ゲーム結果を保存
 */
export async function saveGameResult(result: GameResult): Promise<void> {
  const { error } = await supabase.from('game_results').insert({
    game_id: result.gameId,
    napoleon_won: result.napoleonWon,
    napoleon_player_id: result.napoleonPlayerId,
    adjutant_player_id: result.adjutantPlayerId,
    face_cards_won: result.faceCardsWon,
    scores: result.scores,
  })

  if (error) {
    throw new Error(`Failed to save game result: ${error.message}`)
  }
}

/**
 * ゲームルームを作成
 */
export async function createGameRoom(
  room: Omit<GameRoom, 'createdAt'>
): Promise<GameRoom> {
  const { data, error } = await supabase
    .from('game_rooms')
    .insert({
      id: room.id,
      name: room.name,
      player_count: room.playerCount,
      max_players: room.maxPlayers,
      status: room.status,
      host_player_id: room.hostPlayerId,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create game room: ${error.message}`)
  }

  return {
    id: data.id,
    name: data.name,
    playerCount: data.player_count,
    maxPlayers: data.max_players,
    status: data.status as 'waiting' | 'playing' | 'finished',
    hostPlayerId: data.host_player_id,
    createdAt: new Date(data.created_at),
  }
}

/**
 * ゲームルームの一覧を取得
 */
export async function getGameRooms(): Promise<GameRoom[]> {
  const { data, error } = await supabase
    .from('game_rooms')
    .select('*')
    .eq('status', 'waiting')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to get game rooms: ${error.message}`)
  }

  return data.map((room) => ({
    id: room.id,
    name: room.name,
    playerCount: room.player_count,
    maxPlayers: room.max_players,
    status: room.status as 'waiting' | 'playing' | 'finished',
    hostPlayerId: room.host_player_id,
    createdAt: new Date(room.created_at),
  }))
}

/**
 * ゲームルームに参加
 */
export async function joinGameRoom(
  roomId: string,
  playerId: string
): Promise<void> {
  // プレイヤーをルームに追加
  const { error: playerError } = await supabase
    .from('players')
    .update({ room_id: roomId, connected: true })
    .eq('id', playerId)

  if (playerError) {
    throw new Error(`Failed to join game room: ${playerError.message}`)
  }

  // ルームのプレイヤー数を更新
  const { error: roomError } = await supabase.rpc('increment_player_count', {
    room_id: roomId,
  })

  if (roomError) {
    throw new Error(`Failed to update room player count: ${roomError.message}`)
  }
}

/**
 * プレイヤーを作成
 */
export async function createPlayer(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('players').insert({
    id,
    name,
    connected: true,
  })

  if (error) {
    throw new Error(`Failed to create player: ${error.message}`)
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
        status === 'CLOSED' ||
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT'
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
          callbacks.onError?.(
            new GameServiceError('Failed to process room update')
          )
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

/**
 * プレイヤーをオンライン状態に設定
 */
export async function setPlayerOnline(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ connected: true })
    .eq('id', playerId)

  if (error) {
    throw new GameServiceError(`Failed to set player online: ${error.message}`)
  }
}

/**
 * プレイヤーをオフライン状態に設定
 */
export async function setPlayerOffline(playerId: string): Promise<void> {
  const { error } = await supabase
    .from('players')
    .update({ connected: false })
    .eq('id', playerId)

  if (error) {
    throw new GameServiceError(`Failed to set player offline: ${error.message}`)
  }
}
