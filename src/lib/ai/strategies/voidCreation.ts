/**
 * Void Creation Strategy for Napoleon Game AI
 * 戦略的ボイド作成戦略
 *
 * Plans strategic void creation (running out of a suit) to enable trump intervention
 * ボイド（特定スートの消費）を戦略的に計画し、切り札での介入を可能にする
 */

import type { CardCountingInfo } from '@/lib/ai/strategicCardEvaluator'
import type { Card, GameState, Player, Suit } from '@/types/game'
import { isFaceCard } from './helpers'

/**
 * スート分布情報
 * Suit distribution information
 */
export interface SuitDistribution {
  suit: Suit
  cardsInHand: Card[]
  count: number
  faceCardCount: number
  avgStrength: number
  isVoid: boolean // 既にボイド
  nearVoid: boolean // 1-2枚でボイド可能
}

/**
 * ボイド作成計画
 * Void creation plan
 */
export interface VoidCreationPlan {
  targetSuit: Suit | null // ボイドにするべきスート
  priority: number // 優先度 0-100
  cardsToPlay: Card[] // ボイド作成のために出すべきカード
  estimatedTurnsToVoid: number // ボイド完成までのターン数
  benefits: VoidBenefits
  risks: VoidRisks
  reasoning: string
}

/**
 * ボイドのメリット
 * Benefits of creating void
 */
export interface VoidBenefits {
  enablesTrumpControl: boolean // 切り札コントロール可能
  preventsForcing: boolean // 強制的なカード出しを防ぐ
  improvesFlexibility: boolean // 柔軟性向上
  expectedFaceCardsGained: number // 獲得期待絵札数
}

/**
 * ボイドのリスク
 * Risks of creating void
 */
export interface VoidRisks {
  losesValuableCards: boolean // 価値あるカードを失う
  revealsStrategy: boolean // 戦略を明らかにする
  limitsOptions: boolean // 選択肢を制限
  expectedFaceCardsLost: number // 失う期待絵札数
}

/**
 * ボイド作成戦略の結果
 * Void creation strategy result
 */
export interface VoidCreationStrategy {
  suitDistributions: SuitDistribution[]
  currentVoids: Suit[]
  nearVoids: Suit[] // 1-2枚でボイド可能なスート
  voidCreationPlan: VoidCreationPlan
  hasTrumpCards: boolean
  trumpCount: number
  shouldPursueVoid: boolean
  aggressiveness: number // 0-1, ボイド作成の積極性
  confidence: number // 0-1
}

/**
 * ボイド作成戦略を分析
 * Analyze void creation strategy
 */
export function analyzeVoidCreation(
  hand: Card[],
  gameState: GameState,
  player: Player,
  cardCounting: CardCountingInfo
): VoidCreationStrategy {
  const _isNapoleonTeam = player.isNapoleon || player.isAdjutant
  const trump = gameState.trumpSuit

  // スート分布を分析
  const suitDistributions = analyzeSuitDistributions(hand, gameState)

  // 現在のボイドとニアボイドを識別
  const currentVoids = suitDistributions
    .filter((d) => d.isVoid)
    .map((d) => d.suit)

  const nearVoids = suitDistributions
    .filter((d) => d.nearVoid && !d.isVoid)
    .map((d) => d.suit)

  // 切り札の状況
  const trumpCards = hand.filter((c) => c.suit === trump)
  const hasTrumpCards = trumpCards.length > 0
  const trumpCount = trumpCards.length

  // ボイド作成計画を立案
  const voidCreationPlan = planVoidCreation(
    suitDistributions,
    gameState,
    player,
    cardCounting,
    hasTrumpCards
  )

  // ボイド作成の積極性を計算
  const aggressiveness = calculateVoidAggressiveness(
    gameState,
    player,
    hasTrumpCards,
    currentVoids.length
  )

  // 信頼度を計算
  const remainingTricks = 12 - gameState.tricks.length
  const confidence = Math.max(0.4, 1 - remainingTricks / 12)

  const shouldPursueVoid =
    voidCreationPlan.targetSuit !== null &&
    voidCreationPlan.priority > 30 &&
    hasTrumpCards

  return {
    suitDistributions,
    currentVoids,
    nearVoids,
    voidCreationPlan,
    hasTrumpCards,
    trumpCount,
    shouldPursueVoid,
    aggressiveness,
    confidence,
  }
}

