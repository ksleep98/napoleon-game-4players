/**
 * ゲームシミュレーター
 * MCTSのシミュレーションフェーズで使用
 */

import { GAME_PHASES } from '@/lib/constants'
import { determineWinnerWithSpecialRules } from '@/lib/napoleonCardRules'
import type { Card, GameState, PlayedCard, Player, Suit } from '@/types/game'

/**
 * ゲーム状態のディープクローン
 */
export function cloneGameState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState
}

/**
 * プレイヤーのディープクローン
 */
export function clonePlayer(player: Player): Player {
  return JSON.parse(JSON.stringify(player)) as Player
}

/**
 * カードのディープクローン
 */
export function cloneCard(card: Card): Card {
  return JSON.parse(JSON.stringify(card)) as Card
}

/**
 * プレイ可能なカードを取得
 */
export function getPlayableCards(state: GameState, playerId?: string): Card[] {
  const playerIndex = playerId
    ? state.players.findIndex((p) => p.id === playerId)
    : state.currentPlayerIndex

  if (playerIndex === -1) return []

  const player = state.players[playerIndex]
  const currentTrick = state.currentTrick

  // トリックが空の場合（リードプレイヤー）
  if (currentTrick.cards.length === 0) {
    return [...player.hand]
  }

  // フォローの必要があるスートを取得
  const leadingSuit = currentTrick.cards[0].card.suit
  const suitCards = player.hand.filter((card) => card.suit === leadingSuit)

  // 同じスートがあればそれを返す、なければ全てのカードが出せる
  return suitCards.length > 0 ? suitCards : [...player.hand]
}

/**
 * カードプレイをシミュレート
 */
export function simulateCardPlay(
  state: GameState,
  playerId: string,
  card: Card
): GameState {
  const newState = cloneGameState(state)
  const playerIndex = newState.players.findIndex((p) => p.id === playerId)

  if (playerIndex === -1) {
    throw new Error(`Player ${playerId} not found`)
  }

  const player = newState.players[playerIndex]

  // 手札からカードを削除
  const cardIndex = player.hand.findIndex((c) => c.id === card.id)
  if (cardIndex === -1) {
    throw new Error(`Card ${card.id} not in player hand`)
  }
  player.hand.splice(cardIndex, 1)

  // トリックにカードを追加
  const playedCard: PlayedCard = {
    card: cloneCard(card),
    playerId,
    order: newState.currentTrick.cards.length,
  }
  newState.currentTrick.cards.push(playedCard)

  // トリックが完了したか確認（4人プレイヤー）
  if (newState.currentTrick.cards.length === 4) {
    completeTrick(newState)
  } else {
    // 次のプレイヤーへ
    newState.currentPlayerIndex = (playerIndex + 1) % 4
  }

  return newState
}

/**
 * トリックを完了
 */
function completeTrick(state: GameState): void {
  const trick = state.currentTrick
  const trumpSuit = state.trumpSuit as Suit

  // 勝者を決定
  const winner = determineWinnerWithSpecialRules(trick, trumpSuit, false)

  if (!winner) {
    console.error('No winner determined for trick')
    return
  }

  // トリックを記録
  trick.winnerPlayerId = winner.playerId
  trick.completed = true
  state.tricks.push({ ...trick })

  // スコアを更新
  updateTrickScore(state, winner.playerId)

  // 新しいトリックを開始
  state.currentTrick = {
    id: `trick-${state.tricks.length + 1}`,
    cards: [],
    completed: false,
  }

  // 勝者が次のリードプレイヤー
  const winnerIndex = state.players.findIndex((p) => p.id === winner.playerId)
  state.currentPlayerIndex = winnerIndex

  // ゲーム終了チェック
  if (state.tricks.length >= 12 || isGameFinished(state)) {
    state.phase = GAME_PHASES.FINISHED
    determineGameWinner(state)
  }
}

/**
 * トリックスコアを更新（シミュレーション用の簡易版）
 */
function updateTrickScore(_state: GameState, _winnerId: string): void {
  // シミュレーションでは詳細なスコア管理は不要
  // 勝敗判定はgetNapoleonTricksWon()で行う
}

/**
 * ゲームが終了したか判定
 */
export function isGameFinished(state: GameState): boolean {
  // 12トリック完了
  if (state.tricks.length >= 12) return true

  // 全プレイヤーの手札が空
  const allHandsEmpty = state.players.every((p) => p.hand.length === 0)
  if (allHandsEmpty) return true

  // 早期終了条件（ナポレオンまたは連合軍が目標達成不可能）
  const napoleonTricksWon = getNapoleonTricksWon(state)
  const remainingTricks = 12 - state.tricks.length

  // ナポレオンの目標トリック数
  const targetTricks = state.napoleonDeclaration?.targetTricks || 12

  // ナポレオンが目標達成不可能
  if (napoleonTricksWon + remainingTricks < targetTricks) {
    return true
  }

  // 連合軍の勝利確定（ナポレオンが目標未達成確定）
  const allianceTricksWon = state.tricks.length - napoleonTricksWon
  if (allianceTricksWon > 12 - targetTricks) {
    return true
  }

  return false
}

/**
 * ナポレオンチームの獲得トリック数を取得
 */
function getNapoleonTricksWon(state: GameState): number {
  const napoleonPlayer = state.players.find((p) => p.isNapoleon)
  if (!napoleonPlayer) return 0

  const adjutantPlayer = state.players.find((p) => p.isAdjutant)

  let tricksWon = 0
  for (const trick of state.tricks) {
    if (
      trick.winnerPlayerId === napoleonPlayer.id ||
      (adjutantPlayer && trick.winnerPlayerId === adjutantPlayer.id)
    ) {
      tricksWon++
    }
  }

  return tricksWon
}

/**
 * ゲーム終了時の勝者を決定（シミュレーション用の簡易版）
 */
function determineGameWinner(_state: GameState): void {
  // シミュレーションでは勝者情報を直接設定しない
  // getGameResult()で勝敗を取得する
}

/**
 * ゲーム結果を取得
 */
export interface GameResult {
  napoleonWon: boolean
  napoleonTricksWon: number
  targetTricks: number
}

export function getGameResult(state: GameState): GameResult {
  const napoleonTricksWon = getNapoleonTricksWon(state)
  const targetTricks = state.napoleonDeclaration?.targetTricks || 12
  const napoleonWon = napoleonTricksWon >= targetTricks

  return {
    napoleonWon,
    napoleonTricksWon,
    targetTricks,
  }
}

/**
 * ランダムなカードを選択
 */
export function selectRandomCard(cards: Card[]): Card {
  if (cards.length === 0) {
    throw new Error('No cards available')
  }
  return cards[Math.floor(Math.random() * cards.length)]
}

/**
 * 配列をシャッフル（Fisher-Yates）
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
