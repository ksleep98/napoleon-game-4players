/**
 * Common helper functions for AI strategy evaluation
 */

import { getCardStrength } from '@/lib/napoleonCardRules'
import type { Card, GameState, Suit, Trick } from '@/types/game'
import { getWinningCards } from './trickOutcome'

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
 *
 * ⚠️ 空トリック（リード局面）では「最強カード」が存在しないため必ず throw する。
 * 以前は `cards[0].card` で undefined を参照して意味不明な TypeError になり、
 * 呼び出し元の try/catch でランダム着手に落ちていた。
 * リード局面かどうかは **呼び出し側でガードすること**。
 */
export function getBestTrickCard(currentTrick: Trick, gameState: GameState) {
  if (currentTrick.cards.length === 0) {
    throw new Error(
      'getBestTrickCard: cannot evaluate an empty trick (guard the leading case at the call site)'
    )
  }

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
 *
 * リード局面（空トリック）では「勝つために必要な札」を定義できないので、
 * 最弱カードを返して落ちないようにする。
 *
 * 勝ち札の抽出は素の強度比較ではなく実際の勝者判定（`wouldWinTrick`）で行う。
 * 素の強度だけを見ていた頃は、狩J（切り札♠のときの♥J など）が「そのスート内で
 * 最弱」に見えるせいで、場に表J が出ていても「勝てない」と判断して出さなかった。
 * 並び替えは従来どおり素の強度の昇順なので、強度の低い狩J は自然に最優先で
 * 選ばれる（＝一番安い勝ち札を使う、という元の意図どおりになる）。
 */
export function getLowestWinningCard(
  cards: Card[],
  currentTrick: Trick,
  gameState: GameState
): Card {
  if (currentTrick.cards.length === 0) {
    return getWeakestCard([...cards], gameState)
  }

  const winningCards = getWinningCards(cards, currentTrick, gameState)

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
