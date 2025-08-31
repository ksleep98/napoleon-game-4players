import type { Card, Phase, PlayedCard, Suit } from '@/types/game'

/**
 * ナポレオンゲームの特殊カードルールを管理
 */

/**
 * 裏スートの関係を取得
 */
export function getCounterSuit(suit: Suit): Suit {
  const counterSuitMap: Record<Suit, Suit> = {
    spades: 'clubs',
    clubs: 'spades',
    hearts: 'diamonds',
    diamonds: 'hearts',
  }
  return counterSuitMap[suit]
}

/**
 * マイティーかどうかを判定（♠A）
 */
export function isMighty(card: Card): boolean {
  return card.suit === 'spades' && card.rank === 'A'
}

/**
 * 切り札ジャックかどうかを判定
 */
export function isTrumpJack(card: Card, trumpSuit: Suit): boolean {
  return card.suit === trumpSuit && card.rank === 'J'
}

/**
 * 裏ジャック（切り札の裏スートのJ）かどうかを判定
 */
export function isCounterJack(card: Card, trumpSuit: Suit): boolean {
  const counterSuit = getCounterSuit(trumpSuit)
  return card.suit === counterSuit && card.rank === 'J'
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
  return card.suit === 'hearts' && card.rank === 'Q'
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
      card1.rank === 'J' &&
      card2.rank === 'J'
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
    return 1000
  }

  // 切り札ジャック
  if (isTrumpJack(card, trumpSuit)) {
    return 900
  }

  // 裏ジャック
  if (isCounterJack(card, trumpSuit)) {
    return 800
  }

  // その他の切り札
  if (isTrump(card, trumpSuit)) {
    // 切り札以外のJは最弱（値を1に設定）
    const value = card.rank === 'J' ? 1 : card.value
    return 700 + value
  }

  // リードスートのカード
  if (card.suit === leadingSuit) {
    // 切り札・裏J以外のJは最弱
    const value = card.rank === 'J' ? 1 : card.value
    return 600 + value
  }

  // その他のスート（トリックを取れない）
  return card.value
}

/**
 * セイム2ルールの判定
 */
export function checkSame2Rule(
  phase: Phase,
  trumpSuit: Suit
): PlayedCard | null {
  const conditions = checkSame2Conditions(phase, trumpSuit)
  if (!conditions.isValid) return null

  // 裏Jが出ている場合はセイム2より裏Jが強い
  const counterJackCard = phase.cards.find((pc) =>
    isCounterJack(pc.card, trumpSuit)
  )
  if (counterJackCard) return null

  return conditions.twoCard
}

/**
 * セイム2の条件をチェック（裏Jチェックなし）
 */
function checkSame2Conditions(
  phase: Phase,
  trumpSuit: Suit
): { isValid: boolean; twoCard: PlayedCard | null } {
  if (phase.cards.length !== 4) return { isValid: false, twoCard: null }

  const leadingSuit = phase.cards[0].card.suit

  // 切り札の場合は無効
  if (leadingSuit === trumpSuit) return { isValid: false, twoCard: null }

  // 全員が同じスート（リードスート）を出しているかチェック
  const allSameSuit = phase.cards.every((pc) => pc.card.suit === leadingSuit)
  if (!allSameSuit) return { isValid: false, twoCard: null }

  // 2が出ているかチェック
  const twoCard = phase.cards.find((pc) => pc.card.rank === '2')
  if (!twoCard) return { isValid: false, twoCard: null }

  return { isValid: true, twoCard }
}

/**
 * よろめきルールの判定（マイティーがある時のハートQ）
 */
export function checkYoromekiRule(
  phase: Phase,
  trumpSuit: Suit
): PlayedCard | null {
  const mightyCard = phase.cards.find((pc) => isMighty(pc.card))
  const heartQueenCard = phase.cards.find((pc) => isHeartQueen(pc.card))

  if (!mightyCard || !heartQueenCard) return null

  // 切り札Jや裏Jがある場合は無効
  const hasTrumpJack = phase.cards.some((pc) => isTrumpJack(pc.card, trumpSuit))
  const hasCounterJack = phase.cards.some((pc) =>
    isCounterJack(pc.card, trumpSuit)
  )

  if (hasTrumpJack || hasCounterJack) return null

  return heartQueenCard
}

/**
 * 狩りJルールの判定
 */
export function checkHuntingJackRule(
  phase: Phase,
  trumpSuit: Suit
): PlayedCard | null {
  const jacks = phase.cards.filter((pc) => pc.card.rank === 'J')
  if (jacks.length < 2) return null

  // 狩りJペアを探す
  for (let i = 0; i < jacks.length; i++) {
    for (let j = i + 1; j < jacks.length; j++) {
      const jack1 = jacks[i]
      const jack2 = jacks[j]

      if (isHuntingJackPair(jack1.card, jack2.card, trumpSuit)) {
        // 他に別スートの切り札や裏Jがある場合は無効
        const otherTrumpCards = phase.cards.filter(
          (pc) =>
            pc !== jack1 &&
            pc !== jack2 &&
            (isTrumpJack(pc.card, trumpSuit) ||
              isCounterJack(pc.card, trumpSuit))
        )

        if (otherTrumpCards.length > 0) return null

        // マイティーがある場合は無効
        const hasMighty = phase.cards.some((pc) => isMighty(pc.card))
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
  phase: Phase,
  trumpSuit: Suit,
  isFirstPhase: boolean = false
): PlayedCard | null {
  if (phase.cards.length === 0) return null

  const leadingSuit = phase.cards[0].card.suit

  // 1. 狩りJルール（最優先）
  const huntingJackWinner = checkHuntingJackRule(phase, trumpSuit)
  if (huntingJackWinner) return huntingJackWinner

  // 2. よろめきルール
  const yoromekiWinner = checkYoromekiRule(phase, trumpSuit)
  if (yoromekiWinner) return yoromekiWinner

  // 3. セイム2ルール（最初のフェーズ以外）
  // ただし、裏Jがある場合はセイム2より裏Jが優先
  if (!isFirstPhase) {
    // 裏Jがある場合は、セイム2のチェック前に裏Jを返す
    const counterJackCard = phase.cards.find((pc) =>
      isCounterJack(pc.card, trumpSuit)
    )
    if (counterJackCard) {
      return counterJackCard
    }

    // 裏Jがない場合のみセイム2をチェック
    const same2Conditions = checkSame2Conditions(phase, trumpSuit)
    if (same2Conditions.isValid) {
      return same2Conditions.twoCard
    }
  }

  // 4. 通常の強度比較
  let winner = phase.cards[0]
  let maxStrength = getCardStrength(winner.card, trumpSuit, leadingSuit)

  for (const playedCard of phase.cards) {
    const strength = getCardStrength(playedCard.card, trumpSuit, leadingSuit)
    if (strength > maxStrength) {
      maxStrength = strength
      winner = playedCard
    }
  }

  return winner
}
