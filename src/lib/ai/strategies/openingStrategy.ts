/**
 * Opening Strategy for Napoleon Game AI
 * 序盤戦略最適化
 *
 * Optimizes card play during the opening phase (tricks 1-4)
 * 序盤フェーズ（トリック1-4）のカードプレイを最適化
 */

import type { CardCountingInfo } from '@/lib/ai/strategicCardEvaluator'
import type { Card, GameState, Player } from '@/types/game'
import { isFaceCard } from './helpers'

/**
 * 序盤フェーズの定義
 * Opening phase definition
 */
export const OPENING_PHASE_TRICKS = 4 // トリック1-4を序盤とする

/**
 * 序盤フェーズ情報
 * Opening phase information
 */
export interface OpeningPhaseInfo {
  isOpeningPhase: boolean
  currentTrick: number
  tricksIntoOpening: number // 序盤の何トリック目か (1-4)
  remainingOpeningTricks: number // 序盤の残りトリック数
  phase: 'early_probe' | 'mid_opening' | 'late_opening' | 'post_opening'
}

/**
 * 序盤戦略の結果
 * Opening strategy result
 */
export interface OpeningStrategy {
  phaseInfo: OpeningPhaseInfo
  shouldProbe: boolean // 探りプレイをすべきか
  shouldConserve: boolean // 手札を温存すべきか
  informationGathering: boolean // 情報収集優先か
  riskTolerance: number // リスク許容度 0-1 (低いほど保守的)
  conservationPriority: number // 温存優先度 0-1
  probingPriority: number // 探り優先度 0-1
  recommendedCardTypes: CardType[]
  reasoning: string
  confidence: number // 0-1
}

/**
 * 推奨カードタイプ
 * Recommended card type
 */
export type CardType =
  | 'weak_non_face' // 弱い非絵札
  | 'mid_non_face' // 中程度の非絵札
  | 'weak_face' // 弱い絵札
  | 'strong_face' // 強い絵札
  | 'trump' // 切り札

/**
 * 序盤プレイの推奨
 * Opening play recommendation
 */
export interface OpeningPlayRecommendation {
  card: Card
  cardType: CardType
  suitability: number // 適合度 0-100
  reasoning: string
}

/**
 * 序盤フェーズを分析
 * Analyze opening phase
 */
export function analyzeOpeningPhase(gameState: GameState): OpeningPhaseInfo {
  const currentTrick = gameState.tricks.length + 1
  const isOpeningPhase = currentTrick <= OPENING_PHASE_TRICKS

  let phase: OpeningPhaseInfo['phase']
  let tricksIntoOpening = 0
  let remainingOpeningTricks = 0

  if (currentTrick <= 2) {
    phase = 'early_probe'
    tricksIntoOpening = currentTrick
    remainingOpeningTricks = OPENING_PHASE_TRICKS - currentTrick + 1
  } else if (currentTrick <= 4) {
    phase = 'mid_opening'
    tricksIntoOpening = currentTrick
    remainingOpeningTricks = OPENING_PHASE_TRICKS - currentTrick + 1
  } else if (currentTrick === 5) {
    phase = 'late_opening'
    tricksIntoOpening = 4
    remainingOpeningTricks = 0
  } else {
    phase = 'post_opening'
    tricksIntoOpening = 4
    remainingOpeningTricks = 0
  }

  return {
    isOpeningPhase,
    currentTrick,
    tricksIntoOpening,
    remainingOpeningTricks,
    phase,
  }
}

/**
 * 序盤戦略を分析
 * Analyze opening strategy
 */
