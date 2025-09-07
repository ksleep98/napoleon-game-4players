'use server'

import { revalidatePath } from 'next/cache'
import { GAME_PHASES } from '@/lib/constants'
import { GameActionError } from '@/lib/errors/GameActionError'
import {
  checkRateLimit,
  supabaseAdmin,
  validateGameId,
  validatePlayerId,
} from '@/lib/supabase/server'
import type { GameResult, GameRoom, GameState } from '@/types/game'

/**
 * セキュアなゲーム状態保存アクション
 */
export async function saveGameStateAction(
  gameState: GameState,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 環境変数の確認
    const envServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const _envAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    // Service Role Key の診断
    const { diagnoseServiceRoleKey } = await import('../../lib/supabase/server')
    const diagnosis = diagnoseServiceRoleKey()

    if (!diagnosis.exists) {
      throw new GameActionError(
        'Service Role Key is required for server actions. Please set SUPABASE_SERVICE_ROLE_KEY in your .env.local file.',
        'SERVICE_ROLE_MISSING'
      )
    }

    // 新しいAPI Keys形式の場合、専用クライアントを作成
    let clientForOperation = supabaseAdmin

    if (diagnosis.isNewApiKey) {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        if (!envUrl || !envServiceRoleKey) {
          throw new GameActionError(
            'Missing environment variables for client creation',
            'MISSING_ENV_VARS'
          )
        }

        clientForOperation = createClient(envUrl, envServiceRoleKey, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        })
      } catch (clientError) {
        console.error('Failed to create dedicated client:', clientError)
        clientForOperation = supabaseAdmin
      }
    }

    // 入力検証
    if (!validateGameId(gameState.id)) {
      throw new GameActionError('Invalid game ID', 'INVALID_GAME_ID')
    }

    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`save_game_${playerId}`, 30, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // プレイヤーがゲームに参加しているかチェック
    const playerInGame = gameState.players.some((p) => p.id === playerId)
    if (!playerInGame) {
      throw new GameActionError('Player not in game', 'PLAYER_NOT_IN_GAME')
    }

    // ゲーム状態をSupabaseに保存
    const gameData = {
      id: gameState.id,
      state: gameState,
      phase: gameState.phase,
      updated_at: new Date().toISOString(),
      winner_team:
        gameState.phase === GAME_PHASES.FINISHED
          ? gameState.players.find((p) => p.isNapoleon)
            ? 'napoleon'
            : 'citizen'
          : null,
    }

    // データベース操作
    let saveResult: {
      data: unknown
      error: { message?: string; code?: string; details?: string } | null
    } | null = null

    // 既存のゲームを確認
    console.log('Checking if game exists:', gameData.id)
    const existingGame = await clientForOperation
      .from('games')
      .select('id')
      .eq('id', gameData.id)
      .single()

    console.log(
      'Existing game check result:',
      existingGame.data ? 'exists' : 'not found'
    )

    try {
      if (existingGame.data) {
        // ゲームが存在する場合は UPDATE
        console.log('Updating existing game:', gameData.id)
        saveResult = await clientForOperation
          .from('games')
          .update(gameData)
          .eq('id', gameData.id)
      } else {
        // ゲームが存在しない場合は INSERT
        console.log('Inserting new game:', gameData.id)
        saveResult = await clientForOperation.from('games').insert(gameData)
      }

      console.log(
        'Save operation result:',
        saveResult.error ? 'failed' : 'success'
      )
      if (saveResult.error) {
        console.error('Save operation error:', saveResult.error)
      }

      // 401エラーまたはRLSエラーの場合はREST APIフォールバック
      if (
        saveResult.error &&
        (saveResult.error.message?.includes('401') ||
          saveResult.error.message?.toLowerCase().includes('unauthorized') ||
          saveResult.error.message?.includes('row-level security policy'))
      ) {
        if (!envServiceRoleKey || !envUrl) {
          throw new GameActionError(
            'Missing environment variables for REST API fallback',
            'MISSING_ENV_VARS'
          )
        }

        const restResult = await saveGameStateViaRestAPI(
          gameData,
          envServiceRoleKey,
          envUrl
        )
        saveResult = { data: restResult, error: null }
      }
    } catch (_clientError) {
      // クライアントエラーの場合もREST APIフォールバック
      if (!envServiceRoleKey || !envUrl) {
        throw new GameActionError(
          'Missing environment variables for REST API fallback',
          'MISSING_ENV_VARS'
        )
      }

      const restResult = await saveGameStateViaRestAPI(
        gameData,
        envServiceRoleKey,
        envUrl
      )
      saveResult = { data: restResult, error: null }
    }

    if (saveResult?.error) {
      throw new GameActionError(
        `Database operation failed: ${saveResult.error.message}`,
        'DATABASE_ERROR'
      )
    }

    // データが返されない場合はREST APIで確認
    if (
      !saveResult?.data ||
      (Array.isArray(saveResult.data) && saveResult.data.length === 0)
    ) {
      if (!envServiceRoleKey || !envUrl) {
        throw new GameActionError(
          'Missing environment variables for confirmation REST API',
          'MISSING_ENV_VARS'
        )
      }

      const restResult = await saveGameStateViaRestAPI(
        gameData,
        envServiceRoleKey,
        envUrl
      )
      saveResult = { data: restResult, error: null }
    }

    // キャッシュ無効化
    revalidatePath(`/game/${gameState.id}`)

    return { success: true }
  } catch (error) {
    console.error('Game save error:', error)

    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

// 新API Keys形式用のダイレクトAPI呼び出し（フォールバック）
async function saveGameStateViaRestAPI(
  gameData: {
    id: string
    state: GameState
    phase: string
    updated_at: string
    winner_team: string | null
  },
  serviceRoleKey: string,
  supabaseUrl: string
): Promise<unknown> {
  // New API Keys format requires different authentication
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates',
  }

  if (serviceRoleKey.startsWith('sb_secret_')) {
    // New API Keys format
    headers.apikey = serviceRoleKey
    headers.Authorization = `Bearer ${serviceRoleKey}`
  } else {
    // Legacy JWT format
    headers.apikey = serviceRoleKey
    headers.Authorization = `Bearer ${serviceRoleKey}`
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/games`, {
    method: 'POST',
    headers,
    body: JSON.stringify(gameData),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(
      `REST API failed: ${response.status} ${response.statusText} - ${errorText}`
    )
  }

  // Handle different response types
  const contentType = response.headers.get('content-type')
  let result: unknown

  if (!contentType || contentType.includes('application/json')) {
    const text = await response.text()

    if (text.trim() === '') {
      // 空のレスポンスは成功と見なす
      result = { success: true, message: 'Operation completed successfully' }
    } else {
      try {
        result = JSON.parse(text)
      } catch (_parseError) {
        result = { success: true, data: text }
      }
    }
  } else {
    // 非JSON レスポンス
    const text = await response.text()
    result = { success: true, data: text }
  }

  return result
}

/**
 * セキュアなゲーム状態読み込みアクション
 */
export async function loadGameStateAction(
  gameId: string,
  playerId: string
): Promise<{ success: boolean; gameState?: GameState; error?: string }> {
  try {
    // 入力検証
    if (!validateGameId(gameId)) {
      throw new GameActionError('Invalid game ID', 'INVALID_GAME_ID')
    }

    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`load_game_${playerId}`, 60, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // ゲーム状態をSupabaseから読み込み
    console.log(
      'Loading game state with gameId:',
      gameId,
      'playerId:',
      playerId
    )
    const { data, error } = await supabaseAdmin
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single()

    if (error) {
      console.error('Database error loading game:', error)
      if (error.code === 'PGRST116') {
        console.error('Game not found in database for gameId:', gameId)
        return { success: false, error: 'Game not found' }
      }
      console.error('Database error:', error)
      throw new GameActionError(
        `Failed to load game state: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    const gameState = data.state as GameState

    // プレイヤーがゲームに参加しているかチェック
    const playerInGame = gameState.players.some((p) => p.id === playerId)
    if (!playerInGame) {
      throw new GameActionError('Player not in game', 'PLAYER_NOT_IN_GAME')
    }

    return { success: true, gameState }
  } catch (error) {
    console.error('Game load error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなゲーム結果保存アクション
 */
export async function saveGameResultAction(
  result: GameResult,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 入力検証
    if (!validateGameId(result.gameId)) {
      throw new GameActionError('Invalid game ID', 'INVALID_GAME_ID')
    }

    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`save_result_${playerId}`, 10, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // ゲーム結果をSupabaseに保存
    const { error } = await supabaseAdmin.from('game_results').insert({
      game_id: result.gameId,
      napoleon_won: result.napoleonWon,
      napoleon_player_id: result.napoleonPlayerId,
      adjutant_player_id: result.adjutantPlayerId,
      face_cards_won: result.faceCardsWon,
      scores: result.scores,
    })

    if (error) {
      console.error('Database error:', error)
      throw new GameActionError(
        `Failed to save game result: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Game result save error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなゲームルーム作成アクション
 */
export async function createGameRoomAction(
  room: Omit<GameRoom, 'createdAt'>,
  playerId: string
): Promise<{ success: boolean; gameRoom?: GameRoom; error?: string }> {
  try {
    // 入力検証
    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    if (!room.hostPlayerId || room.hostPlayerId !== playerId) {
      throw new GameActionError(
        'Invalid host player ID',
        'INVALID_HOST_PLAYER_ID'
      )
    }

    // レート制限チェック
    if (!checkRateLimit(`create_room_${playerId}`, 10, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // ゲームルームをSupabaseに作成
    const { data, error } = await supabaseAdmin
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
      console.error('Database error:', error)
      throw new GameActionError(
        `Failed to create game room: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    const gameRoom: GameRoom = {
      id: data.id,
      name: data.name,
      playerCount: data.player_count,
      maxPlayers: data.max_players,
      status: data.status as 'waiting' | 'playing' | 'finished',
      hostPlayerId: data.host_player_id,
      createdAt: new Date(data.created_at),
    }

    // キャッシュ無効化
    revalidatePath('/rooms')

    return { success: true, gameRoom }
  } catch (error) {
    console.error('Game room creation error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなゲームルーム一覧取得アクション
 */
export async function getGameRoomsAction(
  playerId: string
): Promise<{ success: boolean; gameRooms?: GameRoom[]; error?: string }> {
  try {
    // 入力検証
    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`get_rooms_${playerId}`, 60, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // ゲームルーム一覧をSupabaseから取得
    const { data, error } = await supabaseAdmin
      .from('game_rooms')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Database error:', error)
      throw new GameActionError(
        `Failed to get game rooms: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    const gameRooms: GameRoom[] = data.map((room) => ({
      id: room.id,
      name: room.name,
      playerCount: room.player_count,
      maxPlayers: room.max_players,
      status: room.status as 'waiting' | 'playing' | 'finished',
      hostPlayerId: room.host_player_id,
      createdAt: new Date(room.created_at),
    }))

    return { success: true, gameRooms }
  } catch (error) {
    console.error('Game rooms fetch error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなゲームルーム参加アクション
 */
export async function joinGameRoomAction(
  roomId: string,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 入力検証
    if (!validateGameId(roomId)) {
      throw new GameActionError('Invalid room ID', 'INVALID_ROOM_ID')
    }

    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`join_room_${playerId}`, 10, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // トランザクション開始
    const { data: roomData, error: roomError } = await supabaseAdmin
      .from('game_rooms')
      .select('player_count, max_players, status')
      .eq('id', roomId)
      .single()

    if (roomError) {
      throw new GameActionError(
        `Room not found: ${roomError.message}`,
        'ROOM_NOT_FOUND'
      )
    }

    // ルーム満員チェック
    if (roomData.player_count >= roomData.max_players) {
      throw new GameActionError('Room is full', 'ROOM_FULL')
    }

    // ルーム状態チェック
    if (roomData.status !== 'waiting') {
      throw new GameActionError('Room is not accepting players', 'ROOM_CLOSED')
    }

    // プレイヤーをルームに追加
    const { error: playerError } = await supabaseAdmin
      .from('players')
      .update({ room_id: roomId, connected: true })
      .eq('id', playerId)

    if (playerError) {
      throw new GameActionError(
        `Failed to join game room: ${playerError.message}`,
        'DATABASE_ERROR'
      )
    }

    // ルームのプレイヤー数を更新
    const { error: roomUpdateError } = await supabaseAdmin.rpc(
      'increment_player_count',
      {
        room_id: roomId,
      }
    )

    if (roomUpdateError) {
      console.error('Failed to update room player count:', roomUpdateError)
      // プレイヤー追加は成功したのでエラーにしない（整合性は後で修正される）
    }

    // キャッシュ無効化
    revalidatePath('/rooms')
    revalidatePath(`/rooms/${roomId}`)

    return { success: true }
  } catch (error) {
    console.error('Room join error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなプレイヤーオンライン状態設定アクション
 */
export async function setPlayerOnlineAction(
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 入力検証
    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`set_online_${playerId}`, 30, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // プレイヤーをオンライン状態に設定
    const { error } = await supabaseAdmin
      .from('players')
      .update({ connected: true })
      .eq('id', playerId)

    if (error) {
      console.error('Database error:', error)
      throw new GameActionError(
        `Failed to set player online: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Set player online error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなプレイヤーオフライン状態設定アクション
 */
export async function setPlayerOfflineAction(
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 入力検証
    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`set_offline_${playerId}`, 30, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // プレイヤーをオフライン状態に設定
    const { error } = await supabaseAdmin
      .from('players')
      .update({ connected: false })
      .eq('id', playerId)

    if (error) {
      console.error('Database error:', error)
      throw new GameActionError(
        `Failed to set player offline: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Set player offline error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなセッション管理アクション
 */
export async function validateSessionAction(
  playerId: string
): Promise<{ success: boolean; valid?: boolean; error?: string }> {
  try {
    // 入力検証
    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`validate_session_${playerId}`, 30, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // プレイヤーが存在し、アクティブかチェック
    const { data, error } = await supabaseAdmin
      .from('players')
      .select('id, connected, created_at')
      .eq('id', playerId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: true, valid: false }
      }
      throw new GameActionError(
        `Failed to validate session: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    // セッション有効性チェック（24時間以内の作成）
    const createdAt = new Date(data.created_at).getTime()
    const now = Date.now()
    const twentyFourHours = 24 * 60 * 60 * 1000
    const isRecent = now - createdAt < twentyFourHours

    return {
      success: true,
      valid: data.connected && isRecent,
    }
  } catch (error) {
    console.error('Session validation error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなセッション無効化アクション
 */
export async function invalidateSessionAction(
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 入力検証
    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`invalidate_session_${playerId}`, 10, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // プレイヤーを非アクティブに設定
    const { error } = await supabaseAdmin
      .from('players')
      .update({ connected: false })
      .eq('id', playerId)

    if (error) {
      console.error('Database error:', error)
      throw new GameActionError(
        `Failed to invalidate session: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Session invalidation error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなセッション更新アクション
 */
export async function refreshSessionAction(
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 入力検証
    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    // レート制限チェック
    if (!checkRateLimit(`refresh_session_${playerId}`, 60, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // プレイヤーの最終アクティブ時間を更新
    const { error } = await supabaseAdmin
      .from('players')
      .update({
        connected: true,
        created_at: new Date().toISOString(), // セッション時間リセット
      })
      .eq('id', playerId)

    if (error) {
      console.error('Database error:', error)
      throw new GameActionError(
        `Failed to refresh session: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Session refresh error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}

/**
 * セキュアなプレイヤー作成アクション
 */
export async function createPlayerAction(
  id: string,
  name: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 入力検証
    if (!validatePlayerId(id)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID')
    }

    if (
      !name ||
      typeof name !== 'string' ||
      name.trim().length === 0 ||
      name.length > 50
    ) {
      throw new GameActionError('Invalid player name', 'INVALID_PLAYER_NAME')
    }

    // レート制限チェック
    if (!checkRateLimit(`create_player_${id}`, 5, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED')
    }

    // プレイヤーをSupabaseに作成
    const { error } = await supabaseAdmin.from('players').insert({
      id,
      name: name.trim(),
      connected: true,
    })

    if (error) {
      console.error('Database error:', error)
      // 重複エラーは通常のケースとして扱う
      if (error.code === '23505') {
        return { success: false, error: 'Player already exists' }
      }
      throw new GameActionError(
        `Failed to create player: ${error.message}`,
        'DATABASE_ERROR'
      )
    }

    return { success: true }
  } catch (error) {
    console.error('Player creation error:', error)
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    }
  }
}
