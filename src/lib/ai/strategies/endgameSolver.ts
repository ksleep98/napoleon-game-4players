/**
 * Endgame perfect play solver
 * 終盤（残り2-3トリック）での完全解探索
 * ミニマックスアルゴリズムで最適手を決定
 */

import type { Card, GameState, Player, Trick } from '@/types/game'
import { getCardStrengthSafe, isFaceCard } from './helpers'
import type { CardCountingInfo } from './types'

/**
 * エンドゲーム探索の結果
 */
interface EndgameResult {
  bestCard: Card
  expectedValue: number // 期待される絵札獲得数
  confidence: number // 0-1, 探索の信頼度
  depth: number // 探索した深さ
}

/**
 * ゲーム状態のシミュレーション結果
 */
interface SimulatedState {
  currentTrick: Trick
  remainingCards: Map<string, Card[]> // playerId -> cards
  completedTricks: Trick[]
  napoleonFaceCards: number
  allianceFaceCards: number
}

/**
 * エンドゲームソルバーのメイン関数
 * 残り2-3トリックで最適な手を完全探索
 */
export function solveEndgame(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  cardCounting: CardCountingInfo,
  maxDepth: number = 3
): EndgameResult | null {
  // 残りトリック数を計算
  const totalTricks = 12
  const completedTricks = gameState.tricks.length
  const remainingTricks = totalTricks - completedTricks

  // 残りトリックが多すぎる場合は探索しない
  if (remainingTricks > maxDepth) {
    return null
  }

  // 残りトリックが0の場合は探索不要
  if (remainingTricks <= 0) {
    return null
  }

  // プレイ可能カードがない場合
  if (playableCards.length === 0) {
    return null
  }

  // プレイ可能カードが1枚の場合は探索不要
  if (playableCards.length === 1) {
    return {
      bestCard: playableCards[0],
      expectedValue: 0,
      confidence: 1.0,
      depth: 0,
    }
  }

  // 初期状態を構築
  const initialState = buildInitialState(gameState, cardCounting)

  // 各プレイ可能カードを評価
  let bestCard = playableCards[0]
  let bestValue = Number.NEGATIVE_INFINITY
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant

  for (const card of playableCards) {
    // このカードをプレイした場合のミニマックス値を計算
    const value = minimax(
      card,
      initialState,
      gameState,
      player,
      remainingTricks,
      true, // 自分のターン
      Number.NEGATIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      isNapoleonTeam
    )

    if (value > bestValue) {
      bestValue = value
      bestCard = card
    }
  }

  return {
    bestCard,
    expectedValue: bestValue,
    confidence: 0.9, // 完全探索なので高い信頼度
    depth: remainingTricks,
  }
}

/**
 * ミニマックスアルゴリズム with アルファベータ剪定
 */
