/**
 * Trump strategy functions for AI card selection
 * 切り札戦略関連の関数
 */

import {
  isCounterJack as checkIsCounterJack,
  isMighty as checkIsMighty,
  isTrumpJack as checkIsTrumpJack,
} from '@/lib/napoleonCardRules'
import type { Card, GameState, Player, Suit, Trick } from '@/types/game'
import {
  calculateGameProgress,
  getBestTrickCard,
  getCardStrengthSafe,
  isFaceCard,
} from './helpers'
import type { HandComposition, TrumpTracking } from './types'

/**
 * ナポレオンチームが現在のトリックで勝っているか判定
 */
export function isNapoleonWinning(
  currentTrick: Trick,
  gameState: GameState
): boolean {
  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)
  if (!napoleon) return false

  const bestCard = getBestTrickCard(currentTrick, gameState)
  return currentTrick.cards.some(
    (trickCard) =>
      (trickCard.playerId === napoleon.id ||
        trickCard.playerId === adjutant?.id) &&
      trickCard.card === bestCard.card
  )
}

/**
 * 連合軍が現在のトリックで勝っているか判定
 */
export function isAllianceWinning(
  currentTrick: Trick,
  gameState: GameState
): boolean {
  const napoleon = gameState.players.find((p) => p.isNapoleon)
  const adjutant = gameState.players.find((p) => p.isAdjutant)
  if (!napoleon) return false

  const bestCard = getBestTrickCard(currentTrick, gameState)
  // 最強カードがナポレオンチーム以外のプレイヤーのものか確認
  return currentTrick.cards.some(
    (trickCard) =>
      trickCard.playerId !== napoleon.id &&
      trickCard.playerId !== adjutant?.id &&
      trickCard.card === bestCard.card
  )
}

/**
 * ボイド後の切り札介入を判断
 * 自分がボイド（そのスートを持っていない）で、切り札を使うべきか判断
 */
export function shouldInterventWithTrump(
  playableCards: Card[],
  currentTrick: Trick,
  gameState: GameState,
  player: Player,
  trumpTracking: TrumpTracking
): boolean {
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 切り札を持っていない場合はfalse
  if (trumpTracking.myTrumps.length === 0) return false

  // 既に切り札が出ている場合は、勝てるかチェック
  const trumpInTrick = currentTrick.cards.find(
    (tc) =>
      tc.card.suit === trumpSuit ||
      checkIsMighty(tc.card) ||
      checkIsTrumpJack(tc.card, trumpSuit) ||
      checkIsCounterJack(tc.card, trumpSuit)
  )

  if (trumpInTrick) {
    // 切り札が既に出ている場合、勝てる切り札があるかチェック
    const canWin = playableCards.some(
      (card) =>
        (card.suit === trumpSuit ||
          checkIsMighty(card) ||
          checkIsTrumpJack(card, trumpSuit) ||
          checkIsCounterJack(card, trumpSuit)) &&
        getCardStrengthSafe(card, gameState) >
          getCardStrengthSafe(trumpInTrick.card, gameState)
    )

    if (!canWin) {
      return false // 勝てないなら切り札を使わない
    }
  }

  // トリック内の絵札をカウント
  const faceCardsInTrick = currentTrick.cards.filter((tc) =>
    isFaceCard(tc.card)
  ).length

  // 役割別の判断
  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 絵札が2枚以上あるなら切り札で取る
    if (faceCardsInTrick >= 2) {
      return true
    }

    // 連合軍が勝っている場合、切り札でブロック
    if (isAllianceWinning(currentTrick, gameState)) {
      return true
    }
  } else {
    // 連合軍: ナポレオンが勝っている場合、切り札でブロック
    if (isNapoleonWinning(currentTrick, gameState)) {
      return true
    }

    // 絵札が3枚以上ある場合、味方に渡すために切り札で勝つ
    if (faceCardsInTrick >= 3) {
      return true
    }
  }

  // 切り札の強さを考慮
  // 弱い切り札（2-7）しかない場合は使わない
  const hasOnlyWeakTrumps = trumpTracking.myTrumps.every(
    (card) =>
      !checkIsMighty(card) &&
      !checkIsTrumpJack(card, trumpSuit) &&
      !checkIsCounterJack(card, trumpSuit) &&
      ['2', '3', '4', '5', '6', '7'].includes(card.rank)
  )

  if (hasOnlyWeakTrumps && faceCardsInTrick < 2) {
    return false // 弱い切り札は温存
  }

  return false
}

/**
 * 切り札でリードすべきか判断
 * ゲーム進行度、役割、手札構成から切り札リード戦略を決定
 */
export function shouldLeadWithTrump(
  hand: Card[],
  gameState: GameState,
  player: Player,
  composition: HandComposition
): boolean {
  const gameProgress = calculateGameProgress(gameState)
  const trumpSuit = (gameState.trumpSuit as Suit) || 'spades'

  // 切り札を持っていない場合はfalse
  if (composition.trumpCount === 0) return false

  if (player.isNapoleon || player.isAdjutant) {
    // ナポレオンチーム: 切り札支配戦略

    // 終盤（70%以降）で切り札が複数ある場合、切り札でリード
    if (gameProgress >= 0.7 && composition.trumpCount >= 2) {
      return true
    }

    // 中盤（40-70%）で強い切り札（Mighty, Jack, A, K）がある場合
    if (gameProgress >= 0.4 && gameProgress < 0.7) {
      const strongTrumps = hand.filter(
        (card) =>
          card.suit === trumpSuit &&
          (checkIsMighty(card) ||
            checkIsTrumpJack(card, trumpSuit) ||
            ['A', 'K'].includes(card.rank))
      )
      if (strongTrumps.length > 0) {
        return true
      }
    }
  } else {
    // 連合軍: 切り札引き出し戦略

    // 序盤（0-40%）で弱い切り札（2-7）がある場合、ナポレオンの強い切り札を引き出す
    if (gameProgress < 0.4) {
      const weakTrumps = hand.filter(
        (card) =>
          card.suit === trumpSuit &&
          !checkIsMighty(card) &&
          !checkIsTrumpJack(card, trumpSuit) &&
          !checkIsCounterJack(card, trumpSuit) &&
          ['2', '3', '4', '5', '6', '7'].includes(card.rank)
      )

      // 弱い切り札が1-2枚ある場合、引き出し戦略を実行
      if (weakTrumps.length >= 1 && weakTrumps.length <= 2) {
        return true
      }
    }
  }

  return false
}
