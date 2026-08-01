/**
 * ゲーム状態のマスキング（F-3 対策）
 *
 * サーバーは全プレイヤーの手札を保持するが、クライアントへ返す際は
 * 閲覧者本人以外の手札と伏せ札をダミーカードへ置き換える。
 * 枚数は保持するため、`hand.length` に依存する UI（OpponentHand /
 * GameBoard / scoring の cardsInHand）はそのまま動作する。
 *
 * さらに副官の正体（`isAdjutant`）も、副官指定カードが場に出るまでは
 * 閲覧者本人以外について false へ落とす。UI 側でガードしても
 * レスポンスに残っていれば DevTools から丸見えになるため。
 *
 * 一人ナポレオン（`soloNapoleon`）も同じ理由で伏せる。ナポレオン本人だけは
 * 指定カードが自分の手札に入るため常に知っている。
 *
 * AI の思考はサーバーサイド（processAITurn / processAIPlayingPhase）で行われ、
 * DB から読み直した未マスクの状態を使う。ただし副官の正体だけは AI にも
 * 見せてはいけない（人間より多くを知って打つのはフェアネス違反）ため、
 * processAITurn が maskAdjutantIdentityForPlayer で手番 AI 視点のビューを作る。
 */

import { MASKED_CARD } from '@/lib/constants'
import type { Card, GameState } from '@/types/game'
import { isAdjutantIdentityPublic } from '@/utils/gameUtils'

function createMaskedCard(ownerKey: string, index: number): Card {
  return {
    id: `${MASKED_CARD.ID_PREFIX}${ownerKey}_${index}`,
    suit: MASKED_CARD.SUIT,
    rank: MASKED_CARD.RANK,
    value: MASKED_CARD.VALUE,
  }
}

function maskCards(cards: Card[], ownerKey: string): Card[] {
  return cards.map((_, index) => createMaskedCard(ownerKey, index))
}

/**
 * 副官の正体（`isAdjutant` / `soloNapoleon`）だけをマスクしたゲーム状態を返す
 *
 * 手札・伏せ札はそのまま残す。サーバーサイド AI の思考へ渡すビューを作るための
 * 関数で、AI は自分の手札はもちろん、シミュレーション（determinization）でも
 * `players[].hand` の実体を参照するため、ここで手札まで潰すと着手を選べなくなる。
 *
 * @param gameState 未マスクのゲーム状態
 * @param viewerPlayerId 閲覧者（人間プレイヤー、または手番の AI）のID
 */
export function maskAdjutantIdentityForPlayer(
  gameState: GameState,
  viewerPlayerId: string
): GameState {
  const adjutantIsPublic = isAdjutantIdentityPublic(gameState)

  // 一人ナポレオン（副官指定カードが埋め札にあった）かどうかも秘匿情報。
  // ナポレオン本人は指定カードが自分の手札に来るので必ず知っているが、
  // 連合軍には副官の正体が公開されるのと同じタイミングまで伏せる。
  //
  // 未公開時は undefined へ落とす。漏洩の観点では定数 false でも等価に安全で、
  // （通常ゲームでもソロゲームでも同じ値になるため区別はできない）
  // 漏れるのは生値をそのまま通した場合だけである。
  // undefined を選ぶのは型上の意味づけのため:
  // 「未公開（不明）」と「ソロではないと確定」を区別できるようにしておく。
  // ⚠️ したがって `soloNapoleon === false` を「ソロではないことが確定」の意味で
  // 使ってはいけない。未公開の閲覧者では false ではなく undefined になる。
  // 判定は必ず isSoloNapoleon()（=== true）を使うこと。
  const viewerIsNapoleon = gameState.players.some(
    (player) => player.id === viewerPlayerId && player.isNapoleon
  )
  const soloNapoleonIsVisible = adjutantIsPublic || viewerIsNapoleon

  return {
    ...gameState,
    soloNapoleon: soloNapoleonIsVisible ? gameState.soloNapoleon : undefined,
    players: gameState.players.map((player) =>
      player.id === viewerPlayerId
        ? player
        : {
            ...player,
            // 副官本人以外には、公開されるまで副官フラグを渡さない
            isAdjutant: adjutantIsPublic ? player.isAdjutant : false,
          }
    ),
  }
}

/**
 * 閲覧者以外の手札・伏せ札・副官の正体をマスクしたゲーム状態を返す
 * @param gameState 未マスクのゲーム状態
 * @param viewerPlayerId 閲覧者（認証済みプレイヤー）のID
 */
export function maskGameStateForPlayer(
  gameState: GameState,
  viewerPlayerId: string
): GameState {
  // 副官の秘匿ルールは maskAdjutantIdentityForPlayer に一本化する
  const identityMasked = maskAdjutantIdentityForPlayer(
    gameState,
    viewerPlayerId
  )

  return {
    ...identityMasked,
    players: identityMasked.players.map((player) =>
      player.id === viewerPlayerId
        ? player
        : {
            ...player,
            hand: maskCards(player.hand, player.id),
          }
    ),
    hiddenCards: maskCards(
      gameState.hiddenCards,
      MASKED_CARD.HIDDEN_PILE_OWNER
    ),
    // ナポレオンが交換で捨てた札もクライアントには公開しない
    exchangedCards: gameState.exchangedCards
      ? maskCards(gameState.exchangedCards, MASKED_CARD.HIDDEN_PILE_OWNER)
      : undefined,
  }
}

/**
 * マスクした副官情報を、未マスクの状態から復元する
 *
 * サーバーサイド AI は「マスク済みビューを入力に取り、そこから次の状態を作って返す」
 * ため（processAIPlayingPhase → playCard）、戻り値をそのまま DB に保存すると
 * 副官フラグが永久に失われる。AI が触らない秘匿フィールドだけを真の値へ戻す。
 *
 * プレイングフェーズ中は `isAdjutant` / `soloNapoleon` は変化しない
 * （設定されるのは ADJUTANT フェーズの setAdjutant のみ）ため、この復元で
 * AI の着手結果を取りこぼすことはない。
 *
 * @param maskedResult マスク済みビューを入力に AI が返した状態
 * @param sourceOfTruth マスク前のゲーム状態
 */
export function restoreAdjutantIdentity(
  maskedResult: GameState,
  sourceOfTruth: GameState
): GameState {
  return {
    ...maskedResult,
    soloNapoleon: sourceOfTruth.soloNapoleon,
    players: maskedResult.players.map((player) => {
      const truth = sourceOfTruth.players.find((p) => p.id === player.id)
      return truth === undefined
        ? player
        : { ...player, isAdjutant: truth.isAdjutant }
    }),
  }
}
