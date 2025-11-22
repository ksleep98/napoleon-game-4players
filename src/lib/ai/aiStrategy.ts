/**
 * AI戦略切り替えシステム
 * ヒューリスティック、MCTS、ハイブリッドの選択
 */

import type { Card, GameState, Player } from '@/types/game'
import { getPlayableCards } from './gameSimulator'
import {
  MCTS_PRESETS,
  type MCTSConfig,
  selectCardWithDeterminization,
} from './monteCarloAI'
import { selectBestStrategicCard } from './strategicCardEvaluator'

/**
 * AI戦略タイプ
 */
export type AIStrategyType = 'heuristic' | 'mcts' | 'hybrid'

/**
 * AI難易度レベル
 */
export type AIDifficultyLevel = 'easy' | 'normal' | 'hard'

/**
 * AI戦略設定
 */
export interface AIStrategyConfig {
  strategy: AIStrategyType
  difficulty: AIDifficultyLevel
  mctsConfig?: MCTSConfig
}

/**
 * デフォルト戦略設定
 */
export const DEFAULT_STRATEGY_CONFIGS: Record<
  AIDifficultyLevel,
  AIStrategyConfig
> = {
  easy: {
    strategy: 'heuristic',
    difficulty: 'easy',
  },
  normal: {
    strategy: 'hybrid',
    difficulty: 'normal',
    mctsConfig: MCTS_PRESETS.fast,
  },
  hard: {
    strategy: 'hybrid',
    difficulty: 'hard',
    mctsConfig: MCTS_PRESETS.normal,
  },
}

/**
 * AI戦略でカードを選択
 * @param gameState 現在のゲーム状態
 * @param player プレイヤー
 * @param config AI戦略設定
 * @returns 選択されたカード
 */
export function selectAICard(
  gameState: GameState,
  player: Player,
  config: AIStrategyConfig
): Card | null {
  const playableCards = getPlayableCards(gameState, player.id)

  if (playableCards.length === 0) {
    return null
  }

  if (playableCards.length === 1) {
    return playableCards[0]
  }

  switch (config.strategy) {
    case 'heuristic':
      return selectWithHeuristic(playableCards, gameState, player)

    case 'mcts':
      return selectWithMCTS(playableCards, gameState, player, config)

    case 'hybrid':
      return selectWithHybrid(playableCards, gameState, player, config)

    default:
      console.warn(`Unknown strategy: ${config.strategy}, using heuristic`)
      return selectWithHeuristic(playableCards, gameState, player)
  }
}

/**
 * ヒューリスティック評価でカードを選択
 */
function selectWithHeuristic(
  playableCards: Card[],
  gameState: GameState,
  player: Player
): Card | null {
  console.log('Using heuristic strategy')
  return selectBestStrategicCard(playableCards, gameState, player)
}

/**
 * MCTSでカードを選択
 */
function selectWithMCTS(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  config: AIStrategyConfig
): Card {
  console.log('Using MCTS strategy')

  const mctsConfig = config.mctsConfig || MCTS_PRESETS.normal

  return selectCardWithDeterminization(
    gameState,
    player,
    playableCards,
    mctsConfig
  )
}

/**
 * ハイブリッド戦略でカードを選択
 * ゲーム進行状況に応じてヒューリスティックとMCTSを切り替え
 */
function selectWithHybrid(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  config: AIStrategyConfig
): Card | null {
  const gameProgress = calculateGameProgress(gameState)
  const handSize = player.hand.length

  console.log(
    `Hybrid strategy: progress=${(gameProgress * 100).toFixed(1)}%, handSize=${handSize}`
  )

  // 序盤（0-30%）: ヒューリスティック（高速）
  if (gameProgress < 0.3) {
    console.log('  → Using heuristic (early game)')
    return selectWithHeuristic(playableCards, gameState, player)
  }

  // 中盤（30-70%）: 手札が多い場合はヒューリスティック、少ない場合はMCTS
  if (gameProgress < 0.7) {
    if (handSize > 6) {
      console.log('  → Using heuristic (mid game, large hand)')
      return selectWithHeuristic(playableCards, gameState, player)
    } else {
      console.log('  → Using MCTS (mid game, small hand)')
      return selectWithMCTS(playableCards, gameState, player, config)
    }
  }

  // 終盤（70-100%）: MCTS（高精度）
  console.log('  → Using MCTS (end game)')
  return selectWithMCTS(playableCards, gameState, player, config)
}

/**
 * ゲーム進行度を計算（0.0 - 1.0）
 */
function calculateGameProgress(gameState: GameState): number {
  const totalTricks = 12
  const completedTricks = gameState.tricks.length
  return completedTricks / totalTricks
}

/**
 * 難易度レベルから戦略設定を取得
 */
export function getStrategyConfigByDifficulty(
  difficulty: AIDifficultyLevel
): AIStrategyConfig {
  return DEFAULT_STRATEGY_CONFIGS[difficulty]
}

/**
 * カスタムMCTS設定を作成
 */
export function createCustomMCTSConfig(
  simulationCount: number,
  timeLimit: number,
  determinizationCount: number
): MCTSConfig {
  return {
    simulationCount,
    explorationConstant: Math.sqrt(2),
    timeLimit,
    determinizationCount,
  }
}