export function analyzeOpeningStrategy(
  _hand: Card[],
  gameState: GameState,
  player: Player,
  _cardCounting: CardCountingInfo
): OpeningStrategy {
  const phaseInfo = analyzeOpeningPhase(gameState)
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant

  // 序盤フェーズでない場合、デフォルト戦略を返す
  if (!phaseInfo.isOpeningPhase) {
    return {
      phaseInfo,
      shouldProbe: false,
      shouldConserve: false,
      informationGathering: false,
      riskTolerance: 0.7,
      conservationPriority: 0.3,
      probingPriority: 0.1,
      recommendedCardTypes: ['mid_non_face', 'weak_face'],
      reasoning: 'Post-opening phase - normal strategy',
      confidence: 1.0,
    }
  }

  // フェーズ別の戦略決定
  let shouldProbe = false
  const shouldConserve = true
  let informationGathering = false
  let riskTolerance = 0.5
  let conservationPriority = 0.7
  let probingPriority = 0.5
  let recommendedCardTypes: CardType[] = ['weak_non_face']

  if (phaseInfo.phase === 'early_probe') {
    // トリック1-2: 積極的な情報収集
    shouldProbe = true
    informationGathering = true
    riskTolerance = 0.3 // 低リスク
    conservationPriority = 0.9 // 高温存
    probingPriority = 0.9 // 高探り
    recommendedCardTypes = ['weak_non_face', 'mid_non_face']
  } else if (phaseInfo.phase === 'mid_opening') {
    // トリック3-4: バランス型
    shouldProbe = true
    informationGathering = true
    riskTolerance = 0.5
    conservationPriority = 0.7
    probingPriority = 0.6
    recommendedCardTypes = ['weak_non_face', 'mid_non_face', 'weak_face']
  } else if (phaseInfo.phase === 'late_opening') {
    // トリック5: 序盤終了、通常戦略への移行
    shouldProbe = false
    informationGathering = false
    riskTolerance = 0.6
    conservationPriority = 0.5
    probingPriority = 0.3
    recommendedCardTypes = ['mid_non_face', 'weak_face']
  }

  // チーム別調整
  if (isNapoleonTeam) {
    // ナポレオンチームはやや積極的
    riskTolerance += 0.1
    conservationPriority -= 0.1
    probingPriority -= 0.1
  } else {
    // アライアンスチームはより保守的
    riskTolerance -= 0.1
    conservationPriority += 0.1
    probingPriority += 0.1
  }

  // 0-1の範囲にクランプ
  riskTolerance = Math.min(1, Math.max(0, riskTolerance))
  conservationPriority = Math.min(1, Math.max(0, conservationPriority))
  probingPriority = Math.min(1, Math.max(0, probingPriority))

  const reasoning = generateOpeningReasoning(
    phaseInfo,
    isNapoleonTeam,
    shouldProbe,
    shouldConserve
  )

  // 信頼度: 序盤は確実性が高い
  const confidence = 0.8

  return {
    phaseInfo,
    shouldProbe,
    shouldConserve,
    informationGathering,
    riskTolerance,
    conservationPriority,
    probingPriority,
    recommendedCardTypes,
    reasoning,
    confidence,
  }
}

/**
 * カードタイプを判定
 * Determine card type
 */
export function determineCardType(
  card: Card,
  gameState: GameState,
  _hand: Card[]
): CardType {
  const isTrump = card.suit === gameState.trumpSuit
  const strength = card.value

  if (isTrump) {
    return 'trump'
  }

  // 戦略的な絵札判定（10は非絵札として扱う）
  // Strategic face card determination (treat 10 as non-face)
  const isStrategicFaceCard = ['J', 'Q', 'K', 'A'].includes(card.rank)

  if (isStrategicFaceCard) {
    // 絵札の強さを判定
    if (strength >= 13) {
      // K, A
      return 'strong_face'
    }
    return 'weak_face' // Q, J
  }

  // 非絵札の強さを判定（10を含む）
  if (strength >= 9) {
    return 'mid_non_face'
  }
  return 'weak_non_face'
}

/**
 * 序盤戦略に基づくボーナス計算
 * Calculate bonus based on opening strategy
 */
export function calculateOpeningBonus(
  card: Card,
  openingStrategy: OpeningStrategy,
  gameState: GameState,
  hand: Card[]
): number {
  if (!openingStrategy.phaseInfo.isOpeningPhase) {
    return 0
  }

  const cardType = determineCardType(card, gameState, hand)
  const { recommendedCardTypes, conservationPriority, probingPriority } =
    openingStrategy

  let bonus = 0

  // 推奨カードタイプとのマッチング
  if (recommendedCardTypes.includes(cardType)) {
    // 推奨タイプのカード
    if (cardType === 'weak_non_face') {
      bonus += 80 * probingPriority
    } else if (cardType === 'mid_non_face') {
      bonus += 50 * probingPriority
    } else if (cardType === 'weak_face') {
      bonus += 30 * (1 - conservationPriority)
    }
  } else {
    // 非推奨タイプのカード
    if (cardType === 'strong_face') {
      // 強い絵札を序盤で使うのはペナルティ
      bonus -= 60 * conservationPriority
    } else if (cardType === 'trump') {
      // 切り札を序盤で使うのはペナルティ
      bonus -= 50 * conservationPriority
    }
  }

  // 探りプレイ優先時のボーナス
  if (openingStrategy.shouldProbe && cardType === 'weak_non_face') {
    bonus += 40
  }

  // 手札温存優先時の調整
  if (openingStrategy.shouldConserve) {
    if (isFaceCard(card)) {
      bonus -= 30
    } else {
      bonus += 20
    }
  }

  return bonus * openingStrategy.confidence
}