/**
 * スート分布を分析
 * Analyze suit distributions in hand
 */
function analyzeSuitDistributions(
  hand: Card[],
  gameState: GameState
): SuitDistribution[] {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades']
  const trump = gameState.trumpSuit

  return suits.map((suit) => {
    const cardsInHand = hand.filter((c) => c.suit === suit)
    const count = cardsInHand.length
    const faceCardCount = cardsInHand.filter(isFaceCard).length
    const avgStrength =
      count > 0 ? cardsInHand.reduce((sum, c) => sum + c.value, 0) / count : 0

    const isVoid = count === 0
    const nearVoid = count > 0 && count <= 2 && suit !== trump

    return {
      suit,
      cardsInHand,
      count,
      faceCardCount,
      avgStrength,
      isVoid,
      nearVoid,
    }
  })
}

/**
 * ボイド作成計画を立案
 * Plan void creation strategy
 */
function planVoidCreation(
  suitDistributions: SuitDistribution[],
  gameState: GameState,
  player: Player,
  _cardCounting: CardCountingInfo,
  hasTrumpCards: boolean
): VoidCreationPlan {
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant
  const trump = gameState.trumpSuit
  const remainingTricks = 12 - gameState.tricks.length

  // ボイド候補を評価
  const candidates = suitDistributions
    .filter((d) => !d.isVoid && d.suit !== trump && d.count > 0)
    .map((d) => evaluateVoidCandidate(d, gameState, player, hasTrumpCards))
    .sort((a, b) => b.score - a.score)

  if (candidates.length === 0) {
    return {
      targetSuit: null,
      priority: 0,
      cardsToPlay: [],
      estimatedTurnsToVoid: 0,
      benefits: {
        enablesTrumpControl: false,
        preventsForcing: false,
        improvesFlexibility: false,
        expectedFaceCardsGained: 0,
      },
      risks: {
        losesValuableCards: false,
        revealsStrategy: false,
        limitsOptions: false,
        expectedFaceCardsLost: 0,
      },
      reasoning: 'No void creation opportunities available',
    }
  }

  const bestCandidate = candidates[0]
  const distribution = suitDistributions.find(
    (d) => d.suit === bestCandidate.suit
  )

  // Should always exist since bestCandidate came from suitDistributions
  if (!distribution) {
    return {
      targetSuit: null,
      priority: 0,
      cardsToPlay: [],
      estimatedTurnsToVoid: 0,
      benefits: {
        enablesTrumpControl: false,
        preventsForcing: false,
        improvesFlexibility: false,
        expectedFaceCardsGained: 0,
      },
      risks: {
        losesValuableCards: false,
        revealsStrategy: false,
        limitsOptions: false,
        expectedFaceCardsLost: 0,
      },
      reasoning: 'Distribution not found',
    }
  }

  // カードを弱い順にソート
  const cardsToPlay = [...distribution.cardsInHand].sort(
    (a, b) => a.value - b.value
  )

  // メリットとリスクを評価
  const benefits = evaluateVoidBenefits(
    bestCandidate.suit,
    gameState,
    player,
    hasTrumpCards
  )

  const risks = evaluateVoidRisks(distribution, gameState, remainingTricks)

  // 優先度を計算
  let priority = bestCandidate.score

  // 切り札がない場合は優先度を下げる
  if (!hasTrumpCards) {
    priority *= 0.3
  }

  // 序盤は優先度を下げる
  if (remainingTricks > 8) {
    priority *= 0.6
  }

  // リスクが高い場合は優先度を下げる
  if (risks.losesValuableCards) {
    priority *= 0.7
  }

  const reasoning = generateVoidReasoning(
    bestCandidate.suit,
    distribution,
    benefits,
    risks,
    isNapoleonTeam,
    hasTrumpCards
  )

  return {
    targetSuit: bestCandidate.suit,
    priority: Math.min(100, Math.max(0, priority)),
    cardsToPlay,
    estimatedTurnsToVoid: distribution.count,
    benefits,
    risks,
    reasoning,
  }
}

