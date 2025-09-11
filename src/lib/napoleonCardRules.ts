import {
  CARD_RANKS,
  CARD_STRENGTH,
  COUNTER_SUITS,
  SPECIAL_CARDS,
} from '@/lib/constants'
import type { Card, PlayedCard, Suit, Trick } from '@/types/game'

/**
 * ナポレオンゲームの特殊カードルールを管理
 */

/**
 * 裏スートの関係を取得
 */
export function getCounterSuit(suit: Suit): Suit {
  return COUNTER_SUITS[suit]
}

/**
 * マイティーかどうかを判定（♠A）
 */
export function isMighty(card: Card): boolean {
  return (
    card.suit === SPECIAL_CARDS.MIGHTY_SUIT &&
    card.rank === SPECIAL_CARDS.MIGHTY_RANK
  )
}

/**
 * 切り札ジャックかどうかを判定
 */
export function isTrumpJack(card: Card, trumpSuit: Suit): boolean {
  return card.suit === trumpSuit && card.rank === CARD_RANKS.JACK
}

/**
 * 裏ジャック（切り札の裏スートのJ）かどうかを判定
 */
export function isCounterJack(card: Card, trumpSuit: Suit): boolean {
  const counterSuit = getCounterSuit(trumpSuit)
  return card.suit === counterSuit && card.rank === CARD_RANKS.JACK
}

/**
 * 切り札かどうかを判定
 */
export function isTrump(card: Card, trumpSuit: Suit): boolean {
  return card.suit === trumpSuit
}

/**
 * ハートのQかどうかを判定（よろめき用）
 */
export function isHeartQueen(card: Card): boolean {
  return (
    card.suit === SPECIAL_CARDS.HEART_QUEEN_SUIT &&
    card.rank === SPECIAL_CARDS.HEART_QUEEN_RANK
  )
}

/**
 * 対応する狩りJペアかどうかを判定
 * - スペードJ（切り札）とハートJ（最弱）
 * - クラブJ（切り札）とダイヤJ（最弱）
 */
export function isHuntingJackPair(
  card1: Card,
  card2: Card,
  trumpSuit: Suit
): boolean {
  const pairs = [
    ['spades', 'hearts'],
    ['clubs', 'diamonds'],
  ]

  for (const [suit1, suit2] of pairs) {
    if (
      ((card1.suit === suit1 && card2.suit === suit2) ||
        (card1.suit === suit2 && card2.suit === suit1)) &&
      card1.rank === CARD_RANKS.JACK &&
      card2.rank === CARD_RANKS.JACK
    ) {
      // どちらかが切り札Jである必要がある
      return card1.suit === trumpSuit || card2.suit === trumpSuit
    }
  }
  return false
}

/**
 * カードの基本強度を取得（特殊ルール考慮前）
 */
export function getCardStrength(
  card: Card,
  trumpSuit: Suit,
  leadingSuit: Suit
): number {
  // マイティー
  if (isMighty(card)) {
    return CARD_STRENGTH.MIGHTY
  }

  // 切り札ジャック
  if (isTrumpJack(card, trumpSuit)) {
    return CARD_STRENGTH.TRUMP_JACK
  }

  // 裏ジャック
  if (isCounterJack(card, trumpSuit)) {
    return CARD_STRENGTH.COUNTER_JACK
  }

  // その他の切り札
  if (isTrump(card, trumpSuit)) {
    // 切り札以外のJは最弱（値を1に設定）
    const value = card.rank === CARD_RANKS.JACK ? 1 : card.value
    return CARD_STRENGTH.TRUMP_BASE + value
  }

  // リードスートのカード
  if (card.suit === leadingSuit) {
    // 切り札・裏J以外のJは最弱
    const value = card.rank === CARD_RANKS.JACK ? 1 : card.value
    return CARD_STRENGTH.LEADING_BASE + value
  }

  // その他のスート（トリックを取れない）
  return CARD_STRENGTH.OTHER_BASE + card.value
}

/**
 * セイム2ルールの判定
 */
export function checkSame2Rule(
  trick: Trick,
  trumpSuit: Suit
): PlayedCard | null {
  const conditions = checkSame2Conditions(trick, trumpSuit)
  if (!conditions.isValid) return null

  // マイティが出ている場合はセイム2ルール無効（マイティが最強）
  const mightyCard = trick.cards.find((pc) => isMighty(pc.card))
  if (mightyCard) return null

  // 裏Jが出ている場合はセイム2より裏Jが強い
  const counterJackCard = trick.cards.find((pc) =>
    isCounterJack(pc.card, trumpSuit)
  )
  if (counterJackCard) return null

  return conditions.twoCard
}

/**
 * セイム2の条件をチェック（裏Jチェックなし）
 */
