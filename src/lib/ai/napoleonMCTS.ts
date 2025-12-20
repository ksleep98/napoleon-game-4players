/**
 * MCTS風のナポレオン宣言AI
 * シミュレーションベースで最適な宣言を選択
 */

import { GAME_PHASES } from '@/lib/constants'
import { getMinimumDeclaration } from '@/lib/napoleonRules'
import type {
  Card,
  GameState,
  NapoleonDeclaration,
  Player,
  Suit,
} from '@/types/game'
import {
  cloneGameState,
  getGameResult,
  getPlayableCards,
  isGameFinished,
  selectRandomCard,
  shuffleArray,
  simulateCardPlay,
} from './gameSimulator'
import { selectAdjutantCard } from './napoleon'

/**
 * MCTS設定（ナポレオン宣言用）
 */
export interface NapoleonMCTSConfig {
  simulationsPerOption: number // 各宣言オプションごとのシミュレーション回数
  maxOptions: number // 評価する最大オプション数
  timeLimit: number // 制限時間（ミリ秒）
}

/**
 * ナポレオン宣言プリセット
 */
export const NAPOLEON_MCTS_PRESETS = {
  // 高速（開発・モバイル）
  fast: {
    simulationsPerOption: 10,
    maxOptions: 5,
    timeLimit: 2000,
  },
  // 標準
  normal: {
    simulationsPerOption: 20,
    maxOptions: 10,
    timeLimit: 5000,
  },
  // 高精度
  strong: {
    simulationsPerOption: 50,
    maxOptions: 15,
    timeLimit: 5000,
  },
} as const

/**
 * 宣言オプション
 */
interface DeclarationOption {
  targetTricks: number
  suit: Suit
  winRate: number
  simulations: number
}

/**
 * MCTS風のナポレオン宣言選択
 */
export function selectNapoleonDeclarationWithMCTS(
  gameState: GameState,
  player: Player,
  config: NapoleonMCTSConfig = NAPOLEON_MCTS_PRESETS.normal
): { shouldDeclare: boolean; declaration?: NapoleonDeclaration } {
  const startTime = Date.now()

  // 現在の宣言状況を確認
  const { minTricks, availableSuits } = getMinimumDeclaration(
    gameState.napoleonDeclaration
  )

  // 評価する宣言オプションを生成
  const options: DeclarationOption[] = []

  // minTricks から 20 まで、各スートで評価
  for (let tricks = minTricks; tricks <= 20; tricks++) {
    for (const suit of availableSuits) {
      // 時間制限チェック
      if (Date.now() - startTime > config.timeLimit) {
        break
      }

      // 最大オプション数チェック
      if (options.length >= config.maxOptions) {
        break
      }

      // この宣言オプションを評価
      const winRate = evaluateDeclarationOption(
        gameState,
        player,
        tricks,
        suit as Suit,
        config.simulationsPerOption
      )

      options.push({
        targetTricks: tricks,
        suit: suit as Suit,
        winRate,
        simulations: config.simulationsPerOption,
      })
    }

    if (Date.now() - startTime > config.timeLimit) break
  }

  // 最も勝率が高いオプションを選択
  if (options.length === 0) {
    return { shouldDeclare: false }
  }

  const bestOption = options.reduce((best, option) =>
    option.winRate > best.winRate ? option : best
  )

  // 勝率が30%以上なら宣言
  if (bestOption.winRate >= 0.3) {
    // 副官カードを選択
    const adjutantCard = selectAdjutantCard(player.hand, bestOption.suit)

    const declaration: NapoleonDeclaration = {
      playerId: player.id,
      targetTricks: bestOption.targetTricks,
      suit: bestOption.suit,
      adjutantCard: adjutantCard || undefined,
    }

    return {
      shouldDeclare: true,
      declaration,
    }
  }

  return { shouldDeclare: false }
}

/**
 * 宣言オプションの勝率を評価
 */
function evaluateDeclarationOption(
  gameState: GameState,
  player: Player,
  targetTricks: number,
  suit: Suit,
  simulationCount: number
): number {
  let wins = 0

  for (let i = 0; i < simulationCount; i++) {
    // ゲームをシミュレート
    const won = simulateDeclarationGame(gameState, player, targetTricks, suit)
    if (won) wins++
  }

  return wins / simulationCount
}

