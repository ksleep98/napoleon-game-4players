import type { Card, GameState } from '@/types/game'

// 副官 AI が協力するかどうかの判定
export function shouldCooperateAsAdjutant(
  gameState: GameState,
  playerId: string,
  napoleonCard: Card
): boolean {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) return false

  // 副官カードを持っているかチェック
  const hasAdjutantCard = player.hand.some(
    (card) => card.suit === napoleonCard.suit && card.rank === napoleonCard.rank
  )

  if (!hasAdjutantCard) return false

  // 手札の強さを評価
  const strongCards = player.hand.filter((card) => card.value >= 10)
  const totalHandStrength = player.hand.reduce(
    (sum, card) => sum + card.value,
    0
  )

  // 強いカードが3枚以上、または手札の総合力が高い場合は協力
  return strongCards.length >= 3 || totalHandStrength >= 90
}

// 副官 AI の戦略的判断
export function adjutantAIStrategy(
  gameState: GameState,
  playerId: string,
  napoleonCard: Card
): {
  shouldCooperate: boolean
  reasoning: string
} {
  const shouldCooperate = shouldCooperateAsAdjutant(
    gameState,
    playerId,
    napoleonCard
  )

  const reasoning = shouldCooperate
    ? 'Hand strength suggests cooperation with Napoleon'
    : 'Hand too weak to effectively support Napoleon'

  return {
    shouldCooperate,
    reasoning,
  }
}
