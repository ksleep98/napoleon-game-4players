import { GAME_PHASES } from '@/lib/constants'
import type { GameState, Player } from '@/types/game'

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

/**
 * 一人ナポレオン（副官指定カードが埋め札にあり副官が成立しなかった）かどうか
 *
 * 閲覧者に対して公開してよいかは maskGameStateForPlayer が判断済みで、
 * 未公開の閲覧者には `soloNapoleon` が undefined で届く。
 * よって UI はこの関数の結果をそのまま表示判定に使ってよい。
 */
export function isSoloNapoleon(gameState: GameState): boolean {
  return gameState.soloNapoleon === true
}

/**
 * 表示上「副官」として扱うプレイヤーかどうか（表示層専用の導出）
 *
 * 一人ナポレオンでは副官が実在しないため `player.isAdjutant` は誰にも立たない。
 * これは意図的で、AI 戦略には isNapoleon より先に isAdjutant を判定する分岐
 * （strategicCardEvaluator / napoleonCooperation）があり、ナポレオンに
 * isAdjutant を立てると自分自身へ絵札をパスしようとして壊れるため
 * （setAdjutant のコメント参照）。
 * そこで「ナポレオン＝副官」であることは表示層でのみ導出する。
 *
 * 秘匿の扱い:
 * - 実在する副官は従来どおり、本人には常に、他プレイヤーには公開後に見せる
 * - 一人ナポレオンは公開後だけ。isCurrentUser では早出ししない。
 *   公開前にナポレオン以外がソロだと分かること自体が情報になるうえ、
 *   ナポレオン本人にとっても「まだ誰にもバレていない」状態を正しく映すため
 *
 * `isAdjutantRevealed` は呼び出し側が算出済みの値を渡す。
 * 呼び出し元によって checkAdjutantRevealed / isAdjutantIdentityPublic と
 * 基準が異なるため、ここで再計算すると既存の表示タイミングが変わってしまう。
 */
export function showsAdjutantBadge(params: {
  player: Pick<Player, 'isNapoleon' | 'isAdjutant'>
  soloNapoleon: boolean
  isAdjutantRevealed: boolean
  isCurrentUser?: boolean
}): boolean {
  const {
    player,
    soloNapoleon,
    isAdjutantRevealed,
    isCurrentUser = false,
  } = params

  if (player.isAdjutant) {
    return isCurrentUser || isAdjutantRevealed
  }

  return soloNapoleon && player.isNapoleon && isAdjutantRevealed
}
