/**
 * Card Sequencing Strategy for Napoleon Game AI
 * カード使用順序最適化戦略
 *
 * Optimizes the order of card usage across multiple tricks
 * 複数トリックにわたるカード使用順序を最適化
 */

import type { Card, GameState, Player } from '@/types/game'
import type { CardCountingInfo } from '../strategicCardEvaluator'
import { analyzeEndgameState } from './endgame'
import { getCardStrengthSafe, isFaceCard } from './helpers'

/**
 * カード使用順序戦略の結果
 * Card sequence strategy result
 */
export interface SequenceStrategy {
  recommendedSequence: Card[] // 推奨カード使用順序
  criticalTricks: number[] // 絶対に勝つべきトリック番号
  sacrificeTricks: number[] // 捨ててもいいトリック番号
  optimalTiming: Map<string, number> // cardId -> 最適使用トリック番号
  conservationPriority: number // 温存優先度 (0-1)
  aggressiveness: number // 攻撃性 (0-1)
  reasoning: string
  confidence: number // 0-1
}

/**
 * トリック重要度評価
 * Trick importance evaluation
 */
export interface TrickImportance {
  trickNumber: number
  importance: 'critical' | 'important' | 'normal' | 'sacrifice'
  expectedFaceCards: number // このトリックで期待される絵札数
  shouldWin: boolean
  reasoning: string
}

/**
 * カード使用計画
 * Card usage plan
 */
export interface CardUsagePlan {
  card: Card
  plannedTrick: number // 使用予定トリック番号
  purpose: 'win_critical' | 'probe' | 'conserve' | 'sacrifice' | 'tempo'
  priority: number // 0-100
  alternatives: Card[] // 代替カード候補
}

/**
 * カード使用順序を分析
 * Analyze card sequence strategy
 */
export function analyzeCardSequence(
  hand: Card[],
  gameState: GameState,
  player: Player,
  cardCounting: CardCountingInfo
): SequenceStrategy {
  const remainingTricks = 12 - gameState.tricks.length
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant

  // トリック重要度を評価
  const trickImportances = evaluateTrickImportances(
    gameState,
    player,
    cardCounting,
    remainingTricks
  )

  // 重要トリックと犠牲トリックを識別
  const criticalTricks = trickImportances
    .filter((t) => t.importance === 'critical')
    .map((t) => t.trickNumber)

  const sacrificeTricks = trickImportances
    .filter((t) => t.importance === 'sacrifice')
    .map((t) => t.trickNumber)

  // カード使用計画を立案
  const usagePlans = planCardUsage(
    hand,
    trickImportances,
    gameState,
    player,
    cardCounting
  )

  // 最適タイミングマップを構築
  const optimalTiming = new Map<string, number>()
  for (const plan of usagePlans) {
    optimalTiming.set(plan.card.id, plan.plannedTrick)
  }

  // 推奨順序を決定
  const recommendedSequence = usagePlans
    .sort((a, b) => a.plannedTrick - b.plannedTrick)
    .map((p) => p.card)

  // 温存優先度を計算
  const conservationPriority = calculateConservationPriority(
    gameState,
    player,
    remainingTricks
  )

  // 攻撃性を計算
  const aggressiveness = calculateAggressiveness(
    gameState,
    player,
    trickImportances
  )

  // 信頼度を計算（残りトリックが多いほど不確実）
  const confidence = Math.max(0.3, 1 - remainingTricks / 12)

  const reasoning = generateSequenceReasoning(
    trickImportances,
    usagePlans,
    isNapoleonTeam
  )

  return {
    recommendedSequence,
    criticalTricks,
    sacrificeTricks,
    optimalTiming,
    conservationPriority,
    aggressiveness,
    reasoning,
    confidence,
  }
}

/**
 * トリック重要度を評価
 * Evaluate importance of each remaining trick
 */
