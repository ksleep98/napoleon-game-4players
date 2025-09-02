import { CARD_RANKS, SUITS } from '@/lib/constants'
import type {
  Card,
  GameState,
  NapoleonDeclaration,
  Rank,
  Suit,
} from '@/types/game'
import { getMinimumDeclaration } from '../napoleonRules'

// AI がナポレオンを宣言するかどうかの判定（改善版）
export function shouldDeclareNapoleon(
  hand: Card[],
  currentDeclaration?: NapoleonDeclaration
): { shouldDeclare: boolean; declaration?: NapoleonDeclaration } {
  // 手札の強さを評価
  const handStrength = evaluateHandStrength(hand)

  // 現在の宣言状況を確認
  const { minTricks, availableSuits } =
    getMinimumDeclaration(currentDeclaration)

  // 宣言可能な最小トリック数で勝てるかを判定
  for (let tricks = minTricks; tricks <= 20; tricks++) {
    for (const suit of availableSuits) {
      if (canWinWithDeclaration(hand, tricks, suit, handStrength)) {
        return {
          shouldDeclare: true,
          declaration: {
            playerId: '', // 呼び出し元で設定
            targetTricks: tricks,
            suit: suit as Suit,
          },
        }
      }
    }
  }

  return { shouldDeclare: false }
}

// 手札の強さを数値で評価
function evaluateHandStrength(hand: Card[]): number {
  let strength = 0

  // 各カードの基本点数
  for (const card of hand) {
    strength += card.value
  }

  // エースボーナス
  const aces = hand.filter((card) => card.rank === CARD_RANKS.ACE).length
  strength += aces * 5

  // キング・クイーンボーナス
  const kings = hand.filter((card) => card.rank === CARD_RANKS.KING).length
  const queens = hand.filter((card) => card.rank === CARD_RANKS.QUEEN).length
  strength += (kings + queens) * 2

  // 同じスートの枚数ボーナス（長いスートは有利）
  const suitCounts: Record<string, number> = {}
  for (const card of hand) {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1
  }

  for (const count of Object.values(suitCounts)) {
    if (count >= 4) {
      strength += (count - 3) * 3 // 長いスートにボーナス
    }
  }

  return strength
}

// 指定したトリック数とスートで勝てるかを判定
function canWinWithDeclaration(
  hand: Card[],
  targetTricks: number,
  suit: Suit,
  handStrength: number
): boolean {
  // 基本的な勝利判定
  const baseWinProbability = Math.min(handStrength / 180, 0.9) // 最大90%

  // トリック数による難易度調整
  const difficultyMultiplier = Math.max(0.3, 1 - (targetTricks - 13) * 0.1)

  // 該当スートのカード数
  const suitCards = hand.filter((card) => card.suit === suit).length
  const suitBonus = suitCards >= 3 ? 0.1 : 0

  const winProbability = baseWinProbability * difficultyMultiplier + suitBonus

  // 70%以上の勝率なら宣言
  return winProbability >= 0.7
}

// AI がナポレオンになった場合の副官カード選択
export function selectAdjutantCard(
  hand: Card[],
  trumpSuit?: Suit
): Card | null {
  const currentTrumpSuit = trumpSuit || 'spades'

  // 1. 最優先：マイティー（スペードA）- 自分が持っていない場合
  const mighty = {
    id: 'spades-A',
    suit: 'spades' as Suit,
    rank: 'A' as Rank,
    value: 14,
  }
  if (!hand.some((card) => card.id === mighty.id)) {
    return mighty
  }

  // 2. 第二優先：表J（切り札スートのJ）- 自分が持っていない場合
  const trumpJack = {
    id: `${currentTrumpSuit}-J`,
    suit: currentTrumpSuit,
    rank: 'J' as Rank,
    value: 11,
  }
  if (!hand.some((card) => card.id === trumpJack.id)) {
    return trumpJack
  }

  // 3. 第三優先：裏J（切り札と同色の反対スートのJ）- 自分が持っていない場合
  const counterJackSuit = getCounterJackSuit(currentTrumpSuit)
  if (counterJackSuit) {
    const counterJack = {
      id: `${counterJackSuit}-J`,
      suit: counterJackSuit,
      rank: 'J' as Rank,
      value: 11,
    }
    if (!hand.some((card) => card.id === counterJack.id)) {
      return counterJack
    }
  }

  // 4. フォールバック：従来のロジック（強いカードを順に選択）
  const preferredRanks: Array<{ rank: string; value: number }> = [
    { rank: CARD_RANKS.ACE, value: 14 },
    { rank: CARD_RANKS.KING, value: 13 },
    { rank: CARD_RANKS.QUEEN, value: 12 },
    { rank: CARD_RANKS.JACK, value: 11 },
  ]

  const suits = SUITS

  // 自分が持っていない強いカードを探す
  for (const preferredRank of preferredRanks) {
    for (const suit of suits) {
      const cardId = `${suit}-${preferredRank.rank}`
      if (!hand.some((card) => card.id === cardId)) {
        return {
          id: cardId,
          suit: suit as Suit,
          rank: preferredRank.rank as Rank,
          value: preferredRank.value,
        }
      }
    }
  }

  return null
}

/**
 * 切り札スートに対応する裏Jのスートを取得
 */
function getCounterJackSuit(trumpSuit: Suit): Suit | null {
  switch (trumpSuit) {
    case 'spades':
      return 'clubs' // 黒同士
    case 'clubs':
      return 'spades' // 黒同士
    case 'hearts':
      return 'diamonds' // 赤同士
    case 'diamonds':
      return 'hearts' // 赤同士
    default:
      return null
  }
}

// ナポレオン AI の戦略的思考（改善版）
export function napoleonAIStrategy(
  gameState: GameState,
  playerId: string
): {
  shouldDeclare: boolean
  declaration?: NapoleonDeclaration
  adjutantCard?: Card
} {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    return { shouldDeclare: false }
  }

  const result = shouldDeclareNapoleon(
    player.hand,
    gameState.napoleonDeclaration
  )

  if (result.shouldDeclare && result.declaration) {
    // プレイヤーIDを設定
    const declaration = {
      ...result.declaration,
      playerId,
    }

    // 副官カードを選択（切り札スートを渡す）
    const adjutantCard = selectAdjutantCard(player.hand, declaration.suit)
    if (adjutantCard) {
      declaration.adjutantCard = adjutantCard
    }

    return {
      shouldDeclare: true,
      declaration,
      adjutantCard: adjutantCard || undefined,
    }
  }

  return { shouldDeclare: false }
}
