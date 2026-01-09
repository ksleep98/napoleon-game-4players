'use server'

import { GAME_PHASES } from '@/lib/constants'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import { initializeAIGame, initializeGame } from '@/lib/gameLogic'
import { checkRateLimit, validateGameId } from '@/lib/supabase/server'
import type { GameState, Player } from '@/types/game'
import { dealCards, generateGameId, generatePlayerId } from '@/utils/cardUtils'
import {
  createPlayerAction,
  saveGameStateAction,
  validateSessionAction,
} from './gameActions'

export interface GameInitActionResult<T = GameState> {
  success: boolean
  data?: T
  error?: string
}

/**
 * セキュアゲーム初期化 Server Action
 * デッキシャッフルとカード配布をサーバーサイドで実行し、改ざんを防止
 *
 * @param playerNames - プレイヤー名の配列（4人）
 * @param hostPlayerId - ホストプレイヤーID
 * @param playerIds - (オプション) 既存のプレイヤーIDの配列（マルチプレイヤールーム用）
 * @param _roomId - (オプション) ルームID（マルチプレイヤールーム用、将来の拡張用）
 */
export async function initializeGameAction(
  playerNames: string[],
  hostPlayerId: string,
  playerIds?: string[],
  _roomId?: string
): Promise<GameInitActionResult<{ gameState: GameState; gameId: string }>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(hostPlayerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 入力検証
    if (!Array.isArray(playerNames) || playerNames.length !== 4) {
      throw new GameActionError(
        'Must have exactly 4 players',
        GAME_ACTION_ERROR_CODES.INVALID_INPUT
      )
    }

    // プレイヤー名の検証
    for (const name of playerNames) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        throw new GameActionError(
          'Invalid player name',
          GAME_ACTION_ERROR_CODES.INVALID_INPUT
        )
      }
      if (name.trim().length > 20) {
        throw new GameActionError(
          'Player name too long',
          GAME_ACTION_ERROR_CODES.INVALID_INPUT
        )
      }
    }

    // プレイヤーIDの検証（提供された場合）
    if (playerIds) {
      if (!Array.isArray(playerIds) || playerIds.length !== 4) {
        throw new GameActionError(
          'Must provide exactly 4 player IDs',
          GAME_ACTION_ERROR_CODES.INVALID_INPUT
        )
      }
      // プレイヤー名とIDの数が一致することを確認
      if (playerIds.length !== playerNames.length) {
        throw new GameActionError(
          'Player IDs and names must match in count',
          GAME_ACTION_ERROR_CODES.INVALID_INPUT
        )
      }
    }

    // レート制限チェック
    if (!checkRateLimit(`init_game_${hostPlayerId}`, 5, 60000)) {
      throw new GameActionError(
        'Rate limit exceeded',
        GAME_ACTION_ERROR_CODES.RATE_LIMIT_EXCEEDED
      )
    }

    // ゲームIDを生成
    const gameId = generateGameId()

    // サーバーサイドでセキュアなデッキ作成（dealCards内でシャッフル済み）

    // プレイヤーオブジェクトを作成
    // playerIdsが提供された場合は既存のIDを使用、そうでない場合は新規生成
    const initialPlayers: Player[] = playerNames.map((name, index) => ({
      id: playerIds ? playerIds[index] : generatePlayerId(),
      name: name.trim(),
      hand: [],
      isNapoleon: false,
      isAdjutant: false,
      position: index + 1,
      isAI: false,
    }))

    // サーバーサイドでセキュアなカード配布
    const dealtCards = dealCards(initialPlayers)

    // ゲーム状態を初期化（サーバーサイドでカード配布済み）
    const gameState = initializeGame(playerNames)
    gameState.id = gameId
    gameState.players = dealtCards.players
    gameState.hiddenCards = dealtCards.hiddenCards

    // プレイヤー情報をデータベースに登録
    // マルチプレイヤールームの場合（playerIdsが提供された場合）、プレイヤーは既に存在
    if (!playerIds) {
      // 新規ゲームの場合のみプレイヤーを作成
      for (const player of gameState.players) {
        const createPlayerResult = await createPlayerAction(
          player.id,
          player.name
        )
        if (!createPlayerResult.success) {
          throw new GameActionError(
            `Failed to create player: ${player.name}`,
            GAME_ACTION_ERROR_CODES.DATABASE_ERROR
          )
        }
      }
    }

    // ゲーム状態をデータベースに保存
    const saveResult = await saveGameStateAction(gameState, hostPlayerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: {
        gameState,
        gameId,
      },
    }
  } catch (error) {
    console.error('initializeGameAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * セキュアAIゲーム初期化 Server Action
 * AIゲームのデッキシャッフルとカード配布をサーバーサイドで実行
 */
export async function initializeAIGameAction(
  humanPlayerName: string,
  humanPlayerId: string
): Promise<GameInitActionResult<{ gameState: GameState; gameId: string }>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(humanPlayerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 入力検証
    if (!humanPlayerName || typeof humanPlayerName !== 'string') {
      throw new GameActionError(
        'Invalid player name',
        GAME_ACTION_ERROR_CODES.INVALID_INPUT
      )
    }

    if (
      humanPlayerName.trim().length === 0 ||
      humanPlayerName.trim().length > 20
    ) {
      throw new GameActionError(
        'Invalid player name length',
        GAME_ACTION_ERROR_CODES.INVALID_INPUT
      )
    }

    // レート制限チェック
    if (!checkRateLimit(`init_ai_game_${humanPlayerId}`, 10, 60000)) {
      throw new GameActionError(
        'Rate limit exceeded',
        GAME_ACTION_ERROR_CODES.RATE_LIMIT_EXCEEDED
      )
    }

    // ゲームIDを生成
    const gameId = generateGameId()

    // サーバーサイドでセキュアなデッキ作成（dealCards内でシャッフル済み）

    // 人間プレイヤー + 3AIのプレイヤーオブジェクトを作成
    const initialPlayers: Player[] = [
      {
        id: humanPlayerId,
        name: humanPlayerName.trim(),
        hand: [],
        isNapoleon: false,
        isAdjutant: false,
        position: 1,
        isAI: false,
      },
      {
        id: generatePlayerId(),
        name: 'AI Player 1',
        hand: [],
        isNapoleon: false,
        isAdjutant: false,
        position: 2,
        isAI: true,
      },
      {
        id: generatePlayerId(),
        name: 'AI Player 2',
        hand: [],
        isNapoleon: false,
        isAdjutant: false,
        position: 3,
        isAI: true,
      },
      {
        id: generatePlayerId(),
        name: 'AI Player 3',
        hand: [],
        isNapoleon: false,
        isAdjutant: false,
        position: 4,
        isAI: true,
      },
    ]

    // 4プレイヤー用カード配布（1人間 + 3AI）
    const dealtCards = dealCards(initialPlayers)

    // AIゲーム状態を初期化（プレイヤーとカードは手動で設定）
    const baseGameState = initializeAIGame(humanPlayerName.trim())
    const gameState: GameState = {
      ...baseGameState,
      id: gameId,
      players: dealtCards.players,
      hiddenCards: dealtCards.hiddenCards,
    }

    console.log(
      'Initialized AI game state with id:',
      gameState.id,
      'humanPlayerId:',
      humanPlayerId
    )
    console.log(
      'Game players:',
      gameState.players.map((p) => ({ id: p.id, name: p.name, isAI: p.isAI }))
    )

    // 人間プレイヤー情報をデータベースに登録
    const createHumanPlayerResult = await createPlayerAction(
      humanPlayerId,
      humanPlayerName.trim()
    )
    if (!createHumanPlayerResult.success) {
      throw new GameActionError(
        'Failed to create human player',
        'DATABASE_ERROR'
      )
    }

    // AIプレイヤー情報をデータベースに登録
    for (let i = 1; i < 4; i++) {
      const aiPlayer = gameState.players[i]
      const createAIPlayerResult = await createPlayerAction(
        aiPlayer.id,
        aiPlayer.name
      )
      if (!createAIPlayerResult.success) {
        throw new GameActionError(
          `Failed to create AI player: ${aiPlayer.name}`,
          GAME_ACTION_ERROR_CODES.DATABASE_ERROR
        )
      }
    }

    // ゲーム状態をデータベースに保存
    console.log(
      'Saving AI game state with gameId:',
      gameId,
      'playerId:',
      humanPlayerId
    )
    const saveResult = await saveGameStateAction(gameState, humanPlayerId)
    if (!saveResult.success) {
      console.error('Failed to save AI game state:', saveResult.error)
      throw new GameActionError(
        `Failed to save AI game state: ${saveResult.error}`,
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }
    console.log('AI game state saved successfully')

    return {
      success: true,
      data: {
        gameState,
        gameId,
      },
    }
  } catch (error) {
    console.error('initializeAIGameAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * セキュアデッキシャッフル Server Action
 * デッキの再シャッフルが必要な場合にサーバーサイドで実行
 */
export async function reshuffleGameDeckAction(
  gameId: string,
  playerId: string,
  reason: string
): Promise<GameInitActionResult<GameState>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 入力検証
    if (!validateGameId(gameId)) {
      throw new GameActionError(
        'Invalid game ID',
        GAME_ACTION_ERROR_CODES.INVALID_GAME_ID
      )
    }

    // 現在のゲーム状態を取得
    const { loadGameStateAction } = await import('./gameActions')
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const gameState = gameResult.gameState

    // リシャッフルが必要な状況かチェック
    if (gameState.phase !== GAME_PHASES.NAPOLEON) {
      throw new GameActionError(
        'Can only reshuffle during napoleon phase',
        GAME_ACTION_ERROR_CODES.INVALID_STATE
      )
    }

    // サーバーサイドでセキュアな再シャッフル（dealCards内でシャッフル済み）
    // 既存のプレイヤー構造を保持してカード再配布
    const playersWithEmptyHands: Player[] = gameState.players.map((p) => ({
      ...p,
      hand: [],
    }))
    const dealtCards = dealCards(playersWithEmptyHands)

    // プレイヤーに新しいカードを配布
    gameState.players = dealtCards.players
    gameState.hiddenCards = dealtCards.hiddenCards

    // リシャッフル履歴を記録
    gameState.reshuffleCount = (gameState.reshuffleCount || 0) + 1
    gameState.lastReshuffleReason = reason

    // 状態をリセット
    gameState.currentPlayerIndex = 0
    gameState.passedPlayers = []

    // ゲーム状態をデータベースに保存
    const saveResult = await saveGameStateAction(gameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save reshuffled game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: gameState,
    }
  } catch (error) {
    console.error('reshuffleGameDeckAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}