function evaluateTrickImportances(
  gameState: GameState,
  player: Player,
  cardCounting: CardCountingInfo,
  remainingTricks: number
): TrickImportance[] {
  const importances: TrickImportance[] = []
  const currentTrickNumber = gameState.tricks.length + 1
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant

  // 現在の絵札状況を取得
  const totalFaceCards = cardCounting.totalRemainingFaceCards
  const avgFaceCardsPerTrick = totalFaceCards / remainingTricks

  // 終盤情報を取得
  const endgameInfo = analyzeEndgameState(gameState, player)

  for (let i = 0; i < remainingTricks; i++) {
    const trickNumber = currentTrickNumber + i
    const tricksLeft = remainingTricks - i

    // 基本重要度を決定
    let importance: TrickImportance['importance'] = 'normal'
    let shouldWin = false
    let reasoning = ''

    // 終盤（残り3トリック以下）は全て重要
    if (tricksLeft <= 3) {
      if (isNapoleonTeam) {
        if (endgameInfo.napoleonNeedsAllRemaining) {
          importance = 'critical'
          shouldWin = true
          reasoning = 'Must win all remaining tricks for Napoleon victory'
        } else {
          importance = 'important'
          shouldWin = true
          reasoning = 'Endgame - secure face cards'
        }
      } else {
        if (endgameInfo.allianceNeedsAllRemaining) {
          importance = 'critical'
          shouldWin = true
          reasoning = 'Must block all remaining tricks for Alliance victory'
        } else {
          importance = 'important'
          shouldWin = false
          reasoning = 'Endgame - strategic blocking'
        }
      }
    }
    // 中盤（残り4-8トリック）
    else if (tricksLeft >= 4 && tricksLeft <= 8) {
      // 絵札が集中していると予想されるトリックは重要
      if (avgFaceCardsPerTrick >= 1.5) {
        importance = 'important'
        shouldWin = isNapoleonTeam
        reasoning = 'Mid-game with high face card concentration'
      } else {
        importance = 'normal'
        shouldWin = false
        reasoning = 'Mid-game - flexible strategy'
      }
    }
    // 序盤（残り9トリック以上）
    else {
      // 序盤の最初の2トリックは情報収集優先
      if (i < 2) {
        importance = 'sacrifice'
        shouldWin = false
        reasoning = 'Early game - probe and gather information'
      } else {
        importance = 'normal'
        shouldWin = false
        reasoning = 'Early game - balanced approach'
      }
    }

    importances.push({
      trickNumber,
      importance,
      expectedFaceCards: avgFaceCardsPerTrick,
      shouldWin,
      reasoning,
    })
  }

  return importances
}

/**
 * カード使用計画を立案
 * Plan card usage across tricks
 */
function planCardUsage(
  hand: Card[],
  trickImportances: TrickImportance[],
  gameState: GameState,
  player: Player,
  _cardCounting: CardCountingInfo
): CardUsagePlan[] {
  const plans: CardUsagePlan[] = []
  const _isNapoleonTeam = player.isNapoleon || player.isAdjutant

  // 手札を強さでソート
  const sortedHand = [...hand].sort(
    (a, b) =>
      getCardStrengthSafe(b, gameState) - getCardStrengthSafe(a, gameState)
  )

  // 絵札と非絵札に分類
  const faceCards = sortedHand.filter(isFaceCard)
  const nonFaceCards = sortedHand.filter((c) => !isFaceCard(c))

  // 重要トリックに絵札を割り当て
  const criticalTricks = trickImportances.filter(
    (t) => t.importance === 'critical'
  )
  const importantTricks = trickImportances.filter(
    (t) => t.importance === 'important'
  )
  const sacrificeTricks = trickImportances.filter(
    (t) => t.importance === 'sacrifice'
  )
  const normalTricks = trickImportances.filter((t) => t.importance === 'normal')

  let faceCardIndex = 0
  let nonFaceCardIndex = 0

  // 1. 重要トリックに強い絵札を割り当て
  for (const trick of criticalTricks) {
    if (faceCardIndex < faceCards.length) {
      const card = faceCards[faceCardIndex++]
      plans.push({
        card,
        plannedTrick: trick.trickNumber,
        purpose: 'win_critical',
        priority: 100,
        alternatives: faceCards.slice(faceCardIndex, faceCardIndex + 2),
      })
    }
  }

  // 2. 重要トリックに残りの絵札を割り当て
  for (const trick of importantTricks) {
    if (faceCardIndex < faceCards.length) {
      const card = faceCards[faceCardIndex++]
      plans.push({
        card,
        plannedTrick: trick.trickNumber,
        purpose: 'win_critical',
        priority: 80,
        alternatives: faceCards.slice(faceCardIndex, faceCardIndex + 2),
      })
    }
  }

  // 3. 犠牲トリックに弱いカードを割り当て
  for (const trick of sacrificeTricks) {
    if (nonFaceCardIndex < nonFaceCards.length) {
      const card = nonFaceCards[nonFaceCards.length - 1 - nonFaceCardIndex++]
      plans.push({
        card,
        plannedTrick: trick.trickNumber,
        purpose: 'sacrifice',
        priority: 10,
        alternatives: [],
      })
    }
  }

  // 4. 通常トリックに残りのカードを割り当て
  for (const trick of normalTricks) {
    // 非絵札を優先的に使う
    if (nonFaceCardIndex < nonFaceCards.length) {
      const card = nonFaceCards[nonFaceCardIndex++]
      plans.push({
        card,
        plannedTrick: trick.trickNumber,
        purpose: 'probe',
        priority: 40,
        alternatives: [],
      })
    } else if (faceCardIndex < faceCards.length) {
      const card = faceCards[faceCardIndex++]
      plans.push({
        card,
        plannedTrick: trick.trickNumber,
        purpose: 'conserve',
        priority: 50,
        alternatives: [],
      })
    }
  }

  // 5. 残ったカードを追加
  while (faceCardIndex < faceCards.length) {
    const card = faceCards[faceCardIndex++]
    const lastNormalTrick =
      normalTricks.length > 0
        ? normalTricks[normalTricks.length - 1]
        : trickImportances[trickImportances.length - 1]
    plans.push({
      card,
      plannedTrick: lastNormalTrick.trickNumber,
      purpose: 'tempo',
      priority: 60,
      alternatives: [],
    })
  }

  while (nonFaceCardIndex < nonFaceCards.length) {
    const card = nonFaceCards[nonFaceCardIndex++]
    const lastNormalTrick =
      normalTricks.length > 0
        ? normalTricks[normalTricks.length - 1]
        : trickImportances[trickImportances.length - 1]
    plans.push({
      card,
      plannedTrick: lastNormalTrick.trickNumber,
      purpose: 'probe',
      priority: 30,
      alternatives: [],
    })
  }

  return plans
}