function minimax(
  card: Card,
  state: SimulatedState,
  gameState: GameState,
  currentPlayer: Player,
  depth: number,
  isMaximizingPlayer: boolean,
  alpha: number,
  beta: number,
  isNapoleonTeam: boolean
): number {
  // 終端状態: ゲーム終了
  if (depth === 0 || isTerminalState(state)) {
    return evaluateEndgameState(state, isNapoleonTeam, gameState)
  }

  // カードをプレイしてシミュレート
  const newState = simulateCardPlay(card, state, gameState, currentPlayer)

  // 現在のトリックが完了した場合
  if (isTrickComplete(newState.currentTrick)) {
    // トリックの勝者を決定
    const winner = determineTrickWinner(newState.currentTrick, gameState)
    const faceCardsInTrick = countFaceCardsInTrick(newState.currentTrick)

    // 勝者に絵札を加算
    const napoleon = gameState.players.find((p) => p.isNapoleon)
    const adjutant = gameState.players.find((p) => p.isAdjutant)

    if (winner === napoleon?.id || (adjutant && winner === adjutant.id)) {
      newState.napoleonFaceCards += faceCardsInTrick
    } else {
      newState.allianceFaceCards += faceCardsInTrick
    }

    // 新しいトリックを開始
    newState.completedTricks.push(newState.currentTrick)
    newState.currentTrick = {
      id: `trick-${newState.completedTricks.length}`,
      leadingSuit: undefined,
      cards: [],
      winnerPlayerId: undefined,
      completed: false,
    }
  }

  // 次のプレイヤーの手札を取得
  const nextPlayer = getNextPlayer(gameState, currentPlayer)
  const nextPlayerCards = newState.remainingCards.get(nextPlayer.id) || []

  if (nextPlayerCards.length === 0) {
    // 次のプレイヤーの手札がない場合、終端状態として評価
    return evaluateEndgameState(newState, isNapoleonTeam, gameState)
  }

  // プレイ可能カードを取得
  const playableCards = getPlayableCards(
    nextPlayerCards,
    newState.currentTrick,
    gameState
  )

  if (playableCards.length === 0) {
    // プレイ可能カードがない場合、終端状態として評価
    return evaluateEndgameState(newState, isNapoleonTeam, gameState)
  }

  // 再帰的にミニマックス
  if (isMaximizingPlayer) {
    let maxEval = Number.NEGATIVE_INFINITY
    for (const nextCard of playableCards) {
      const evaluation = minimax(
        nextCard,
        newState,
        gameState,
        nextPlayer,
        depth - 1,
        false,
        alpha,
        beta,
        isNapoleonTeam
      )
      maxEval = Math.max(maxEval, evaluation)
      alpha = Math.max(alpha, evaluation)
      if (beta <= alpha) {
        break // アルファベータ剪定
      }
    }
    return maxEval
  } else {
    let minEval = Number.POSITIVE_INFINITY
    for (const nextCard of playableCards) {
      const evaluation = minimax(
        nextCard,
        newState,
        gameState,
        nextPlayer,
        depth - 1,
        true,
        alpha,
        beta,
        isNapoleonTeam
      )
      minEval = Math.min(minEval, evaluation)
      beta = Math.min(beta, evaluation)
      if (beta <= alpha) {
        break // アルファベータ剪定
      }
    }
    return minEval
  }
}

/**
 * 初期状態を構築
 */
function buildInitialState(
  gameState: GameState,
  _cardCounting: CardCountingInfo
): SimulatedState {
  // 各プレイヤーの残りカードを推定
  const remainingCards = new Map<string, Card[]>()

  for (const player of gameState.players) {
    // 簡易実装: プレイヤーの実際の手札を使用
    // より高度な実装では、カードカウンティングから推定
    remainingCards.set(player.id, [...player.hand])
  }

  // 既に獲得した絵札をカウント
  let napoleonFaceCards = 0
  let allianceFaceCards = 0

  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)

  for (const trick of gameState.tricks) {
    if (!trick.winnerPlayerId) continue

    const faceCardsInTrick = trick.cards.filter((tc) =>
      isFaceCard(tc.card)
    ).length

    if (
      trick.winnerPlayerId === napoleon?.id ||
      (adjutant && trick.winnerPlayerId === adjutant.id)
    ) {
      napoleonFaceCards += faceCardsInTrick
    } else {
      allianceFaceCards += faceCardsInTrick
    }
  }

  return {
    currentTrick: { ...gameState.currentTrick },
    remainingCards,
    completedTricks: [...gameState.tricks],
    napoleonFaceCards,
    allianceFaceCards,
  }
}

/**
 * カードプレイをシミュレート
 */
function simulateCardPlay(
  card: Card,
  state: SimulatedState,
  _gameState: GameState,
  player: Player
): SimulatedState {
  // 新しい状態を作成（ディープコピー）
  const newState: SimulatedState = {
    currentTrick: {
      ...state.currentTrick,
      cards: [...state.currentTrick.cards],
    },
    remainingCards: new Map(
      Array.from(state.remainingCards).map(([id, cards]) => [id, [...cards]])
    ),
    completedTricks: [...state.completedTricks],
    napoleonFaceCards: state.napoleonFaceCards,
    allianceFaceCards: state.allianceFaceCards,
  }

  // カードをトリックに追加
  newState.currentTrick.cards.push({
    playerId: player.id,
    card,
    order: newState.currentTrick.cards.length,
    revealsAdjutant: false,
  })

  // リードスートを設定
  if (
    !newState.currentTrick.leadingSuit &&
    newState.currentTrick.cards.length === 1
  ) {
    newState.currentTrick.leadingSuit = card.suit
  }

  // プレイヤーの手札からカードを削除
  const playerCards = newState.remainingCards.get(player.id) || []
  const cardIndex = playerCards.findIndex((c) => c.id === card.id)
  if (cardIndex !== -1) {
    playerCards.splice(cardIndex, 1)
  }

  return newState
}

