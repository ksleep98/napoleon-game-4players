/**
 * モンテカルロ木探索（MCTS）実装
 * Monte Carlo Tree Search for Napoleon Game AI
 */

import type { Card, GameState, Player } from '@/types/game'
import {
  cloneGameState,
  getGameResult,
  getPlayableCards,
  isGameFinished,
  shuffleArray,
  simulateCardPlay,
} from './gameSimulator'
import { selectBestStrategicCard } from './strategicCardEvaluator'

/**
 * MCTSノード構造
 */
export interface MCTSNode {
  // ゲーム状態
  gameState: GameState
  playedCard: Card | null

  // 統計情報
  visits: number
  wins: number

  // ツリー構造
  parent: MCTSNode | null
  children: MCTSNode[]

  // 未展開アクション
  untriedActions: Card[]
}

/**
 * MCTS設定
 */
export interface MCTSConfig {
  simulationCount: number // シミュレーション回数
  explorationConstant: number // UCB1の探索定数（通常√2）
  timeLimit: number // 制限時間（ミリ秒）
  determinizationCount: number // 決定論化回数（不完全情報対応）
}

/**
 * MCTS設定プリセット
 */
export const MCTS_PRESETS = {
  // 高速（モバイル・開発環境）
  fast: {
    simulationCount: 100,
    explorationConstant: Math.sqrt(2),
    timeLimit: 1000, // 1秒
    determinizationCount: 3,
  },
  // 標準（通常プレイ）
  normal: {
    simulationCount: 500,
    explorationConstant: Math.sqrt(2),
    timeLimit: 2000, // 2秒
    determinizationCount: 5,
  },
  // 高精度（難易度高）
  strong: {
    simulationCount: 2000,
    explorationConstant: Math.sqrt(2),
    timeLimit: 5000, // 5秒
    determinizationCount: 10,
  },
} as const

/**
 * ゲーム結果
 */
interface GameResult {
  winnerId: string
  napoleonWon: boolean
}

// ===========================
// MCTS メインアルゴリズム
// ===========================

/**
 * モンテカルロ木探索でカードを選択
 * @param gameState 現在のゲーム状態
 * @param player プレイヤー
 * @param playableCards プレイ可能なカード
 * @param config MCTS設定
 * @returns 選択されたカード
 */
export function monteCarloTreeSearch(
  gameState: GameState,
  player: Player,
  playableCards: Card[],
  config: MCTSConfig
): Card {
  if (playableCards.length === 0) {
    throw new Error('No playable cards available')
  }
  if (playableCards.length === 1) {
    return playableCards[0]
  }

  // MCTSは現在のプレイヤーに対してのみ実行される
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  if (currentPlayer.id !== player.id) {
    console.warn(
      `MCTS called for non-current player. Expected: ${currentPlayer.id}, Got: ${player.id}`
    )
  }

  // ゲーム状態から現在のプレイヤーのプレイ可能なカードを取得
  // determinizationで手札が変更されている可能性があるため
  const currentPlayableCards = getPlayableCards(gameState)

  const rootNode: MCTSNode = {
    gameState,
    playedCard: null,
    visits: 0,
    wins: 0,
    parent: null,
    children: [],
    untriedActions: [...currentPlayableCards],
  }

  const startTime = Date.now()
  let simulationCount = 0

  // 制限時間またはシミュレーション回数まで実行
  while (
    simulationCount < config.simulationCount &&
    Date.now() - startTime < config.timeLimit
  ) {
    // 1. Selection（選択）
    let node = selectNode(rootNode)

    // 2. Expansion（展開）
    if (node.untriedActions.length > 0 && node.visits > 0) {
      node = expandNode(node, player)
    }

    // 3. Simulation（シミュレーション）
    const result = simulateGame(node.gameState, player)

    // 4. Backpropagation（逆伝播）
    backpropagate(node, result, player)

    simulationCount++
  }

  const elapsedTime = Date.now() - startTime
  console.log(
    `MCTS completed: ${simulationCount} simulations in ${elapsedTime}ms`
  )

  // 最も訪問回数が多い子ノードのアクションを選択
  if (rootNode.children.length === 0) {
    console.warn('No children nodes, falling back to first playable card')
    return playableCards[0]
  }

  const bestChild = rootNode.children.reduce((best, child) =>
    child.visits > best.visits ? child : best
  )

  const selectedCard = bestChild.playedCard
  if (!selectedCard) {
    console.warn('No selected card found, falling back to first playable card')
    return playableCards[0]
  }

  console.log(
    `Selected card: ${selectedCard.suit} ${selectedCard.rank} (visits: ${bestChild.visits}, win rate: ${((bestChild.wins / bestChild.visits) * 100).toFixed(1)}%)`
  )

  return selectedCard
}