/**
 * 温存優先度を計算
 * Calculate conservation priority
 */
function calculateConservationPriority(
  _gameState: GameState,
  _player: Player,
  remainingTricks: number
): number {
  // 序盤は温存優先度が高い
  if (remainingTricks >= 9) {
    return 0.8
  }
  // 中盤は中程度
  if (remainingTricks >= 5) {
    return 0.5
  }
  // 終盤は温存よりも勝負
  return 0.2
}

/**
 * 攻撃性を計算
 * Calculate aggressiveness level
 */
function calculateAggressiveness(
  _gameState: GameState,
  _player: Player,
  trickImportances: TrickImportance[]
): number {
  const criticalCount = trickImportances.filter(
    (t) => t.importance === 'critical'
  ).length
  const totalTricks = trickImportances.length

  // 重要トリックが多いほど攻撃的
  const criticalRatio = criticalCount / Math.max(totalTricks, 1)

  return Math.min(1, criticalRatio * 2)
}

/**
 * 順序の理由を生成
 * Generate reasoning for sequence strategy
 */
function generateSequenceReasoning(
  trickImportances: TrickImportance[],
  usagePlans: CardUsagePlan[],
  isNapoleonTeam: boolean
): string {
  const criticalCount = trickImportances.filter(
    (t) => t.importance === 'critical'
  ).length
  const sacrificeCount = trickImportances.filter(
    (t) => t.importance === 'sacrifice'
  ).length

  const faceCardPlans = usagePlans.filter((p) => isFaceCard(p.card))
  const criticalPlans = usagePlans.filter((p) => p.purpose === 'win_critical')

  let reasoning = ''

  if (criticalCount > 0) {
    reasoning += `${criticalCount} critical tricks identified. `
  }

  if (sacrificeCount > 0) {
    reasoning += `${sacrificeCount} sacrifice tricks for probing. `
  }

  if (faceCardPlans.length > 0) {
    reasoning += `${faceCardPlans.length} face cards allocated. `
  }

  if (criticalPlans.length > 0) {
    reasoning += `${criticalPlans.length} cards assigned to critical tricks. `
  }

  if (isNapoleonTeam) {
    reasoning += 'Napoleon team: Prioritize winning valuable tricks.'
  } else {
    reasoning += 'Alliance team: Strategic blocking and distribution.'
  }

  return reasoning
}

/**
 * カード順序戦略に基づくボーナス計算
 * Calculate bonus based on card sequencing strategy
 */
export function calculateSequencingBonus(
  card: Card,
  currentTrickNumber: number,
  sequenceStrategy: SequenceStrategy,
  _gameState: GameState
): number {
  // 最適使用タイミングを取得
  const optimalTrick = sequenceStrategy.optimalTiming.get(card.id)
  if (!optimalTrick) {
    return 0
  }

  // 現在のトリックが最適タイミングかどうか
  const timingDiff = Math.abs(currentTrickNumber - optimalTrick)

  // タイミングがぴったり合っている場合、高ボーナス
  if (timingDiff === 0) {
    // 重要トリックでの使用はさらに高ボーナス
    if (sequenceStrategy.criticalTricks.includes(currentTrickNumber)) {
      return 100 * sequenceStrategy.confidence
    }
    return 50 * sequenceStrategy.confidence
  }

  // タイミングが1-2トリックずれている場合、中程度のボーナス
  if (timingDiff <= 2) {
    return 20 * sequenceStrategy.confidence
  }

  // タイミングが大きくずれている場合、ペナルティ
  if (timingDiff > 4) {
    return -30 * sequenceStrategy.confidence
  }

  return 0
}

/**
 * 順序戦略のサマリーを取得
 * Get summary of sequencing strategy
 */
export function getSequencingSummary(
  sequenceStrategy: SequenceStrategy
): string {
  const {
    criticalTricks,
    sacrificeTricks,
    conservationPriority,
    aggressiveness,
  } = sequenceStrategy

  const parts: string[] = []

  parts.push(`Critical: ${criticalTricks.length} tricks`)
  parts.push(`Sacrifice: ${sacrificeTricks.length} tricks`)
  parts.push(`Conservation: ${(conservationPriority * 100).toFixed(0)}%`)
  parts.push(`Aggression: ${(aggressiveness * 100).toFixed(0)}%`)

  return parts.join(' | ')
}
