import type { Card, Rank, Suit } from '@/types/game'

export const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']

export const RANKS: Rank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
]

// ナポレオンゲームでのカードの強さ（数字が大きいほど強い）
export const CARD_VALUES: Record<Rank, number> = {
  A: 14, // エース（最強）
  K: 13,
  Q: 12,
  J: 11,
  '10': 10,
  '9': 9,
  '8': 8,
  '7': 7,
  '6': 6,
  '5': 5,
  '4': 4,
  '3': 3,
  '2': 2, // 最弱
}

// スートの優先順位（スペード > ハート > ダイヤ > クラブ）
export const SUIT_ORDER: Record<Suit, number> = {
  spades: 4,
  hearts: 3,
  diamonds: 2,
  clubs: 1,
}

export const GAME_CONFIG = {
  PLAYERS_COUNT: 4,
  CARDS_PER_PLAYER: 12, // 52枚（Joker除外）から4人に12枚ずつ配って残り4枚
  TOTAL_CARDS_USED: 52, // Jokerを除外した52枚使用
  HIDDEN_CARDS: 4,
  TARGET_TRICKS: 8, // ナポレオンが取る必要があるトリック数
} as const

export const NAPOLEON_RULES = {
  TARGET_TRICKS: 8,
  NAPOLEON_BONUS: 100,
  BASE_POINTS: 10,
  ADJUTANT_BONUS: 50,
} as const

// Jokerを除外した52枚のトランプカードデッキを生成（スペード・ハート・ダイヤ・クラブ各13枚）
export const createDeck = (): Card[] => {
  const deck: Card[] = []

  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push({
        id: `${suit}-${rank}`,
        suit,
        rank,
        value: CARD_VALUES[rank],
      })
    }
  }

  return deck
}

// 使用する48枚のカード（通常は2のカードを除く）
export const createGameDeck = (): Card[] => {
  return createDeck().filter((card) => card.rank !== '2')
}
