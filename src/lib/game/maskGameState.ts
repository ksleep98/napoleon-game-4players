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
 * さらに競り（`GAME_PHASES.NAPOLEON`）の最中は、副官「指定カード」そのもの
 * （`napoleonDeclaration.adjutantCard` / `napoleonCard`）も宣言者以外へ渡さない。
 * 詳細は maskBiddingDeclarationForPlayer のコメントを参照。
 *
 * AI の思考はサーバーサイド（processAITurn / processAIPlayingPhase）で行われ、
 * DB から読み直した未マスクの状態を使う。ただし副官の正体だけは AI にも
 * 見せてはいけない（人間より多くを知って打つのはフェアネス違反）ため、
 * processAITurn が maskAdjutantIdentityForPlayer で手番 AI 視点のビューを作る。
 */

import { GAME_PHASES, MASKED_CARD } from '@/lib/constants'
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
 * 競り（ナポレオン宣言フェーズ）中の「呼ぶ札」を宣言者以外から伏せる
 *
 * AI は宣言と同時に副官指定カードを決める（ai/napoleon.ts の
 * `selectAdjutantCard` → `declaration.adjutantCard`）のに対し、人間は宣言後の
 * AdjutantSelector で選ぶ（NapoleonSelector に指定カードの入力は無い）。
 * この非対称のせいで、AI が宣言した瞬間に呼ぶ札が
 * `napoleonDeclaration.adjutantCard` と `napoleonCard`（declareNapoleon が
 * 互換用に複製する）へ載り、まだ上乗せできる人間へそのまま届いていた。
 * 「♠A が呼ばれている＝自分が副官になれる／なれない」と分かった状態で
 * 競りを続けられるのは明確なアドバンテージになる。
 *
 * 隠すのは競りの最中だけでよい。ルール上、呼ぶ札は宣言が確定したあとは
 * 全員への公開情報（docs/game-logic/NAPOLEON_RULES.md の副官選択フェーズ）で、
 * 実際 ADJUTANT フェーズ以降は GameStatus / TopHUD が常時表示している。
 * よって `GAME_PHASES.NAPOLEON` の間だけ落とせば足りる。
 *
 * ⚠️ この関数はクライアントへ返す直前（maskGameStateForPlayer）専用。
 * サーバー側の権威ある処理（setAdjutant / findAdjutant / isAdjutantCardBuried、
 * および AI の processAdjutantPhase）は DB から読んだ未マスクの状態を使うこと。
 * マスク済み state を権威ある処理へ流すと、AI ナポレオンの
 * `napoleonDeclaration.adjutantCard` が消えて副官が成立しなくなる。
 */
function maskBiddingDeclarationForPlayer(
  gameState: GameState,
  viewerPlayerId: string
): GameState {
  if (gameState.phase !== GAME_PHASES.NAPOLEON) {
    return gameState
  }

  // 宣言した本人（AI 含む）は自分が指定した札を当然知っている
  const declaration = gameState.napoleonDeclaration
  if (declaration && declaration.playerId === viewerPlayerId) {
    return gameState
  }

  return {
    ...gameState,
    napoleonDeclaration: declaration
      ? { ...declaration, adjutantCard: undefined }
      : declaration,
    napoleonCard: undefined,
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
  const identityMasked = maskBiddingDeclarationForPlayer(
    maskAdjutantIdentityForPlayer(gameState, viewerPlayerId),
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

/*
 * かつてここには `restoreAdjutantIdentity`（マスク済みビューから AI が作った
 * 次状態に、真の副官情報を戻す関数）があった。削除済み。
 *
 * その復元は「マスク済みビューでゲームを 1 手進める」ことを前提にしていたが、
 * その前提自体が不具合の原因だった。playCard → completeTrick →
 * scoring.isGameDecided は players[].isAdjutant でチームを分けるため、
 * マスク済みビューで進めると副官の取ったトリックが連合軍側に計上され、
 * 「連合軍が上限超過」で勝敗が誤って早期確定する。役職を後から戻しても
 * 確定してしまった phase は戻せない。
 *
 * 現在は gameLogic.processAITurn が「思考だけマスク済みビュー、着手は
 * 未マスクの真の状態」に分離しているため、復元は不要になった。
 */