// ===========================
// Phase 1: Selection（選択）
// ===========================

/**
 * UCB1アルゴリズムで最適な子ノードを選択
 */
function selectNode(node: MCTSNode): MCTSNode {
  while (node.untriedActions.length === 0 && node.children.length > 0) {
    node = selectBestChild(node, Math.sqrt(2))
  }
  return node
}

/**
 * UCB1で最良の子ノードを選択
 */
function selectBestChild(node: MCTSNode, c: number): MCTSNode {
  return node.children.reduce((best, child) => {
    const ucb1 = calculateUCB1(child, node.visits, c)
    const bestUCB1 = calculateUCB1(best, node.visits, c)
    return ucb1 > bestUCB1 ? child : best
  })
}

/**
 * UCB1値を計算
 * UCB1 = exploitation + exploration
 */
function calculateUCB1(
  node: MCTSNode,
  parentVisits: number,
  c: number
): number {
  if (node.visits === 0) return Number.POSITIVE_INFINITY

  const exploitation = node.wins / node.visits
  const exploration = c * Math.sqrt(Math.log(parentVisits) / node.visits)
  return exploitation + exploration
}

// ===========================
// Phase 2: Expansion（展開）
// ===========================

/**
 * ノードを展開して新しい子ノードを作成
 */
function expandNode(node: MCTSNode, _player: Player): MCTSNode {
  if (node.untriedActions.length === 0) return node

  // 未試行のアクションを1つ選択
  const action = node.untriedActions.pop()
  if (!action) return node

  // 現在のゲーム状態から現在のプレイヤーを取得
  const currentPlayer =
    node.gameState.players[node.gameState.currentPlayerIndex]

  // 新しいゲーム状態をシミュレート
  const newGameState = simulateCardPlay(
    node.gameState,
    currentPlayer.id,
    action
  )

  // 次のプレイヤーのプレイ可能なカードを取得
  const nextPlayableCards = getPlayableCards(newGameState)

  // 子ノードを作成
  const childNode: MCTSNode = {
    gameState: newGameState,
    playedCard: action,
    visits: 0,
    wins: 0,
    parent: node,
    children: [],
    untriedActions: [...nextPlayableCards],
  }

  node.children.push(childNode)
  return childNode
}

// ===========================
// Phase 3: Simulation（シミュレーション）
// ===========================

/**
 * ゲーム終了までシミュレート
 */
function simulateGame(
  gameState: GameState,
  _currentPlayer: Player
): GameResult {
  let state = cloneGameState(gameState)

  // ゲーム終了までプレイアウト
  const maxIterations = 100 // 無限ループ防止
  let iterations = 0

  while (!isGameFinished(state) && iterations < maxIterations) {
    const currentPlayer = state.players[state.currentPlayerIndex]
    const playableCards = getPlayableCards(state, currentPlayer.id)

    if (playableCards.length === 0) {
      console.warn('No playable cards in simulation, breaking')
      break
    }

    // カード選択（ヒューリスティック50% + ランダム50%）
    const selectedCard = selectCardForSimulation(
      playableCards,
      state,
      currentPlayer
    )

    // カードをプレイ
    state = simulateCardPlay(state, currentPlayer.id, selectedCard)

    iterations++
  }

  // ゲーム結果を取得
  const result = getGameResult(state)

  return {
    winnerId: '',
    napoleonWon: result.napoleonWon,
  }
}

// ===========================
// Phase 4: Backpropagation（逆伝播）
// ===========================

/**
 * シミュレーション結果を逆伝播
 */
function backpropagate(
  node: MCTSNode,
  result: GameResult,
  player: Player
): void {
  let currentNode: MCTSNode | null = node

  while (currentNode !== null) {
    currentNode.visits++

    // このプレイヤーが勝利した場合
    if (didPlayerWin(player, result)) {
      currentNode.wins++
    }

    currentNode = currentNode.parent
  }
}