/**
 * 終盤状態を評価
 * ナポレオンチーム視点での評価値を返す
 */
function evaluateEndgameState(
  state: SimulatedState,
  isNapoleonTeam: boolean,
  gameState: GameState
): number {
  const targetFaceCards = gameState.napoleonDeclaration?.targetTricks || 8

  // ナポレオンチームの絵札 - 目標との差
  const napoleonDiff = state.napoleonFaceCards - targetFaceCards

  // ナポレオンチーム視点の評価
  let evaluation = napoleonDiff * 100

  // 勝敗が決まっている場合、大きなボーナス/ペナルティ
  if (state.napoleonFaceCards >= targetFaceCards) {
    evaluation += 1000 // ナポレオン勝利
  } else if (state.allianceFaceCards > 13 - targetFaceCards) {
    evaluation -= 1000 // 連合軍勝利
  }

  // 連合軍視点の場合、符号を反転
  return isNapoleonTeam ? evaluation : -evaluation
}

/**
 * トリックが完了したか判定
 */
function isTrickComplete(trick: Trick): boolean {
  return trick.cards.length === 4
}

/**
 * 終端状態か判定
 */
function isTerminalState(state: SimulatedState): boolean {
  // 全プレイヤーの手札が空の場合
  for (const cards of state.remainingCards.values()) {
    if (cards.length > 0) {
      return false
    }
  }
  return true
}

/**
 * トリックの勝者を決定
 */
function determineTrickWinner(trick: Trick, gameState: GameState): string {
  if (trick.cards.length === 0) return ''

  let bestCard = trick.cards[0]
  let bestStrength = getCardStrengthSafe(bestCard.card, gameState)

  for (const trickCard of trick.cards) {
    const strength = getCardStrengthSafe(trickCard.card, gameState)
    if (strength > bestStrength) {
      bestCard = trickCard
      bestStrength = strength
    }
  }

  return bestCard.playerId
}

/**
 * トリック内の絵札数をカウント
 */
function countFaceCardsInTrick(trick: Trick): number {
  return trick.cards.filter((tc) => isFaceCard(tc.card)).length
}

/**
 * 次のプレイヤーを取得
 */
function getNextPlayer(gameState: GameState, currentPlayer: Player): Player {
  const currentIndex = gameState.players.findIndex(
    (p) => p.id === currentPlayer.id
  )
  const nextIndex = (currentIndex + 1) % gameState.players.length
  return gameState.players[nextIndex]
}

/**
 * プレイ可能カードを取得
 */
function getPlayableCards(
  hand: Card[],
  currentTrick: Trick,
  _gameState: GameState
): Card[] {
  // トリックが空の場合、全カードプレイ可能
  if (currentTrick.cards.length === 0) {
    return [...hand]
  }

  const leadingSuit = currentTrick.leadingSuit
  if (!leadingSuit) {
    return [...hand]
  }

  // リードスートのカードがあるか確認
  const suitCards = hand.filter((card) => card.suit === leadingSuit)

  // リードスートがある場合、そのスートのみプレイ可能
  if (suitCards.length > 0) {
    return suitCards
  }

  // リードスートがない場合、全カードプレイ可能
  return [...hand]
}

/**
 * エンドゲームソルバーを使用すべきか判断
 */
export function shouldUseEndgameSolver(
  gameState: GameState,
  maxDepth: number = 3
): boolean {
  const totalTricks = 12
  const completedTricks = gameState.tricks.length
  const remainingTricks = totalTricks - completedTricks

  // 残りトリックが閾値以下の場合のみ使用
  return remainingTricks > 0 && remainingTricks <= maxDepth
}