/**
 * ボイド候補を評価
 * Evaluate void candidate
 */
interface VoidCandidateEvaluation {
  suit: Suit
  score: number
}

function evaluateVoidCandidate(
  distribution: SuitDistribution,
  _gameState: GameState,
  player: Player,
  hasTrumpCards: boolean
): VoidCandidateEvaluation {
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant
  let score = 0

  // ニアボイドは高評価
  if (distribution.nearVoid) {
    score += 50
  } else {
    // カード数が少ないほど高評価
    score += (4 - distribution.count) * 10
  }

  // 弱いスートを優先
  if (distribution.avgStrength < 8) {
    score += 20
  }

  // 絵札が少ないスートを優先
  if (distribution.faceCardCount === 0) {
    score += 30
  } else {
    score -= distribution.faceCardCount * 15
  }

  // 切り札がある場合、ボイド作成価値が上がる
  if (hasTrumpCards) {
    score += 25
  }

  // ナポレオンチームはより積極的にボイドを作る
  if (isNapoleonTeam) {
    score *= 1.2
  }

  return {
    suit: distribution.suit,
    score: Math.max(0, score),
  }
}

/**
 * ボイドのメリットを評価
 * Evaluate benefits of void creation
 */
function evaluateVoidBenefits(
  _targetSuit: Suit,
  gameState: GameState,
  player: Player,
  hasTrumpCards: boolean
): VoidBenefits {
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant
  const remainingTricks = 12 - gameState.tricks.length

  const enablesTrumpControl = hasTrumpCards && remainingTricks > 3

  // 強制的なカード出しを防ぐ（選択肢が増える）
  const preventsForcing = true

  // 柔軟性向上
  const improvesFlexibility = remainingTricks > 5

  // 期待絵札数
  let expectedFaceCardsGained = 0
  if (enablesTrumpControl && isNapoleonTeam) {
    // ナポレオンチームがボイドを作ると切り札で絵札を取りやすい
    expectedFaceCardsGained = remainingTricks * 0.3
  } else if (enablesTrumpControl && !isNapoleonTeam) {
    // アライアンスチームがボイドを作ると防御的に使える
    expectedFaceCardsGained = remainingTricks * 0.15
  }

  return {
    enablesTrumpControl,
    preventsForcing,
    improvesFlexibility,
    expectedFaceCardsGained,
  }
}

/**
 * ボイドのリスクを評価
 * Evaluate risks of void creation
 */
function evaluateVoidRisks(
  distribution: SuitDistribution,
  _gameState: GameState,
  remainingTricks: number
): VoidRisks {
  // 価値あるカードを失うリスク
  const losesValuableCards =
    distribution.faceCardCount > 0 || distribution.avgStrength > 10

  // 戦略を明らかにするリスク（序盤ほど高い）
  const revealsStrategy = remainingTricks > 8

  // 選択肢を制限するリスク
  const limitsOptions = distribution.count < 3

  // 失う期待絵札数
  const expectedFaceCardsLost = distribution.faceCardCount * 0.5

  return {
    losesValuableCards,
    revealsStrategy,
    limitsOptions,
    expectedFaceCardsLost,
  }
}

/**
 * ボイド作成の積極性を計算
 * Calculate void creation aggressiveness
 */
