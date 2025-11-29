'use server'

import { processAIPlayingPhase } from '@/lib/ai/gameTricks'
import { GAME_PHASES } from '@/lib/constants'
import {
  GAME_ACTION_ERROR_CODES,
  GameActionError,
} from '@/lib/errors/GameActionError'
import {
  closeTrickResult,
  declareNapoleon,
  exchangeCards,
  getCurrentPlayer,
  passNapoleonDeclaration,
  playCard,
  redealCards,
  setAdjutant,
} from '@/lib/gameLogic'
import type { Card, GameState, NapoleonDeclaration } from '@/types/game'
import {
  loadGameStateAction,
  saveGameStateAction,
  validateSessionAction,
} from './gameActions'

export interface GameActionResult<T = GameState> {
  success: boolean
  data?: T
  error?: string
}

/**
 * ナポレオン宣言 Server Action
 */
export async function declareNapoleonAction(
  gameId: string,
  playerId: string,
  declaration: NapoleonDeclaration
): Promise<GameActionResult<GameState>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    console.log(
      'Attempting to load game for Napoleon declaration - gameId:',
      gameId,
      'playerId:',
      playerId
    )
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      console.error(
        'Failed to load game state for Napoleon declaration:',
        gameResult.error
      )
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const currentGameState = gameResult.gameState

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ゲームロジック実行（サーバーサイドで検証）
    const updatedGameState = declareNapoleon(currentGameState, declaration)

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: updatedGameState,
    }
  } catch (error) {
    console.error('declareNapoleonAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * ナポレオン宣言パス Server Action
 */
export async function passNapoleonAction(
  gameId: string,
  playerId: string
): Promise<GameActionResult<GameState>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const currentGameState = gameResult.gameState

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ゲームロジック実行
    const updatedGameState = passNapoleonDeclaration(currentGameState, playerId)

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: updatedGameState,
    }
  } catch (error) {
    console.error('passNapoleonAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * 配り直し Server Action
 */
export async function redealCardsAction(
  gameId: string,
  playerId: string
): Promise<GameActionResult<GameState>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const currentGameState = gameResult.gameState

    // 配り直しが必要かチェック
    if (!currentGameState.needsRedeal) {
      throw new GameActionError(
        'Redeal is not needed',
        GAME_ACTION_ERROR_CODES.INVALID_STATE
      )
    }

    // ゲームロジック実行（カードを配り直し）
    const updatedGameState = redealCards(currentGameState)

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    console.log('Cards redealt successfully - all players passed')

    return {
      success: true,
      data: updatedGameState,
    }
  } catch (error) {
    console.error('redealCardsAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * 副官設定 Server Action
 */
export async function setAdjutantAction(
  gameId: string,
  playerId: string,
  adjutantCard: Card
): Promise<GameActionResult<GameState>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const currentGameState = gameResult.gameState

    // プレイヤーの存在確認と権限チェック
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ナポレオンかどうかチェック
    if (currentGameState.napoleonDeclaration?.playerId !== playerId) {
      throw new GameActionError(
        'Only Napoleon can set adjutant',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // ゲームロジック実行
    const updatedGameState = setAdjutant(currentGameState, adjutantCard)

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: updatedGameState,
    }
  } catch (error) {
    console.error('setAdjutantAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * カード交換 Server Action
 */
export async function exchangeCardsAction(
  gameId: string,
  playerId: string,
  cardsToDiscard: Card[]
): Promise<GameActionResult<GameState>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const currentGameState = gameResult.gameState

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ナポレオンかどうかチェック
    if (currentGameState.napoleonDeclaration?.playerId !== playerId) {
      throw new GameActionError(
        'Only Napoleon can exchange cards',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // ゲームロジック実行
    const updatedGameState = exchangeCards(
      currentGameState,
      playerId,
      cardsToDiscard
    )

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: updatedGameState,
    }
  } catch (error) {
    console.error('exchangeCardsAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * カードプレイ Server Action
 */
export async function playCardAction(
  gameId: string,
  playerId: string,
  cardId: string
): Promise<GameActionResult<GameState>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const currentGameState = gameResult.gameState

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // 現在のプレイヤーかどうかチェック
    const currentPlayer = getCurrentPlayer(currentGameState)
    if (!currentPlayer || currentPlayer.id !== playerId) {
      throw new GameActionError(
        'Not your turn',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // ゲームロジック実行
    const updatedGameState = playCard(currentGameState, playerId, cardId)

    // AI処理はクライアントサイドで行うため、ここでは実行しない
    // これによりプレイヤーのモーダルが閉じるまでAIが待機する

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: updatedGameState,
    }
  } catch (error) {
    console.error('playCardAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}

/**
 * トリック結果を閉じる Server Action
 */
export async function closeTrickResultAction(
  gameId: string,
  playerId: string
): Promise<GameActionResult<GameState>> {
  try {
    // セッション検証
    const sessionValid = await validateSessionAction(playerId)
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      )
    }

    // 現在のゲーム状態を取得
    const gameResult = await loadGameStateAction(gameId, playerId)
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    const currentGameState = gameResult.gameState

    // プレイヤーの存在確認
    const player = currentGameState.players.find((p) => p.id === playerId)
    if (!player) {
      throw new GameActionError(
        'Player not found in game',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      )
    }

    // ゲームロジック実行
    let updatedGameState = closeTrickResult(currentGameState)

    // AI処理が必要な場合は実行
    if (updatedGameState.phase === GAME_PHASES.PLAYING) {
      const nextPlayer = getCurrentPlayer(updatedGameState)
      if (nextPlayer?.isAI) {
        // AIの処理を実行（サーバーサイドで）
        updatedGameState = await processAIPlayingPhase(updatedGameState)
      }
    }

    // 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId)
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      )
    }

    return {
      success: true,
      data: updatedGameState,
    }
  } catch (error) {
    console.error('closeTrickResultAction failed:', error)
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    }
  }
}
