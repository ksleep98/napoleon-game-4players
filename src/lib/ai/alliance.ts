import type { GameState } from '@/types/game'

// 連合軍 AI の戦略的判断
export function allianceAIStrategy(
  gameState: GameState,
  playerId: string
): {
  targetNapoleon: boolean
  reasoning: string
} {
  const player = gameState.players.find((p) => p.id === playerId)
  if (!player) {
    return {
      targetNapoleon: true,
      reasoning: 'Player not found, default to targeting Napoleon',
    }
  }

  // ナポレオンチーム（ナポレオン + 副官）を特定
  const napoleonPlayer = gameState.players.find((p) => p.isNapoleon)
  const _adjutantPlayer = gameState.players.find((p) => p.isAdjutant)

  if (!napoleonPlayer) {
    return {
      targetNapoleon: true,
      reasoning: 'Napoleon not identified, default strategy',
    }
  }

  // 自分の手札の強さを評価
  const strongCards = player.hand.filter((card) => card.value >= 10)
  const _totalHandStrength = player.hand.reduce(
    (sum, card) => sum + card.value,
    0
  )

  // 連合軍として戦う基本戦略
  const shouldTargetNapoleon = true // 基本的には常にナポレオンを阻止する

  let reasoning = 'Alliance strategy: Block Napoleon team'

  if (strongCards.length >= 4) {
    reasoning += ' with strong hand'
  } else if (strongCards.length <= 1) {
    reasoning += ' with defensive play'
  } else {
    reasoning += ' with balanced approach'
  }

  return {
    targetNapoleon: shouldTargetNapoleon,
    reasoning,
  }
}

// 連合軍 AI が協力すべき相手を判定
export function identifyAlliancePartners(
  gameState: GameState,
  playerId: string
): string[] {
  const allPlayers = gameState.players
  const _napoleonPlayer = allPlayers.find((p) => p.isNapoleon)
  const _adjutantPlayer = allPlayers.find((p) => p.isAdjutant)

  // ナポレオンチーム以外のプレイヤーが連合軍のパートナー
  const partners = allPlayers
    .filter((p) => p.id !== playerId) // 自分以外
    .filter((p) => !p.isNapoleon && !p.isAdjutant) // ナポレオンチーム以外
    .map((p) => p.id)

  return partners
}
