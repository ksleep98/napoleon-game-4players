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
 * 裏スート関係にあるJ同士（片方が切り札J）
 * - スペードJ（切り札）とクラブJ（裏J）
 * - クラブJ（切り札）とスペードJ（裏J）
 * - ハートJ（切り札）とダイヤJ（裏J）
 * - ダイヤJ（切り札）とハートJ（裏J）
 */
/**
 * 対応する狩りJペアかどうかを判定
 *
 * 狩りJのルール：
 * - 表J（切り札J）とその狩J（表Jの裏スートのJ）
 * - 裏J（裏スートJ）とその狩J（裏Jの裏スートのJ）
 *
 * 例：クラブが切り札の場合
 * - 表J: ♣J、その狩J: ♦J（♣Jの裏スート）
 * - 裏J: ♠J、その狩J: ♥J（♠Jの裏スート）
 *
 * COUNTER_SUITS定義：
 * - spades ↔ clubs
 * - hearts ↔ diamonds
 */
/**
 * 裏Jの狩Jを取得（対角線パターン）
 * - ♠が切り札 → 裏J♣ → 狩J♦
 * - ♣が切り札 → 裏J♠ → 狩J♥
 * - ♥が切り札 → 裏J♦ → 狩J♣
 * - ♦が切り札 → 裏J♥ → 狩J♠
 */
function getCounterJackHuntingJack(trumpSuit: Suit): Suit {
  const DIAGONAL_MAP: Record<Suit, Suit> = {
    spades: 'diamonds',
    diamonds: 'spades',
    clubs: 'hearts',
    hearts: 'clubs',
  }
  return DIAGONAL_MAP[trumpSuit]
}

/**
 * 対応する狩りJペアかどうかを判定
 *
 * 狩りJのルール：
 * スートペア1: spades ↔ clubs
 * スートペア2: hearts ↔ diamonds
 *
 * - 表J（切り札J）とその狩J（別ペアのスートで、表Jでも裏JでもないJ）
 * - 裏J（裏スートJ）とその狩J（対角線上の特定のスートのJ）
 *
 * 例：スペードが切り札の場合
 * - 表J: ♠J（ペア1）、その狩J: ♦J or ♥J（ペア2）
 * - 裏J: ♣J（ペア1）、その狩J: ♦J（対角線）のみ
 *
 * 例：クラブが切り札の場合
 * - 表J: ♣J（ペア1）、その狩J: ♦J or ♥J（ペア2）
 * - 裏J: ♠J（ペア1）、その狩J: ♥J（対角線）のみ
 */
export function isHuntingJackPair(
  card1: Card,
  card2: Card,
  trumpSuit: Suit
): boolean {
  // 両方Jでない場合はfalse
  if (card1.rank !== CARD_RANKS.JACK || card2.rank !== CARD_RANKS.JACK) {
    return false
  }

  // スートペアを判定する関数
  // ペア1: spades/clubs, ペア2: hearts/diamonds
  const getPairGroup = (suit: Suit): 1 | 2 => {
    return suit === 'spades' || suit === 'clubs' ? 1 : 2
  }

  const card1Pair = getPairGroup(card1.suit)
  const card2Pair = getPairGroup(card2.suit)

  // 別ペアでない場合はfalse
  if (card1Pair === card2Pair) {
    return false
  }

  // 表J（切り札J）とその狩Jのペア
  if (isTrumpJack(card1, trumpSuit)) {
    // card2が表Jでも裏Jでもないことを確認
    return !isTrumpJack(card2, trumpSuit) && !isCounterJack(card2, trumpSuit)
  }

  if (isTrumpJack(card2, trumpSuit)) {
    return !isTrumpJack(card1, trumpSuit) && !isCounterJack(card1, trumpSuit)
  }

  // 裏J（裏スートJ）とその狩Jのペア（対角線上の特定のスートのみ）
  const counterJackHuntingJack = getCounterJackHuntingJack(trumpSuit)

  if (isCounterJack(card1, trumpSuit)) {
    // card2が対角線上の特定のスートのJであることを確認
    return card2.suit === counterJackHuntingJack
  }

  if (isCounterJack(card2, trumpSuit)) {
    // card1が対角線上の特定のスートのJであることを確認
    return card1.suit === counterJackHuntingJack
  }

  return false
}

