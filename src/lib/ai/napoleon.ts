import type { Card, GameState, Rank, Suit } from '@/types/game'

// AI がナポレオンを宣言するかどうかの判定
export function shouldDeclareNapoleon(hand: Card[]): boolean {
  // 基本的な判定ロジック
  const strongCards = hand.filter((card) => card.value >= 10) // 10以上のカード
  const aces = hand.filter((card) => card.rank === 'A')
  const kings = hand.filter((card) => card.rank === 'K')
  const _queens = hand.filter((card) => card.rank === 'Q')

  // 強いカードが5枚以上、またはエースが2枚以上あればナポレオンを宣言
  return (
    strongCards.length >= 5 ||
    aces.length >= 2 ||
    (aces.length >= 1 && kings.length >= 2)
  )
}

// AI がナポレオンになった場合の副官カード選択
export function selectAdjutantCard(hand: Card[]): Card | null {
  // 自分の手札にない強いカードを副官として選ぶ
  const _handsuits = new Set(hand.map((card) => card.suit))
  const _handRanks = new Set(hand.map((card) => card.rank))

  // エース優先
  const preferredRanks: Array<{ rank: string; value: number }> = [
    { rank: 'A', value: 14 },
    { rank: 'K', value: 13 },
    { rank: 'Q', value: 12 },
    { rank: 'J', value: 11 },
  ]

  const suits = ['spades', 'hearts', 'diamonds', 'clubs']

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

// ナポレオン AI の戦略的思考
export function napoleonAIStrategy(
  gameState: GameState,
  playerId: string
): {
  shouldDeclare: boolean
  adjutantCard?: Card
} {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    return { shouldDeclare: false }
  }

  const shouldDeclare = shouldDeclareNapoleon(player.hand)
  const adjutantCard = shouldDeclare
    ? selectAdjutantCard(player.hand) || undefined
    : undefined

  return {
    shouldDeclare,
    adjutantCard,
  }
}