/**
 * プレイヤーが勝利したか判定
 */
function didPlayerWin(player: Player, result: GameResult): boolean {
  // ナポレオンチームの勝利判定
  if (player.isNapoleon || player.isAdjutant) {
    return result.napoleonWon
  }
  // 連合軍の勝利判定
  return !result.napoleonWon
}

// ===========================
// ヒューリスティックと組み合わせたシミュレーション
// ===========================

/**
 * シミュレーション用のカード選択
 * ランダム50% + ヒューリスティック50%のバランス
 */
function selectCardForSimulation(
  cards: Card[],
  state: GameState,
  player: Player
): Card {
  if (cards.length === 0) {
    throw new Error('No cards available for simulation')
  }
  if (cards.length === 1) {
    return cards[0]
  }

  // 50%の確率でヒューリスティック評価を使用
  if (Math.random() < 0.5) {
    const selected = selectBestStrategicCard(cards, state, player)
    return selected || cards[0]
  }

  // 50%の確率でランダム選択
  return cards[Math.floor(Math.random() * cards.length)]
}

// ===========================
// Determinization（不完全情報対応）
// ===========================

/**
 * Determinizationを使ってカードを選択
 * 複数回のMCTS実行して投票で決定
 */
export function selectCardWithDeterminization(
  gameState: GameState,
  player: Player,
  playableCards: Card[],
  config: MCTSConfig
): Card {
  if (playableCards.length === 0) {
    throw new Error('No playable cards available')
  }
  if (playableCards.length === 1) {
    return playableCards[0]
  }

  // MCTSは現在のプレイヤーに対してのみ実行される
  const currentPlayer = gameState.players[gameState.currentPlayerIndex]
  if (currentPlayer.id !== player.id) {
    throw new Error(
      `MCTS can only be used for current player. Expected: ${currentPlayer.id}, Got: ${player.id}`
    )
  }

  const cardVotes = new Map<string, number>()

  // 複数回の手札配置でMCTSを実行
  for (let i = 0; i < config.determinizationCount; i++) {
    // ランダムに他プレイヤーの手札を配置
    const determinizedState = determinizeGameState(gameState, player)

    // MCTSで最適なカードを選択
    const selectedCard = monteCarloTreeSearch(
      determinizedState,
      player,
      playableCards,
      {
        ...config,
        determinizationCount: 1, // 再帰的なDeterminizationを防ぐ
      }
    )

    // 投票
    cardVotes.set(selectedCard.id, (cardVotes.get(selectedCard.id) || 0) + 1)
  }

  // 最も多く選ばれたカードを返す
  let bestCard = playableCards[0]
  let maxVotes = 0

  for (const card of playableCards) {
    const votes = cardVotes.get(card.id) || 0
    if (votes > maxVotes) {
      maxVotes = votes
      bestCard = card
    }
  }

  console.log(
    `Determinization: ${bestCard.suit} ${bestCard.rank} won with ${maxVotes}/${config.determinizationCount} votes`
  )

  return bestCard
}

/**
 * ゲーム状態を決定論化（他プレイヤーの手札をランダム配置）
 */
function determinizeGameState(
  gameState: GameState,
  observingPlayer: Player
): GameState {
  const newState = cloneGameState(gameState)

  // 未知のカードを取得（他プレイヤーの手札）
  const unknownCards = getAllUnknownCards(newState, observingPlayer)

  // シャッフル
  const shuffled = shuffleArray(unknownCards)

  // 他プレイヤーにランダムに配布
  let cardIndex = 0
  for (const player of newState.players) {
    if (player.id === observingPlayer.id) continue

    const handSize = player.hand.length
    player.hand = shuffled.slice(cardIndex, cardIndex + handSize)
    cardIndex += handSize
  }

  return newState
}

/**
 * 未知のカード（他プレイヤーの手札）を取得
 */
function getAllUnknownCards(state: GameState, observingPlayer: Player): Card[] {
  const unknownCards: Card[] = []

  for (const player of state.players) {
    if (player.id === observingPlayer.id) continue
    unknownCards.push(...player.hand)
  }

  return unknownCards
}