function checkSame2Conditions(
  trick: Trick,
  trumpSuit: Suit
): { isValid: boolean; twoCard: PlayedCard | null } {
  if (trick.cards.length !== 4) return { isValid: false, twoCard: null }

  const leadingSuit = trick.cards[0].card.suit

  // 切り札の場合は無効
  if (leadingSuit === trumpSuit) return { isValid: false, twoCard: null }

  // 全員が同じスート（リードスート）を出しているかチェック
  const allSameSuit = trick.cards.every((pc) => pc.card.suit === leadingSuit)
  if (!allSameSuit) return { isValid: false, twoCard: null }

  // 2が出ているかチェック
  const twoCard = trick.cards.find((pc) => pc.card.rank === CARD_RANKS.TWO)
  if (!twoCard) return { isValid: false, twoCard: null }

  return { isValid: true, twoCard }
}

/**
 * よろめきルールの判定（マイティーがある時のハートQ）
 */
export function checkYoromekiRule(
  trick: Trick,
  trumpSuit: Suit
): PlayedCard | null {
  const mightyCard = trick.cards.find((pc) => isMighty(pc.card))
  const heartQueenCard = trick.cards.find((pc) => isHeartQueen(pc.card))

  if (!mightyCard || !heartQueenCard) return null

  // 切り札Jや裏Jがある場合は無効
  const hasTrumpJack = trick.cards.some((pc) => isTrumpJack(pc.card, trumpSuit))
  const hasCounterJack = trick.cards.some((pc) =>
    isCounterJack(pc.card, trumpSuit)
  )

  if (hasTrumpJack || hasCounterJack) return null

  return heartQueenCard
}

/**
 * 狩りJルールの判定
 */
export function checkHuntingJackRule(
  trick: Trick,
  trumpSuit: Suit
): PlayedCard | null {
  const jacks = trick.cards.filter((pc) => pc.card.rank === CARD_RANKS.JACK)
  if (jacks.length < 2) return null

  // 狩りJペアを探す
  for (let i = 0; i < jacks.length; i++) {
    for (let j = i + 1; j < jacks.length; j++) {
      const jack1 = jacks[i]
      const jack2 = jacks[j]

      if (isHuntingJackPair(jack1.card, jack2.card, trumpSuit)) {
        // 他に別スートの切り札や裏Jがある場合は無効
        const otherTrumpCards = trick.cards.filter(
          (pc) =>
            pc !== jack1 &&
            pc !== jack2 &&
            (isTrumpJack(pc.card, trumpSuit) ||
              isCounterJack(pc.card, trumpSuit))
        )

        if (otherTrumpCards.length > 0) return null

        // マイティーがある場合は無効
        const hasMighty = trick.cards.some((pc) => isMighty(pc.card))
        if (hasMighty) return null

        // 最弱Jを返す（切り札でない方）
        return isTrumpJack(jack1.card, trumpSuit) ? jack2 : jack1
      }
    }
  }

  return null
}

/**
 * 新しい勝者決定ロジック（特殊ルール適用）
 */
export function determineWinnerWithSpecialRules(
  trick: Trick,
  trumpSuit: Suit,
  isFirstTrick: boolean = false
): PlayedCard | null {
  if (trick.cards.length === 0) return null

  const leadingSuit = trick.cards[0].card.suit

  // よろめきと狩りJルールの特別な判定
  const mightyCard = trick.cards.find((pc) => isMighty(pc.card))
  const heartQueenCard = trick.cards.find((pc) => isHeartQueen(pc.card))

  if (mightyCard && heartQueenCard) {
    // よろめきの基本条件が満たされている場合
    const huntingJackWinner = checkHuntingJackRule(trick, trumpSuit)

    if (huntingJackWinner) {
      // 狩りJルールも発動する場合、よろめきを優先
      return heartQueenCard
    }

    // 狩りJルールが発動しない場合、通常のよろめき判定
    const yoromekiWinner = checkYoromekiRule(trick, trumpSuit)
    if (yoromekiWinner) return yoromekiWinner
  }

  // 2. 狩りJルール（よろめきがない、または無効な場合）
  const huntingJackWinner = checkHuntingJackRule(trick, trumpSuit)
  if (huntingJackWinner) return huntingJackWinner

  // 3. セイム2ルール（最初のトリック以外）
  if (!isFirstTrick) {
    // checkSame2Rule関数を使用（マイティと裏Jの両方をチェック）
    const same2Winner = checkSame2Rule(trick, trumpSuit)
    if (same2Winner) {
      return same2Winner
    }
  }

  // 4. 通常の強度比較
  let winner = trick.cards[0]
  let maxStrength = getCardStrength(winner.card, trumpSuit, leadingSuit)

  for (const playedCard of trick.cards) {
    const strength = getCardStrength(playedCard.card, trumpSuit, leadingSuit)
    if (strength > maxStrength) {
      maxStrength = strength
      winner = playedCard
    }
  }

  return winner
}