/**
 * ナポレオン宣言でゲーム全体をシミュレート
 */
function simulateDeclarationGame(
  gameState: GameState,
  napoleonPlayer: Player,
  targetTricks: number,
  trumpSuit: Suit
): boolean {
  // ゲーム状態をクローン
  let state = cloneGameState(gameState)

  // ナポレオン宣言を設定
  const adjutantCard = selectAdjutantCard(napoleonPlayer.hand, trumpSuit)

  state.napoleonDeclaration = {
    playerId: napoleonPlayer.id,
    targetTricks,
    suit: trumpSuit,
    adjutantCard: adjutantCard || undefined,
  }
  state.trumpSuit = trumpSuit

  // ナポレオンと副官を設定
  state.players = state.players.map((p) => ({
    ...p,
    isNapoleon: p.id === napoleonPlayer.id,
    // 副官は後で判明する（副官カードを持っているプレイヤー）
    isAdjutant:
      adjutantCard !== null && p.hand.some((c) => c.id === adjutantCard.id),
  }))

  // 他のプレイヤーの手札と隠しカードをランダム化（Determinization）
  state = determinizeNapoleonGameState(state, napoleonPlayer)

  // ゲームフェーズをPLAYINGに設定（カード交換をスキップ）
  state.phase = GAME_PHASES.PLAYING
  state.currentPlayerIndex = 0

  // ゲーム終了までシミュレート
  const maxIterations = 100
  let iterations = 0

  while (!isGameFinished(state) && iterations < maxIterations) {
    const currentPlayer = state.players[state.currentPlayerIndex]
    const playableCards = getPlayableCards(state, currentPlayer.id)

    if (playableCards.length === 0) {
      break
    }

    // ランダムにカードを選択
    const selectedCard = selectRandomCard(playableCards)

    // カードをプレイ
    state = simulateCardPlay(state, currentPlayer.id, selectedCard)

    iterations++
  }

  // ゲーム結果を取得
  const result = getGameResult(state)

  // ナポレオンが勝ったかどうか
  return result.napoleonWon
}

/**
 * ナポレオン宣言時のゲーム状態を決定論化
 * 他のプレイヤーの手札と隠しカードをランダム化
 */
function determinizeNapoleonGameState(
  gameState: GameState,
  napoleonPlayer: Player
): GameState {
  const newState = cloneGameState(gameState)

  // 未知のカード（他プレイヤーの手札 + 隠しカード）を取得
  const unknownCards: Card[] = []

  // 他プレイヤーの手札
  for (const player of newState.players) {
    if (player.id === napoleonPlayer.id) continue
    unknownCards.push(...player.hand)
  }

  // 隠しカード
  unknownCards.push(...newState.hiddenCards)

  // シャッフル
  const shuffled = shuffleArray(unknownCards)

  // 他プレイヤーに再配布
  let cardIndex = 0
  for (const player of newState.players) {
    if (player.id === napoleonPlayer.id) continue

    const handSize = player.hand.length
    player.hand = shuffled.slice(cardIndex, cardIndex + handSize)
    cardIndex += handSize
  }

  // 隠しカードを設定
  const hiddenCardCount = newState.hiddenCards.length
  newState.hiddenCards = shuffled.slice(cardIndex, cardIndex + hiddenCardCount)

  return newState
}

/**
 * ナポレオン宣言AI戦略（MCTS版）
 */
export function napoleonAIStrategyWithMCTS(
  gameState: GameState,
  playerId: string,
  config: NapoleonMCTSConfig = NAPOLEON_MCTS_PRESETS.normal
): {
  shouldDeclare: boolean
  declaration?: NapoleonDeclaration
  adjutantCard?: Card
} {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    return { shouldDeclare: false }
  }

  const result = selectNapoleonDeclarationWithMCTS(gameState, player, config)

  if (result.shouldDeclare && result.declaration) {
    return {
      shouldDeclare: true,
      declaration: result.declaration,
      adjutantCard: result.declaration.adjutantCard,
    }
  }

  return { shouldDeclare: false }
}
