export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const

// Suit enumeration for better readability
export enum SUIT_ENUM {
  SPADES = 'spades',
  HEARTS = 'hearts',
  DIAMONDS = 'diamonds',
  CLUBS = 'clubs',
}

export const RANKS = [
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
] as const

import type { Card, Rank, Suit } from '@/types/game'

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
// Card-specific constants
export const SUIT_SYMBOLS = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠',
} as const

// Suit name parts as constants
export const SUIT_NAME_PARTS = {
  clubs: 'クラブ',
  diamonds: 'ダイヤ',
  hearts: 'ハート',
  spades: 'スペード',
} as const

export const SUIT_NAMES = {
  clubs: `♣ ${SUIT_NAME_PARTS.clubs}`,
  diamonds: `♦ ${SUIT_NAME_PARTS.diamonds}`,
  hearts: `♥ ${SUIT_NAME_PARTS.hearts}`,
  spades: `♠ ${SUIT_NAME_PARTS.spades}`,
} as const

export const SUIT_COLORS = {
  hearts: 'text-red-600',
  diamonds: 'text-red-500',
  clubs: 'text-black',
  spades: 'text-black',
} as const

export const SUIT_DISPLAY_COLORS = {
  spades: 'text-gray-900 font-bold',
  hearts: 'text-red-700 font-bold',
  diamonds: 'text-red-500 font-bold',
  clubs: 'text-gray-600 font-bold',
} as const

export const SUIT_TEXT_COLORS = {
  clubs: 'text-gray-800',
  diamonds: 'text-red-500',
  hearts: 'text-red-500',
  spades: 'text-gray-800',
} as const

// Card rank constants
export const CARD_RANKS = {
  ACE: 'A',
  KING: 'K',
  QUEEN: 'Q',
  JACK: 'J',
  TEN: '10',
  NINE: '9',
  EIGHT: '8',
  SEVEN: '7',
  SIX: '6',
  FIVE: '5',
  FOUR: '4',
  THREE: '3',
  TWO: '2',
} as const

// Special cards
export const SPECIAL_CARDS = {
  MIGHTY_SUIT: SUIT_ENUM.SPADES,
  MIGHTY_RANK: CARD_RANKS.ACE,
  HEART_QUEEN_SUIT: SUIT_ENUM.HEARTS,
  HEART_QUEEN_RANK: CARD_RANKS.QUEEN,
  SAME_TWO_RANK: CARD_RANKS.TWO,
  JACK_RANK: CARD_RANKS.JACK,
} as const

// Game strength values
export const CARD_STRENGTH = {
  MIGHTY: 1000,
  TRUMP_JACK: 900,
  COUNTER_JACK: 800,
  TRUMP_BASE: 700,
  LEADING_BASE: 600,
  OTHER_BASE: 0,
} as const

// Napoleon strength values
export const NAPOLEON_BID_STRENGTH = {
  [SUIT_ENUM.SPADES]: 4,
  [SUIT_ENUM.HEARTS]: 3,
  [SUIT_ENUM.DIAMONDS]: 2,
  [SUIT_ENUM.CLUBS]: 1,
} as const

// Counter suit mapping
export const COUNTER_SUITS = {
  [SUIT_ENUM.SPADES]: SUIT_ENUM.CLUBS,
  [SUIT_ENUM.CLUBS]: SUIT_ENUM.SPADES,
  [SUIT_ENUM.HEARTS]: SUIT_ENUM.DIAMONDS,
  [SUIT_ENUM.DIAMONDS]: SUIT_ENUM.HEARTS,
} as const
// Game phases
export const GAME_PHASES = {
  SETUP: 'setup',
  DEALING: 'dealing',
  NAPOLEON: 'napoleon',
  ADJUTANT: 'adjutant',
  EXCHANGE: 'card_exchange',
  PLAYING: 'playing',
  FINISHED: 'finished',
} as const

// Player roles
export const PLAYER_ROLES = {
  NAPOLEON: 'Napoleon',
  ADJUTANT: 'Adjutant',
  CITIZEN: 'Citizen',
} as const

export const GAME_CONFIG = {
  PLAYERS_COUNT: 4,
  CARDS_PER_PLAYER: 12, // 52枚（Joker除外）から4人に12枚ずつ配って残り4枚
  TOTAL_CARDS_USED: 52, // Jokerを除外した52枚使用
  HIDDEN_CARDS: 4,
  TARGET_FACE_CARDS: 13, // ナポレオンが取る必要がある絵札数
} as const

export const NAPOLEON_RULES = {
  TARGET_FACE_CARDS: 13, // 絵札（10〜A）の最低獲得枚数
  NAPOLEON_BONUS: 100,
  BASE_POINTS: 10,
  ADJUTANT_BONUS: 50,
} as const

// Winner team constants
export const WINNER_TEAMS = {
  NAPOLEON: 'napoleon',
  CITIZEN: 'citizen',
} as const

// Game room status constants
export const GAME_ROOM_STATUS = {
  WAITING: 'waiting',
  PLAYING: 'playing',
  FINISHED: 'finished',
} as const

// Connection state constants
export const CONNECTION_STATES = {
  CONNECTING: 'CONNECTING',
  OPEN: 'OPEN',
  CLOSED: 'CLOSED',
  CHANNEL_ERROR: 'CHANNEL_ERROR',
  TIMED_OUT: 'TIMED_OUT',
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
  return createDeck().filter((card) => card.rank !== CARD_RANKS.TWO)
}

// 絵札（10、J、Q、K、A）かどうかを判定
export const isFaceCard = (card: Card): boolean => {
  const faceCards: Rank[] = [
    CARD_RANKS.TEN,
    CARD_RANKS.JACK,
    CARD_RANKS.QUEEN,
    CARD_RANKS.KING,
    CARD_RANKS.ACE,
  ]
  return faceCards.includes(card.rank)
}

// カード配列から絵札の数を数える
export const countFaceCards = (cards: Card[]): number => {
  return cards.filter(isFaceCard).length
}

// Action Types for State Management
export const ACTION_TYPES = {
  // Game Context Actions
  GAME: {
    SET_LOADING: 'SET_LOADING',
    SET_ERROR: 'SET_ERROR',
    SET_GAME_STATE: 'SET_GAME_STATE',
    SET_INITIALIZED: 'SET_INITIALIZED',
    RESET_ERROR: 'RESET_ERROR',
    RESET_STATE: 'RESET_STATE',
  },
  // Napoleon Selector Actions
  NAPOLEON_SELECTOR: {
    SET_SELECTED_CARD: 'SET_SELECTED_CARD',
    SET_SELECTED_TRICKS: 'SET_SELECTED_TRICKS',
    SET_SELECTED_SUIT: 'SET_SELECTED_SUIT',
    RESET_TO_MIN_DECLARATION: 'RESET_TO_MIN_DECLARATION',
  },
  // Adjutant Selector Actions
  ADJUTANT_SELECTOR: {
    SET_SELECTED_CARD: 'SET_SELECTED_CARD',
    SET_VIEW_MODE: 'SET_VIEW_MODE',
  },
  // Player Session Actions
  PLAYER_SESSION: {
    INITIALIZE_PLAYER: 'INITIALIZE_PLAYER',
    SET_SESSION_FROM_SECURE: 'SET_SESSION_FROM_SECURE',
    CLEAR_PLAYER: 'CLEAR_PLAYER',
  },
} as const
