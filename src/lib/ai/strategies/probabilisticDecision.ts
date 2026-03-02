/**
 * Probabilistic decision making for Napoleon Game AI
 * 確率的意思決定システム
 *
 * Calculates win probabilities and expected values for card choices
 * カード選択の勝率と期待値を計算
 */

import type { Card, GameState, Player, Trick } from '@/types/game'
import { isFaceCard } from './helpers'
import type { CardCountingInfo, WinningRequirements } from './types'

/**
 * 確率的評価結果
 * Probabilistic evaluation result
 */
export interface ProbabilisticResult {
  winProbability: number // 0-1, ナポレオンチームの勝率
  expectedFaceCards: number // 期待される絵札獲得数
  variance: number // 分散（不確実性の指標）
  confidence: number // 0-1, 計算の信頼度
  contributionScore: number // このカードの貢献度スコア
}

/**
 * カード選択の確率的評価
 * Probabilistic evaluation for card choice
 */
export interface CardProbabilityInfo {
  card: Card
  winProbability: number
  expectedValue: number
  riskScore: number // 0-1, リスクの高さ
  opportunityScore: number // 0-1, 機会の大きさ
}

/**
 * 残りトリックでの期待値計算
 */
interface ExpectedTrickResult {
  expectedNapoleonWins: number
  expectedAllianceWins: number
  expectedNapoleonFaceCards: number
  expectedAllianceFaceCards: number
  uncertainty: number
}

/**
 * メイン関数: カード選択の確率的評価
 * Main function: Probabilistic evaluation of card choice
 */
export function evaluateCardProbability(
  card: Card,
  _playableCards: Card[],
  gameState: GameState,
  player: Player,
  cardCounting: CardCountingInfo,
  requirements: WinningRequirements
): ProbabilisticResult {
  const isNapoleonTeam = player.isNapoleon || player.isAdjutant

  // 現在の状況を取得
  const currentFaceCards = getCurrentFaceCards(gameState)
  const remainingTricks = getRemainingTricks(gameState)

  // このカードをプレイした場合の期待値を計算
  const trickWinProbability = estimateTrickWinProbability(
    card,
    gameState.currentTrick,
    gameState,
    player,
    cardCounting
  )

  // 残りトリックでの期待獲得数を推定
  const expectedTrickResult = estimateRemainingTricks(
    gameState,
    cardCounting,
    requirements,
    trickWinProbability,
    card
  )

  // ナポレオンチームの最終的な期待絵札数
  const expectedNapoleonTotal =
    currentFaceCards.napoleon + expectedTrickResult.expectedNapoleonFaceCards

  // 勝率を計算
  const targetFaceCards =
    requirements.napoleonTeamFaceCards + requirements.napoleonNeedsToWin
  const winProbability = calculateWinProbability(
    expectedNapoleonTotal,
    targetFaceCards,
    expectedTrickResult.uncertainty
  )

  // 貢献度スコアを計算
  const contributionScore = calculateContributionScore(
    card,
    trickWinProbability,
    expectedNapoleonTotal,
    targetFaceCards,
    isNapoleonTeam
  )

  // 信頼度を計算（カードカウンティング情報の充実度に基づく）
  const confidence = calculateConfidence(
    cardCounting,
    remainingTricks,
    gameState
  )

  return {
    winProbability: isNapoleonTeam ? winProbability : 1 - winProbability,
    expectedFaceCards: isNapoleonTeam
      ? expectedNapoleonTotal
      : currentFaceCards.alliance +
        expectedTrickResult.expectedAllianceFaceCards,
    variance: expectedTrickResult.uncertainty,
    confidence,
    contributionScore,
  }
}

/**
 * 全プレイ可能カードの確率的評価
 * Evaluate all playable cards probabilistically
 */
export function evaluateAllCardsProbability(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  cardCounting: CardCountingInfo,
  requirements: WinningRequirements
): CardProbabilityInfo[] {
  return playableCards.map((card) => {
    const result = evaluateCardProbability(
      card,
      playableCards,
      gameState,
      player,
      cardCounting,
      requirements
    )

    // リスクスコア: 分散が大きいほどリスク高
    const riskScore = Math.min(result.variance / 5, 1)

    // 機会スコア: 期待値が高く、勝率も高い場合に高スコア
    const opportunityScore =
      result.winProbability * (result.contributionScore / 100)

    return {
      card,
      winProbability: result.winProbability,
      expectedValue: result.expectedFaceCards,
      riskScore,
      opportunityScore,
    }
  })
}

