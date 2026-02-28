/**
 * Adjutant tactical strategy functions for AI card selection
 * 副官戦術関連の関数
 */

import {
  isCounterJack as checkIsCounterJack,
  isMighty as checkIsMighty,
  isTrumpJack as checkIsTrumpJack,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, Suit, Trick } from '@/types/game'
import {
  calculateGameProgress,
  getCardStrengthSafe,
  isFaceCard,
} from './helpers'
import { isNapoleonWinning } from './trumps'
import type { AdjutantTacticalInfo, WinningRequirements } from './types'

/**
 * 副官戦略評価
 */
export function evaluateAdjutantStrategy(
  card: Card,
  gameState: GameState
): number {
  let bonus = 0

  // 副官はナポレオンをサポート
  // 中程度の強さのカードを温存
  const baseStrength = getCardStrengthSafe(card, gameState)
  if (baseStrength >= 400 && baseStrength <= 600) bonus += 50

  // 副官指定カードなら早めに出すため大きなボーナス
  const adjutantCard = gameState.napoleonDeclaration?.adjutantCard
  if (adjutantCard && card.id === adjutantCard.id) {
    bonus += 500 // 副官指定カードを優先的に出すための高いボーナス
  }

  return bonus
}

/**
 * 副官の戦術を評価
 * 副官特有の戦略（カード開示、ナポレオンへのサポート、協調プレイ）を最適化
 */
export function evaluateAdjutantTactics(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  requirements: WinningRequirements
): AdjutantTacticalInfo {
  // ナポレオンを取得
  const napoleon = gameState.players.find((p) => p.isNapoleon)

  // 副官指定カードを取得
  const adjutantCardId = gameState.napoleonDeclaration?.adjutantCard?.id
  const adjutantCard = adjutantCardId
    ? playableCards.find((card) => card.id === adjutantCardId) || null
    : null

  // ナポレオンが現在のトリックで勝っているかチェック
  const napoleonIsWinning = napoleon
    ? isNapoleonWinning(currentTrick, gameState)
    : false

  // トリック内の絵札数
  const faceCardsInTrick = currentTrick.cards.filter((tc) =>
    isFaceCard(tc.card)
  ).length

  // ゲーム進行度
  const gameProgress = calculateGameProgress(gameState)
  const remainingTricks = 12 - gameState.tricks.length

  // ナポレオンの目標達成状況を評価
  const napoleonNeedsHelp =
    requirements.napoleonNeedsToWin > 0 &&
    requirements.napoleonNeedsToWin >= remainingTricks * 0.5 // 残りトリックの50%以上必要な場合

  // トリックのナポレオンへの価値評価（0-10）
  let trickValueForNapoleon = 0
  if (faceCardsInTrick >= 3)
    trickValueForNapoleon = 10 // 非常に価値が高い
  else if (faceCardsInTrick === 2)
    trickValueForNapoleon = 7 // 価値が高い
  else if (faceCardsInTrick === 1)
    trickValueForNapoleon = 4 // 中程度の価値
  else trickValueForNapoleon = 1 // 低い価値

  // 終盤（残り3トリック以下）はトリック価値を上昇
  if (remainingTricks <= 3 && faceCardsInTrick > 0) {
    trickValueForNapoleon = Math.min(10, trickValueForNapoleon + 3)
  }

  // 副官カード開示の最適タイミング評価（0-10）
  let optimalRevealTiming = 0
  if (adjutantCard) {
    // リードスートと一致するか
    const leadingSuit = currentTrick.leadingSuit || gameState.leadingSuit
    const matchesLeadingSuit = leadingSuit
      ? adjutantCard.suit === leadingSuit
      : false

    if (matchesLeadingSuit) {
      // 序盤〜中盤（70%まで）は開示しやすい
      if (gameProgress < 0.3)
        optimalRevealTiming = 9 // 早期開示が最適
      else if (gameProgress < 0.5)
        optimalRevealTiming = 7 // 中盤も良い
      else if (gameProgress < 0.7)
        optimalRevealTiming = 5 // まだ間に合う
      else optimalRevealTiming = 3 // 終盤は遅い

      // 特殊カードとの競合チェック
      const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
      if (
        checkIsMighty(adjutantCard) ||
        checkIsTrumpJack(adjutantCard, trumpSuit) ||
        checkIsCounterJack(adjutantCard, trumpSuit)
      ) {
        optimalRevealTiming = 0 // 特殊カードは開示に使わない
      }

      // トリック内に特殊カードがある場合は開示しない
      const hasMightyOrJack = currentTrick.cards.some((tc) => {
        const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
        return (
          checkIsMighty(tc.card) ||
          checkIsTrumpJack(tc.card, trumpSuit) ||
          checkIsCounterJack(tc.card, trumpSuit)
        )
      })
      if (hasMightyOrJack) {
        optimalRevealTiming = Math.max(0, optimalRevealTiming - 5)
      }
    }
  }

  // 副官カードを今開示すべきか
  const shouldRevealNow =
    adjutantCard !== null &&
    optimalRevealTiming >= 7 &&
    currentTrick.cards.length > 0 // リード時は出さない

  // ナポレオンを保護すべきか（積極的にサポート）
  const shouldProtectNapoleon =
    napoleonNeedsHelp || (faceCardsInTrick >= 2 && !napoleonIsWinning)

  // 絵札をナポレオンに渡すべきか
  const shouldPassFaceCard =
    napoleonIsWinning && faceCardsInTrick >= 1 && playableCards.some(isFaceCard)

  // ナポレオンのために勝つべきか（ナポレオンが弱い時）
  const shouldWinForNapoleon =
    napoleonNeedsHelp &&
    !napoleonIsWinning &&
    faceCardsInTrick >= 2 &&
    remainingTricks <= 6 // 中盤以降

  // ナポレオンに渡すべき絵札を選択
  let faceCardToPass: Card | null = null
  if (shouldPassFaceCard) {
    const faceCards = playableCards.filter(
      (card) => isFaceCard(card) && !checkIsMighty(card)
    )

    if (faceCards.length > 0) {
      // 最も弱い絵札を選択（10 > Q > K > A の順）
      faceCardToPass = faceCards.sort(
        (a, b) =>
          getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
      )[0]
    }
  }

  return {
    shouldRevealNow,
    shouldProtectNapoleon,
    shouldPassFaceCard,
    shouldWinForNapoleon,
    napoleonNeedsHelp,
    trickValueForNapoleon,
    optimalRevealTiming,
    napoleonIsWinning,
    adjutantCard,
    faceCardToPass,
  }
}