/**
 * カードの基本強度を取得（特殊ルール考慮前）
 */
export function getCardStrength(
  card: Card,
  trumpSuit: Suit,
  leadingSuit: Suit,
  isFirstTrick: boolean = false
): number {
  // マイティーは常に最強（1トリック目でも有効）
  if (isMighty(card)) {
    return CARD_STRENGTH.MIGHTY
  }

  // 切り札ジャックは常に強い（1トリック目でも有効）
  if (isTrumpJack(card, trumpSuit)) {
    return CARD_STRENGTH.TRUMP_JACK
  }

  // 裏ジャックは常に強い（1トリック目でも有効）
  if (isCounterJack(card, trumpSuit)) {
    return CARD_STRENGTH.COUNTER_JACK
  }

  // 最初のトリックではその他の切り札判定を無効化
  if (isFirstTrick) {
    // リードスートのカード
    if (card.suit === leadingSuit) {
      const value = card.rank === CARD_RANKS.JACK ? 1 : card.value
      return CARD_STRENGTH.LEADING_BASE + value
    }

    // その他のスート（トリックを取れない）
    return CARD_STRENGTH.OTHER_BASE + card.value
  }

  // 通常のトリック（2トリック目以降）：全ての切り札判定が有効
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

  // よろめき状況（マイティとハートのクイーンがある）の場合
  // 表J（切り札J）が最優先、次に裏J（counter jack）、それがなければハートのクイーン
  const trumpJackCard = trick.cards.find((pc) =>
    isTrumpJack(pc.card, trumpSuit)
  )
  if (trumpJackCard) return trumpJackCard

  const counterJackCard = trick.cards.find((pc) =>
    isCounterJack(pc.card, trumpSuit)
  )
  if (counterJackCard) return counterJackCard

  // 表J・裏Jがない場合は、ハートのクイーンが勝つ（よろめき成功）
  return heartQueenCard
}

/**
 * 狩りJルールの判定
 */
/**
 * 狩りJルールの判定
 *
 * 狩りJルール：
 * - 表J or 裏J と 狩J（別ペアの普通のJ）が同じトリックにある場合
 * - 狩J（最弱のJ）が勝利する
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

        // 狩Jを返す（表Jでも裏Jでもない方）
        const isJack1TrumpOrCounter =
          isTrumpJack(jack1.card, trumpSuit) ||
          isCounterJack(jack1.card, trumpSuit)

        return isJack1TrumpOrCounter ? jack2 : jack1
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

  // 1. よろめきと狩りJルールの特別な判定（1トリック目でも有効）
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

  // 2. 狩りJルール（よろめきがない、または無効な場合）（1トリック目でも有効）
  const huntingJackWinner = checkHuntingJackRule(trick, trumpSuit)
  if (huntingJackWinner) return huntingJackWinner

  // 3. セイム2ルール（最初のトリックでは無効）
  if (!isFirstTrick) {
    const same2Winner = checkSame2Rule(trick, trumpSuit)
    if (same2Winner) {
      return same2Winner
    }
  }

  // 4. 通常の強度比較
  let winner = trick.cards[0]
  let maxStrength = getCardStrength(
    winner.card,
    trumpSuit,
    leadingSuit,
    isFirstTrick
  )

  for (const playedCard of trick.cards) {
    const strength = getCardStrength(
      playedCard.card,
      trumpSuit,
      leadingSuit,
      isFirstTrick
    )
    if (strength > maxStrength) {
      maxStrength = strength
      winner = playedCard
    }
  }

  return winner
}
