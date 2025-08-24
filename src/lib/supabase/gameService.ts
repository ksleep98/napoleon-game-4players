import type { GameResult, GameRoom, GameState } from '@/types/game'
import { supabase } from './client'

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
      gameState.phase === 'finished'
        ? gameState.players.find((p) => p.isNapoleon)
          ? 'napoleon'
          : 'citizen'
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
    tricks_won: result.tricksWon,
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
 * ゲーム状態の変更をリアルタイムで監視
 */
export function subscribeToGameState(
  gameId: string,
  onUpdate: (gameState: GameState) => void
) {
  const channel = supabase
    .channel(`game_${gameId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${gameId}`,
      },
      (payload) => {
        onUpdate(payload.new.state as GameState)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}

/**
 * ゲームルームの変更をリアルタイムで監視
 */
export function subscribeToGameRoom(
  roomId: string,
  onUpdate: (room: unknown) => void
) {
  const channel = supabase
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
        onUpdate(payload.new)
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