/**
 * 現在の絵札獲得数を取得
 */
function getCurrentFaceCards(gameState: GameState): {
  napoleon: number
  alliance: number
} {
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

  return { napoleon: napoleonFaceCards, alliance: allianceFaceCards }
}

/**
 * 残りトリック数を計算
 */
function getRemainingTricks(gameState: GameState): number {
  const totalTricks = 12
  const completedTricks = gameState.tricks.length
  return totalTricks - completedTricks
}

/**
 * トリック勝利確率を推定
 * Estimate probability of winning the current trick with this card
 */
function estimateTrickWinProbability(
  card: Card,
  currentTrick: Trick,
  gameState: GameState,
  _player: Player,
  cardCounting: CardCountingInfo
): number {
  // トリックが空の場合、リードプレイヤーの勝率は高い
  if (currentTrick.cards.length === 0) {
    return 0.6 // リードは有利
  }

  const leadingSuit = currentTrick.leadingSuit
  const trumpSuit = gameState.trumpSuit

  // 現在の最強カードを取得
  const currentBestCard = getCurrentBestCard(currentTrick, gameState)
  if (!currentBestCard) return 0.5

  // 自分のカードが現在最強か判定
  const isTrump = card.suit === trumpSuit
  const isLeadingSuit = card.suit === leadingSuit
  const currentBestIsTrump = currentBestCard.suit === trumpSuit

  // カードの強さを比較
  let baseWinProbability = 0

  if (isTrump && !currentBestIsTrump) {
    // 切り札で非切り札に勝つ
    baseWinProbability = 0.9
  } else if (isTrump && currentBestIsTrump) {
    // 切り札同士
    if (card.value > currentBestCard.value) {
      baseWinProbability = 0.85
    } else {
      baseWinProbability = 0.1
    }
  } else if (isLeadingSuit && card.value > currentBestCard.value) {
    // リードスートで現在最強より強い
    baseWinProbability = 0.7
  } else if (isLeadingSuit) {
    // リードスートだが弱い
    baseWinProbability = 0.2
  } else {
    // リードスートでも切り札でもない
    baseWinProbability = 0.05
  }

  // 残りプレイヤーが持つ可能性のある強カードを考慮
  const remainingPlayers = 4 - currentTrick.cards.length - 1
  if (remainingPlayers > 0) {
    const adjustmentFactor = estimateRemainingStrongCards(
      card,
      currentTrick,
      gameState,
      cardCounting
    )
    baseWinProbability *= 1 - adjustmentFactor * 0.3 // 最大30%減少
  }

  return Math.max(0, Math.min(1, baseWinProbability))
}

/**
 * 現在のトリックで最強のカードを取得
 */
function getCurrentBestCard(
  currentTrick: Trick,
  gameState: GameState
): Card | null {
  if (currentTrick.cards.length === 0) return null

  const trumpSuit = gameState.trumpSuit
  const leadingSuit = currentTrick.leadingSuit

  let bestCard = currentTrick.cards[0].card
  let bestValue = getEffectiveValue(bestCard, trumpSuit, leadingSuit)

  for (let i = 1; i < currentTrick.cards.length; i++) {
    const card = currentTrick.cards[i].card
    const value = getEffectiveValue(card, trumpSuit, leadingSuit)
    if (value > bestValue) {
      bestCard = card
      bestValue = value
    }
  }

  return bestCard
}

/**
 * カードの実効的な強さを計算
 */
function getEffectiveValue(
  card: Card,
  trumpSuit: string | undefined,
  leadingSuit: string | undefined
): number {
  const isTrump = card.suit === trumpSuit
  const isLeadingSuit = card.suit === leadingSuit

  if (isTrump) {
    return card.value + 100 // 切り札は大幅ボーナス
  }
  if (isLeadingSuit) {
    return card.value + 50 // リードスートは中程度ボーナス
  }
  return 0 // その他のスートは価値なし
}