function calculateVoidAggressiveness(
  gameState: GameState,
  player: Player,
  hasTrumpCards: boolean,
  currentVoidCount: number
): number {
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant
  const remainingTricks = 12 - gameState.tricks.length

  let aggressiveness = 0.5

  // 切り札がある場合、積極的
  if (hasTrumpCards) {
    aggressiveness += 0.3
  }

  // ナポレオンチームはより積極的
  if (isNapoleonTeam) {
    aggressiveness += 0.2
  }

  // 既にボイドがある場合、やや消極的
  if (currentVoidCount > 0) {
    aggressiveness -= currentVoidCount * 0.1
  }

  // 終盤は積極的
  if (remainingTricks <= 5) {
    aggressiveness += 0.2
  }

  // 序盤は消極的
  if (remainingTricks > 8) {
    aggressiveness -= 0.2
  }

  return Math.min(1, Math.max(0, aggressiveness))
}

/**
 * ボイド作成の理由を生成
 * Generate void creation reasoning
 */
function generateVoidReasoning(
  targetSuit: Suit,
  distribution: SuitDistribution,
  benefits: VoidBenefits,
  _risks: VoidRisks,
  isNapoleonTeam: boolean,
  hasTrumpCards: boolean
): string {
  const parts: string[] = []

  parts.push(`Target: ${targetSuit} void (${distribution.count} cards)`)

  if (distribution.nearVoid) {
    parts.push('Near-void opportunity')
  }

  if (benefits.enablesTrumpControl && hasTrumpCards) {
    parts.push('Enables trump control')
  }

  if (distribution.faceCardCount === 0) {
    parts.push('No face cards to lose')
  } else {
    parts.push(`Risks ${distribution.faceCardCount} face cards`)
  }

  if (isNapoleonTeam) {
    parts.push('Napoleon team: Aggressive void creation')
  } else {
    parts.push('Alliance team: Defensive void planning')
  }

  return parts.join(' | ')
}

/**
 * ボイド作成に基づくボーナス計算
 * Calculate bonus based on void creation strategy
 */
export function calculateVoidCreationBonus(
  card: Card,
  voidStrategy: VoidCreationStrategy,
  _gameState: GameState
): number {
  if (
    !voidStrategy.shouldPursueVoid ||
    !voidStrategy.voidCreationPlan.targetSuit
  ) {
    return 0
  }

  const { targetSuit, priority } = voidStrategy.voidCreationPlan

  // ターゲットスートのカードを出す場合
  if (card.suit === targetSuit) {
    // 弱いカードから出す方が良い（絵札は温存）
    const isFace = isFaceCard(card)
    const baseBonus = priority * voidStrategy.aggressiveness

    if (isFace) {
      // 絵札は出すのに消極的
      return baseBonus * 0.3 * voidStrategy.confidence
    }
    // 非絵札は積極的に出す
    return baseBonus * 1.5 * voidStrategy.confidence
  }

  // ターゲットスート以外のカードを出す場合、ペナルティ
  if (voidStrategy.voidCreationPlan.priority > 70) {
    return -20 * voidStrategy.confidence
  }

  return 0
}

/**
 * ボイド戦略のサマリーを取得
 * Get summary of void creation strategy
 */
export function getVoidCreationSummary(
  voidStrategy: VoidCreationStrategy
): string {
  const { currentVoids, nearVoids, voidCreationPlan, hasTrumpCards } =
    voidStrategy

  const parts: string[] = []

  parts.push(`Voids: ${currentVoids.length}`)
  parts.push(`Near-voids: ${nearVoids.length}`)

  if (voidCreationPlan.targetSuit) {
    parts.push(`Target: ${voidCreationPlan.targetSuit}`)
    parts.push(`Priority: ${voidCreationPlan.priority.toFixed(0)}`)
  } else {
    parts.push('No void plan')
  }

  parts.push(`Trump: ${hasTrumpCards ? 'Yes' : 'No'}`)
  parts.push(`Aggr: ${(voidStrategy.aggressiveness * 100).toFixed(0)}%`)

  return parts.join(' | ')
}
