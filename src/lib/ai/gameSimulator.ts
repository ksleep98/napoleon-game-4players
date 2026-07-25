/**
 * ゲームシミュレーター
 * MCTSのシミュレーションフェーズで使用
 */

import {
  countFaceCards,
  GAME_CONFIG,
  GAME_PHASES,
  NAPOLEON_RULES,
} from '@/lib/constants'
import { determineWinnerWithSpecialRules } from '@/lib/napoleonCardRules'
import { isGameDecided } from '@/lib/scoring'
import { random } from '@/lib/utils/rng'
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

  // 空トリックへの着手か（リードスート確定の判定は push の前に行う）
  const isLeadingCard = newState.currentTrick.cards.length === 0

  // トリックにカードを追加
  const playedCard: PlayedCard = {
    card: cloneCard(card),
    playerId,
    order: newState.currentTrick.cards.length,
  }
  newState.currentTrick.cards.push(playedCard)

  // 最初のカードの場合、リードスートを設定（本番の gameLogic.playCard と同じ記帳）
  // これを怠ると trick.leadingSuit が常に undefined になり、
  // estimatePlayerVoids / signalDecoder / probabilisticDecision など
  // leadingSuit を参照する評価ロジックがシミュレーション中だけ無効化される。
  if (isLeadingCard) {
    newState.currentTrick.leadingSuit = card.suit
    newState.leadingSuit = card.suit
  }

  // トリックが完了したか確認（4人プレイヤー）
  if (newState.currentTrick.cards.length === GAME_CONFIG.PLAYERS_COUNT) {
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

  // 1トリック目かどうか（本番の gameLogic.determineWinner と同じ判定）。
  // ここは tricks.push の前なので length === 0 が「このトリックが1トリック目」を意味する。
  // 1トリック目は切り札判定とセイム2ルールが無効になる。
  const isFirstTrick = state.tricks.length === 0

  // 勝者を決定
  const winner = determineWinnerWithSpecialRules(trick, trumpSuit, isFirstTrick)

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
  if (isGameFinished(state)) {
    state.phase = GAME_PHASES.FINISHED
    determineGameWinner(state)
  }
}

/**
 * トリックスコアを更新（シミュレーション用の簡易版）
 */
function updateTrickScore(_state: GameState, _winnerId: string): void {
  // シミュレーションでは詳細なスコア管理は不要
  // 勝敗判定はgetNapoleonFaceCardsWon()で行う
}

/**
 * ゲームが終了したか判定
 */
export function isGameFinished(state: GameState): boolean {
  // 全トリック完了
  if (state.tricks.length >= GAME_CONFIG.CARDS_PER_PLAYER) return true

  // 全プレイヤーの手札が空
  const allHandsEmpty = state.players.every((p) => p.hand.length === 0)
  if (allHandsEmpty) return true

  // 早期終了条件は本番と同一実装を使う (gameLogic.completeTrick → scoring.isGameDecided)。
  // 旧実装は「1トリックあたり最大絵札5枚」(実際は4人=4枚) という過大評価と、
  // 同一条件の重複判定を持ち、さらにナポレオンが目標を達成済みでも終了しなかった。
  return isGameDecided(state).decided
}

/**
 * ナポレオンチームの獲得絵札数を取得
 */
function getNapoleonFaceCardsWon(state: GameState): number {
  const napoleonPlayer = state.players.find((p) => p.isNapoleon)
  if (!napoleonPlayer) return 0

  const adjutantPlayer = state.players.find((p) => p.isAdjutant)
  const napoleonTeamIds = [napoleonPlayer.id, adjutantPlayer?.id].filter(
    Boolean
  ) as string[]

  // ナポレオンチームが勝ったトリックの絵札をカウント
  const faceCardsWon = state.tricks
    .filter(
      (trick) =>
        trick.winnerPlayerId && napoleonTeamIds.includes(trick.winnerPlayerId)
    )
    .reduce((total, trick) => {
      return total + countFaceCards(trick.cards.map((c) => c.card))
    }, 0)

  return faceCardsWon
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
  const napoleonFaceCardsWon = getNapoleonFaceCardsWon(state)
  // 既定値は本番 (scoring.isGameDecided) と揃える
  const targetFaceCards =
    state.napoleonDeclaration?.targetTricks ?? NAPOLEON_RULES.TARGET_FACE_CARDS
  const napoleonWon = napoleonFaceCardsWon >= targetFaceCards

  return {
    napoleonWon,
    napoleonTricksWon: napoleonFaceCardsWon, // 互換性のため名前はそのまま
    targetTricks: targetFaceCards,
  }
}

/**
 * ランダムなカードを選択
 *
 * 乱数は `@/lib/utils/rng` 経由（シード未設定時は Math.random と同一挙動）。
 */
export function selectRandomCard(cards: Card[]): Card {
  if (cards.length === 0) {
    throw new Error('No cards available')
  }
  return cards[Math.floor(random() * cards.length)]
}

/**
 * 配列をシャッフル（Fisher-Yates）
 *
 * MCTS の determinization もここを通るため、シードを設定すると
 * 探索のランダム性ごと再現できる。
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