/**
 * 残りプレイヤーが強いカードを持つ可能性を推定
 */
function estimateRemainingStrongCards(
  card: Card,
  currentTrick: Trick,
  gameState: GameState,
  cardCounting: CardCountingInfo
): number {
  const trumpSuit = gameState.trumpSuit
  const leadingSuit = currentTrick.leadingSuit

  // プレイされていない強カードの数を推定
  const trumpTracking = cardCounting.suitTracking.get(trumpSuit || 'spades')
  const leadingTracking = cardCounting.suitTracking.get(leadingSuit || 'spades')

  let strongCardsRemaining = 0

  if (card.suit === trumpSuit) {
    // 自分より強い切り札が何枚残っているか
    strongCardsRemaining = trumpTracking?.remainingFaceCards || 0
    strongCardsRemaining -=
      trumpTracking?.playedCards.filter((c) => c.value > card.value).length || 0
  } else if (card.suit === leadingSuit) {
    // 切り札が何枚残っているか + 自分より強いリードスートカード
    strongCardsRemaining = (trumpTracking?.remainingCards || 0) / 4
    strongCardsRemaining += leadingTracking?.remainingCards || 0
  }

  const remainingPlayers = 4 - currentTrick.cards.length - 1
  if (remainingPlayers === 0) return 0

  // 残りプレイヤーが強カードを持つ確率
  return Math.min(strongCardsRemaining / remainingPlayers / 3, 1)
}

/**
 * 残りトリックでの期待値を推定
 * Estimate expected results for remaining tricks
 */
function estimateRemainingTricks(
  gameState: GameState,
  cardCounting: CardCountingInfo,
  _requirements: WinningRequirements,
  currentTrickWinProb: number,
  currentCard: Card
): ExpectedTrickResult {
  const remainingTricks = getRemainingTricks(gameState)

  // 残り絵札数を推定
  const totalRemainingFaceCards =
    cardCounting.totalRemainingFaceCards - (isFaceCard(currentCard) ? 1 : 0)

  // 各チームのトリック獲得力を推定
  const napoleonWinRate = estimateTeamWinRate(
    gameState,
    cardCounting,
    true // Napoleon team
  )

  // 現在のトリックでの期待値
  const currentTrickFaceCards = countFaceCardsInTrick(
    gameState.currentTrick,
    currentCard
  )

  const currentTrickNapoleonExpected =
    currentTrickWinProb * currentTrickFaceCards
  const currentTrickAllianceExpected =
    (1 - currentTrickWinProb) * currentTrickFaceCards

  // 残りトリックでの期待値（現在のトリック除く）
  const futureRemainingTricks = Math.max(0, remainingTricks - 1)
  const avgFaceCardsPerTrick =
    totalRemainingFaceCards / Math.max(futureRemainingTricks, 1)

  const futureNapoleonExpected =
    napoleonWinRate * avgFaceCardsPerTrick * futureRemainingTricks
  const futureAllianceExpected =
    (1 - napoleonWinRate) * avgFaceCardsPerTrick * futureRemainingTricks

  // 不確実性を計算（残りトリックが多いほど不確実）
  const uncertainty = Math.sqrt(remainingTricks) * 0.5

  return {
    expectedNapoleonWins:
      currentTrickWinProb + napoleonWinRate * futureRemainingTricks,
    expectedAllianceWins:
      1 - currentTrickWinProb + (1 - napoleonWinRate) * futureRemainingTricks,
    expectedNapoleonFaceCards:
      currentTrickNapoleonExpected + futureNapoleonExpected,
    expectedAllianceFaceCards:
      currentTrickAllianceExpected + futureAllianceExpected,
    uncertainty,
  }
}

/**
 * トリック内の絵札数をカウント（予定カード含む）
 */
function countFaceCardsInTrick(
  currentTrick: Trick,
  additionalCard: Card
): number {
  const existing = currentTrick.cards.filter((tc) => isFaceCard(tc.card)).length
  const additional = isFaceCard(additionalCard) ? 1 : 0
  return existing + additional
}

/**
 * チームのトリック獲得率を推定
 */
