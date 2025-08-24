import { createDeck, GAME_CONFIG } from '@/lib/constants'
import type { Card, Player } from '@/types/game'

/**
 * Fisher-Yatesアルゴリズムを使ってカードをシャッフル
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck]

  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

/**
 * 48枚のカードを4人のプレイヤーに12枚ずつ配る
 * 残りの4枚は隠しカードとして返す
 */
export function dealCards(players: Player[]): {
  players: Player[]
  hiddenCards: Card[]
} {
  if (players.length !== GAME_CONFIG.PLAYERS_COUNT) {
    throw new Error(
      `Expected ${GAME_CONFIG.PLAYERS_COUNT} players, got ${players.length}`
    )
  }

  const deck = createDeck() // 全52枚を使用
  const shuffledDeck = shuffleDeck(deck)

  // 52枚から4枚を隠しカードとして取り除く
  const hiddenCards = shuffledDeck.slice(0, GAME_CONFIG.HIDDEN_CARDS)
  const playingCards = shuffledDeck.slice(GAME_CONFIG.HIDDEN_CARDS)

  const updatedPlayers = players.map((player, index) => ({
    ...player,
    hand: playingCards.slice(
      index * GAME_CONFIG.CARDS_PER_PLAYER,
      (index + 1) * GAME_CONFIG.CARDS_PER_PLAYER
    ),
  }))

  return {
    players: updatedPlayers,
    hiddenCards,
  }
}

/**
 * プレイヤーの手札をソート（スート順、強さ順）
 */
export function sortHand(hand: Card[]): Card[] {
  return [...hand].sort((a, b) => {
    // まずスートで並び替え
    if (a.suit !== b.suit) {
      return b.suit.localeCompare(a.suit) // アルファベット逆順でスペード > ハート > ダイヤ > クラブ
    }
    // 同じスート内では強さで並び替え
    return b.value - a.value
  })
}

/**
 * 手札から指定されたカードを削除
 */
export function removeCardFromHand(hand: Card[], cardId: string): Card[] {
  return hand.filter((card) => card.id !== cardId)
}

/**
 * 指定されたカードが手札にあるかチェック
 */
export function hasCard(hand: Card[], cardId: string): boolean {
  return hand.some((card) => card.id === cardId)
}

/**
 * 手札の中で指定されたスートのカードを取得
 */
export function getCardsBySuit(hand: Card[], suit: string): Card[] {
  return hand.filter((card) => card.suit === suit)
}

/**
 * プレイヤーがそのスートのカードを持っているかチェック（フォロー義務用）
 */
export function canFollowSuit(hand: Card[], leadingSuit: string): boolean {
  return getCardsBySuit(hand, leadingSuit).length > 0
}

/**
 * カードの表示用文字列を生成
 */
export function getCardDisplay(card: Card): string {
  const suitSymbols = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  }

  return `${suitSymbols[card.suit]}${card.rank}`
}

/**
 * ランダムなプレイヤーIDを生成
 */
export function generatePlayerId(): string {
  return `player_${Math.random().toString(36).substring(2, 11)}`
}

/**
 * ランダムなゲームIDを生成
 */
export function generateGameId(): string {
  return `game_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}