/**
 * 序盤の理由を生成
 * Generate opening strategy reasoning
 */
function generateOpeningReasoning(
  phaseInfo: OpeningPhaseInfo,
  isNapoleonTeam: boolean,
  shouldProbe: boolean,
  shouldConserve: boolean
): string {
  const parts: string[] = []

  parts.push(`Trick ${phaseInfo.currentTrick}`)

  if (phaseInfo.phase === 'early_probe') {
    parts.push('Early probe phase')
  } else if (phaseInfo.phase === 'mid_opening') {
    parts.push('Mid-opening phase')
  } else if (phaseInfo.phase === 'late_opening') {
    parts.push('Late opening phase')
  }

  if (shouldProbe) {
    parts.push('Probing strategy')
  }

  if (shouldConserve) {
    parts.push('Hand conservation')
  }

  if (isNapoleonTeam) {
    parts.push('Napoleon team: Moderate aggression')
  } else {
    parts.push('Alliance team: Defensive probing')
  }

  return parts.join(' | ')
}

/**
 * 序盤戦略のサマリーを取得
 * Get summary of opening strategy
 */
export function getOpeningSummary(openingStrategy: OpeningStrategy): string {
  const { phaseInfo, riskTolerance, conservationPriority, probingPriority } =
    openingStrategy

  const parts: string[] = []

  if (phaseInfo.isOpeningPhase) {
    parts.push(
      `Opening: Trick ${phaseInfo.currentTrick}/${OPENING_PHASE_TRICKS}`
    )
    parts.push(`Phase: ${phaseInfo.phase}`)
  } else {
    parts.push('Post-opening')
  }

  parts.push(`Risk: ${(riskTolerance * 100).toFixed(0)}%`)
  parts.push(`Conserve: ${(conservationPriority * 100).toFixed(0)}%`)
  parts.push(`Probe: ${(probingPriority * 100).toFixed(0)}%`)

  return parts.join(' | ')
}

/**
 * 序盤プレイの推奨を生成
 * Generate opening play recommendations
 */
export function generateOpeningRecommendations(
  playableCards: Card[],
  openingStrategy: OpeningStrategy,
  gameState: GameState,
  hand: Card[]
): OpeningPlayRecommendation[] {
  if (!openingStrategy.phaseInfo.isOpeningPhase) {
    return []
  }

  return playableCards.map((card) => {
    const cardType = determineCardType(card, gameState, hand)
    const isRecommended =
      openingStrategy.recommendedCardTypes.includes(cardType)

    let suitability = 50

    if (isRecommended) {
      suitability += 40
    } else {
      suitability -= 30
    }

    // 探りプレイ優先時
    if (openingStrategy.shouldProbe && cardType === 'weak_non_face') {
      suitability += 20
    }

    // 温存優先時
    if (openingStrategy.shouldConserve && isFaceCard(card)) {
      suitability -= 30
    }

    suitability = Math.min(100, Math.max(0, suitability))

    const reasoning = generateCardReasoning(cardType, isRecommended)

    return {
      card,
      cardType,
      suitability,
      reasoning,
    }
  })
}

/**
 * カード推奨の理由を生成
 * Generate card recommendation reasoning
 */
function generateCardReasoning(
  cardType: CardType,
  isRecommended: boolean
): string {
  if (isRecommended) {
    switch (cardType) {
      case 'weak_non_face':
        return 'Ideal for probing'
      case 'mid_non_face':
        return 'Good for information gathering'
      case 'weak_face':
        return 'Acceptable for mid-opening'
      default:
        return 'Suitable for opening'
    }
  } else {
    switch (cardType) {
      case 'strong_face':
        return 'Too valuable for opening'
      case 'trump':
        return 'Save trump for later'
      default:
        return 'Not optimal for this phase'
    }
  }
}
