/**
 * Common helper functions for AI strategy evaluation
 */

import { getCardStrength } from '@/lib/napoleonCardRules'
import type { Card, GameState, Suit, Trick } from '@/types/game'

/**
 * カードが絵札（10, J, Q, K, A）かどうかを判定
 */
export function isFaceCard(card: Card): boolean {
  return ['10', 'J', 'Q', 'K', 'A'].includes(card.rank)
}

/**
 * カードの強さを安全に取得（例外ハンドリング付き）
 */
export function getCardStrengthSafe(
  card: Card,
  gameState: GameState,
  leadingSuit?: Suit
): number {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const effectiveLeadingSuit =
    leadingSuit ||
    (gameState.currentTrick.cards.length > 0
      ? gameState.currentTrick.cards[0].card.suit
      : trumpSuit)

  return getCardStrength(card, trumpSuit, effectiveLeadingSuit as Suit)
}

/**
 * トリック内で最も強いカードを取得
 */
export function getBestTrickCard(currentTrick: Trick, gameState: GameState) {
  let bestCard = currentTrick.cards[0].card
  let bestStrength = getCardStrengthSafe(bestCard, gameState)

  for (const trickCard of currentTrick.cards) {
    const strength = getCardStrengthSafe(trickCard.card, gameState)
    if (strength > bestStrength) {
      bestCard = trickCard.card
      bestStrength = strength
    }
  }

  return { card: bestCard, strength: bestStrength }
}

/**
 * 現在のトリックに勝つために必要な最も弱いカードを取得
 */
export function getLowestWinningCard(
  cards: Card[],
  currentTrick: Trick,
  gameState: GameState
): Card {
  const bestOpponent = getBestTrickCard(currentTrick, gameState)
  const winningCards = cards.filter(
    (card) => getCardStrengthSafe(card, gameState) > bestOpponent.strength
  )

  if (winningCards.length === 0) return cards[0]

  return winningCards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )[0]
}

/**
 * 最も弱いカードを取得
 */
export function getWeakestCard(cards: Card[], gameState: GameState): Card {
  return cards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )[0]
}

/**
 * 最も弱い非絵札カードを取得（絵札を温存するため）
 */
export function getWeakestNonFaceCard(
  cards: Card[],
  gameState: GameState
): Card | null {
  const nonFaceCards = cards.filter((card) => !isFaceCard(card))
  if (nonFaceCards.length === 0) return null

  return nonFaceCards.sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )[0]
}

/**
 * 捨て札として最弱カードを選ぶが、セイム2用の「2」を不用意に捨てない。
 *
 * 非切り札の2はセイム2が成立すれば単独でトリックを取れる切り札的な札なので、
 * 勝てないトリックで捨てる場合でも、他に捨てられるカードがあり、かつ序盤〜中盤
 * （セイム2を狙える時期）であれば2を温存して次に弱いカードを捨てる。
 * 終盤（進行度0.7以上）は2が死に札になりやすいので通常どおり捨てる。
 */
export function getWeakestCardPreservingSame2(
  cards: Card[],
  gameState: GameState
): Card {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'
  const sorted = [...cards].sort(
    (a, b) =>
      getCardStrengthSafe(a, gameState) - getCardStrengthSafe(b, gameState)
  )

  const weakest = sorted[0]
  const isSame2Two = weakest.rank === '2' && weakest.suit !== trumpSuit
  const gameProgress = calculateGameProgress(gameState)

  // 序盤〜中盤で、2以外に捨てられる札がある場合のみ2を温存
  if (isSame2Two && gameProgress < 0.7 && sorted.length > 1) {
    return sorted[1]
  }

  return weakest
}

/**
 * ゲームの進行度を計算（0.0〜1.0）
 */
export function calculateGameProgress(gameState: GameState): number {
  const totalTricks = 12 // ナポレオンは12トリック
  const completedTricks = gameState.tricks.length
  return completedTricks / totalTricks
}
