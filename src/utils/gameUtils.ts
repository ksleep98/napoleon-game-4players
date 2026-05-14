import type { GameState } from '@/types/game'

/**
 * 副官が判明しているかチェック
 * 副官カードが場に出された場合、またはrevealsAdjutantフラグが立っている場合にtrue
 */
export function checkAdjutantRevealed(gameState: GameState): boolean {
  return (
    gameState.tricks.some((trick) =>
      trick.cards.some(
        (pc) =>
          gameState.napoleonCard && pc.card.id === gameState.napoleonCard.id
      )
    ) ||
    gameState.tricks.some((trick) =>
      trick.cards.some((pc) => pc.revealsAdjutant)
    ) ||
    gameState.currentTrick.cards.some((pc) => pc.revealsAdjutant)
  )
}
