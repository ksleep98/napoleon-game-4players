import type { GameState } from '@/types/game'
import { adjutantAIStrategy } from './adjutant'
import { allianceAIStrategy } from './alliance'
import { napoleonAIStrategy } from './napoleon'

// ナポレオン決定フェーズの AI 処理
export async function processNapoleonPhase(
  gameState: GameState
): Promise<GameState> {
  const updatedGameState = { ...gameState }

  // 各 AI プレイヤーがナポレオンを宣言するかチェック
  for (let i = 0; i < updatedGameState.players.length; i++) {
    const player = updatedGameState.players[i]

    if (player.isAI && !updatedGameState.players.some((p) => p.isNapoleon)) {
      const strategy = napoleonAIStrategy(updatedGameState, player.id)

      if (strategy.shouldDeclare) {
        // ナポレオンを宣言
        updatedGameState.players[i].isNapoleon = true

        if (strategy.adjutantCard) {
          updatedGameState.napoleonCard = strategy.adjutantCard
        }

        console.log(`AI Player ${player.name} declares Napoleon!`)
        break
      }
    }
  }

  // ナポレオンが決まったら次のフェーズへ
  if (updatedGameState.players.some((p) => p.isNapoleon)) {
    updatedGameState.phase = 'adjutant'
  }

  return updatedGameState
}

// 副官決定フェーズの AI 処理
export async function processAdjutantPhase(
  gameState: GameState
): Promise<GameState> {
  const updatedGameState = { ...gameState }

  if (!updatedGameState.napoleonCard) {
    return updatedGameState
  }

  // 副官カードを持つプレイヤーを探す
  for (let i = 0; i < updatedGameState.players.length; i++) {
    const player = updatedGameState.players[i]

    // ナポレオンカードを持っているプレイヤーが副官
    const hasNapoleonCard = player.hand.some(
      (card) =>
        card.suit === updatedGameState.napoleonCard?.suit &&
        card.rank === updatedGameState.napoleonCard?.rank
    )

    if (hasNapoleonCard) {
      updatedGameState.players[i].isAdjutant = true

      if (player.isAI) {
        const strategy = adjutantAIStrategy(
          updatedGameState,
          player.id,
          updatedGameState.napoleonCard
        )
        console.log(
          `AI Player ${player.name} becomes adjutant: ${strategy.reasoning}`
        )
      }

      break
    }
  }

  // 副官が決まったら連合軍フェーズへ
  if (updatedGameState.players.some((p) => p.isAdjutant)) {
    updatedGameState.phase = 'playing' // または 'alliance' フェーズを追加する場合
  }

  return updatedGameState
}

// 連合軍決定フェーズの AI 処理
export async function processAlliancePhase(
  gameState: GameState
): Promise<GameState> {
  const updatedGameState = { ...gameState }

  // 各 AI プレイヤー（ナポレオンチーム以外）の戦略を決定
  for (let i = 0; i < updatedGameState.players.length; i++) {
    const player = updatedGameState.players[i]

    if (player.isAI && !player.isNapoleon && !player.isAdjutant) {
      const strategy = allianceAIStrategy(updatedGameState, player.id)
      console.log(`AI Player ${player.name}: ${strategy.reasoning}`)
    }
  }

  // 連合軍戦略が決まったらゲーム開始
  updatedGameState.phase = 'playing'

  return updatedGameState
}

// すべての AI フェーズを統合処理
export async function processAllAIPhases(
  gameState: GameState
): Promise<GameState> {
  let updatedState = gameState

  if (gameState.phase === 'napoleon') {
    updatedState = await processNapoleonPhase(updatedState)
  }

  if (updatedState.phase === 'adjutant') {
    updatedState = await processAdjutantPhase(updatedState)
  }

  if (updatedState.phase === 'playing') {
    updatedState = await processAlliancePhase(updatedState)
  }

  return updatedState
}
