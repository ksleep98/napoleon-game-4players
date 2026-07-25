import { GAME_PHASES } from '@/lib/constants'
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

/**
 * 副官の正体を全プレイヤーへ公開してよいか判定する
 *
 * - 副官指定カードが場に出た時点で公開（checkAdjutantRevealed）
 * - ゲーム終了後は結果画面で全役職を公開する。早期終了（isGameDecided）で
 *   副官指定カードが出ないまま終わる場合があり、勝敗・スコア表示にも必要
 *
 * ナポレオン本人にも事前公開しない。ナポレオンが指定するのは「カード」であって
 * プレイヤーではなく（setAdjutant / AdjutantSelector）、誰がそのカードを
 * 持っているかは副官指定カードが場に出るまで分からないため。
 */
export function isAdjutantIdentityPublic(gameState: GameState): boolean {
  return (
    gameState.phase === GAME_PHASES.FINISHED || checkAdjutantRevealed(gameState)
  )
}