function estimateTeamWinRate(
  gameState: GameState,
  cardCounting: CardCountingInfo,
  isNapoleonTeam: boolean
): number {
  // 過去のトリック結果から推定
  const completedTricks = gameState.tricks.filter((t) => t.winnerPlayerId)
  if (completedTricks.length === 0) return 0.5 // デフォルト

  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)

  let napoleonWins = 0
  for (const trick of completedTricks) {
    if (
      trick.winnerPlayerId === napoleon?.id ||
      (adjutant && trick.winnerPlayerId === adjutant.id)
    ) {
      napoleonWins++
    }
  }

  const historicalWinRate = napoleonWins / completedTricks.length

  // 残りカードの強さを考慮した調整
  const trumpTracking = cardCounting.suitTracking.get(
    gameState.trumpSuit || 'spades'
  )
  const trumpAdjustment = ((trumpTracking?.remainingFaceCards || 0) / 13) * 0.2

  const adjustedWinRate = isNapoleonTeam
    ? historicalWinRate + trumpAdjustment
    : 1 - historicalWinRate - trumpAdjustment

  return Math.max(0.2, Math.min(0.8, adjustedWinRate)) // 0.2-0.8の範囲に制限
}

/**
 * 勝率を計算
 * Calculate win probability based on expected face cards
 */
function calculateWinProbability(
  expectedFaceCards: number,
  targetFaceCards: number,
  uncertainty: number
): number {
  // 期待値と目標の差
  const diff = expectedFaceCards - targetFaceCards

  // 標準正規分布を近似的に使用
  // z = diff / uncertainty
  const z = uncertainty > 0 ? diff / uncertainty : diff

  // シグモイド関数で確率に変換
  const probability = 1 / (1 + Math.exp(-z))

  return Math.max(0, Math.min(1, probability))
}

/**
 * カードの貢献度スコアを計算
 */
function calculateContributionScore(
  card: Card,
  trickWinProbability: number,
  expectedTotal: number,
  target: number,
  isNapoleonTeam: boolean
): number {
  // 基本スコア: トリック勝利確率 × 絵札価値
  const faceCardValue = isFaceCard(card) ? 20 : 0
  let score = trickWinProbability * (50 + faceCardValue)

  // 目標達成への寄与度
  const distanceToTarget = Math.abs(expectedTotal - target)
  if (distanceToTarget < 2) {
    // 目標に近い場合、高評価
    score += 30
  }

  // チームに応じて調整
  if (!isNapoleonTeam) {
    // 連合軍は逆の評価
    score = 100 - score
  }

  return Math.max(0, Math.min(100, score))
}

/**
 * 信頼度を計算
 * Calculate confidence based on information availability
 */
function calculateConfidence(
  cardCounting: CardCountingInfo,
  remainingTricks: number,
  _gameState: GameState
): number {
  // カウンティング情報の充実度
  const totalCards = 52
  const playedCards = cardCounting.totalPlayedCards
  const informationRatio = playedCards / totalCards

  // 残りトリックが少ないほど高信頼度
  const tricksConfidence = 1 - remainingTricks / 12

  // 総合信頼度
  const confidence = informationRatio * 0.6 + tricksConfidence * 0.4

  return Math.max(0.3, Math.min(1, confidence))
}

/**
 * 確率的評価に基づくカードスコアボーナス
 * Calculate score bonus based on probabilistic evaluation
 */
export function calculateProbabilisticBonus(
  probabilisticResult: ProbabilisticResult,
  requirements: WinningRequirements,
  isNapoleonTeam: boolean
): number {
  const { winProbability, contributionScore, confidence } = probabilisticResult

  // 基本ボーナス: 勝率 × 貢献度 × 信頼度
  let bonus = winProbability * contributionScore * confidence

  // 緊急度による調整
  // isCriticalPhase: 勝敗が決まる重要局面
  // isNapoleonAhead/isAllianceAhead: 優勢判定
  if (requirements.isCriticalPhase) {
    bonus *= 1.5 // 緊急時はボーナス増加
  } else if (
    (isNapoleonTeam && requirements.isNapoleonAhead) ||
    (!isNapoleonTeam && requirements.isAllianceAhead)
  ) {
    bonus *= 0.8 // 余裕がある時はボーナス控えめ
  }

  // チームに応じて符号調整
  return isNapoleonTeam ? bonus : -bonus
}
