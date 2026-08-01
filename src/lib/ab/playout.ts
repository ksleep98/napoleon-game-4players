/**
 * プレイフェーズのセルフプレイ実行。
 *
 * `getPlayableCards` → `selectAICard` → `simulateCardPlay` の自前ループ。
 * 本番の AI ターン処理 (`@/lib/ai/gameTricks`) は ML 推論と Supabase 書き込みを
 * 伴うため経由しない。そのぶん、本番が `processAITurn` の内側で掛けている
 * 「AI 視点ビュー」（未公開の副官を伏せる）は `toAIView` で再現する。
 * ここを外すとハーネスだけが本番と違う AI を測ることになる。
 *
 * ⚠️ 既知のルール差分（両バリアントに等しく効くため A/B 比較の妥当性は保たれる）:
 *   - `gameSimulator.simulateCardPlay` は勝者判定に常に `isFirstTrick = false`
 *     を渡すため、「1トリック目は切り札判定を無効化」という本番ルールが
 *     セルフプレイでは適用されない。
 *   - 交換で捨てた絵札はどちらのチームの取り札にもカウントされない
 *     (`getGameResult` はトリックの絵札のみ数える)。
 */

import { selectAICard } from '@/lib/ai/aiStrategy'
import {
  getGameResult,
  getPlayableCards,
  isGameFinished,
  selectRandomCard,
  simulateCardPlay,
} from '@/lib/ai/gameSimulator'
import { maskAdjutantIdentityForPlayer } from '@/lib/game/maskGameState'
import { setSeed } from '@/lib/utils/rng'
import type { Card, GameState } from '@/types/game'
import { AB_DEFAULTS, VARIANT_ROLES, type VariantRole } from './constants'
import type { GameOutcome, GameSetup, VariantSpec } from './types'

/** 例外ではなく「戦略が候補を返さなかった」場合の署名 */
export const NO_CARD_SELECTED_SIGNATURE = '<strategy returned no card>'

/** 1 席あたりの設定 */
export interface SeatAssignment {
  playerId: string
  spec: VariantSpec
  /** variant 側の席か（baseline 側なら false） */
  isVariant: boolean
}

/** 高精度タイマー（Node / jsdom いずれでも利用可能） */
function now(): number {
  return typeof performance !== 'undefined' &&
    typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
}

/** 指定した席が role に該当するか */
function matchesRole(
  setup: GameSetup,
  playerId: string,
  role: VariantRole
): boolean {
  const isNapoleon = playerId === setup.napoleonPlayerId
  const isAdjutant =
    setup.adjutantPlayerId !== undefined && playerId === setup.adjutantPlayerId

  switch (role) {
    case VARIANT_ROLES.NAPOLEON:
      return isNapoleon
    case VARIANT_ROLES.ADJUTANT:
      return isAdjutant
    case VARIANT_ROLES.ALLIED:
      return !isNapoleon && !isAdjutant
    case VARIANT_ROLES.ALL:
      return true
    default:
      return isNapoleon || isAdjutant
  }
}

/**
 * variantRole に従って、どの席に variant / baseline を割り当てるかを決める。
 */
export function resolveSeatAssignments(
  setup: GameSetup,
  variantRole: VariantRole,
  variant: VariantSpec,
  baseline: VariantSpec
): SeatAssignment[] {
  return setup.state.players.map((player) => {
    const isVariant = matchesRole(setup, player.id, variantRole)

    return {
      playerId: player.id,
      spec: isVariant ? variant : baseline,
      isVariant,
    }
  })
}

/**
 * 「切り札スートを見せない」席の集合を決める。
 * 修正前の本番挙動をどの席で再現するかを role で絞り込める。
 */
export function resolveBlindSeats(
  setup: GameSetup,
  role: VariantRole
): Set<string> {
  return new Set(
    setup.state.players
      .filter((player) => matchesRole(setup, player.id, role))
      .map((player) => player.id)
  )
}

/**
 * 例外を集計しやすい 1 行の署名に変換する。
 * （メッセージ + 最初のスタックフレームで発生源を特定できるようにする）
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)

  const frame = (error.stack ?? '')
    .split('\n')
    .slice(1)
    .map((line) => line.trim())
    .find((line) => line.startsWith('at '))

  return frame
    ? `${error.name}: ${error.message} @ ${frame}`
    : `${error.name}: ${error.message}`
}

/**
 * AI の選択を「本番と同じ意味論」で実行する。
 *
 * `gameTricks.selectAICard` は戦略評価が throw した場合を try/catch で拾い、
 * `selectFallbackCard`（プレイ可能カードからランダム）に落としている。
 * ハーネスでも同じ扱いにしないと、既存 AI の潜在バグ（例: 空トリックで
 * `getBestTrickCard` が undefined 参照）でプロセスごと落ちてしまい、
 * 本番の実効的な挙動とも一致しなくなる。
 *
 * ※ AI の意思決定ロジック自体には手を入れていない。
 */
function selectCardWithProductionFallback(
  state: GameState,
  assignment: SeatAssignment,
  playable: Card[],
  onError: (signature: string) => void
): { card: Card; fellBack: boolean } {
  const player = state.players[state.currentPlayerIndex]

  try {
    const selected = selectAICard(state, player, assignment.spec.config)
    if (selected) return { card: selected, fellBack: false }
    onError(NO_CARD_SELECTED_SIGNATURE)
  } catch (error) {
    // 本番同様、握りつぶしてフォールバックする（理由だけ記録する）
    onError(describeError(error))
  }

  return { card: selectRandomCard(playable), fellBack: true }
}

/** トリック開始時のリードスートを状態に反映する（本番の playCard 相当の記帳） */
function syncLeadingSuit(state: GameState): GameState {
  const firstCard = state.currentTrick.cards[0]
  return {
    ...state,
    leadingSuit: firstCard ? firstCard.card.suit : undefined,
  }
}

/**
 * AI に渡す局面を作る。
 *
 * 未公開の副官の正体は常に伏せる。本番は `gameLogic.processAITurn` が
 * `maskAdjutantIdentityForPlayer` でこのビューを作ってから AI 評価層へ渡すが、
 * ハーネスは `selectAICard` を直接叩くためその境界を通らない。ここで同じ
 * マスクを掛けないと、ハーネスだけが「副官を知ったままの AI」を測り続け、
 * 強さ比較が本番とズレる。
 *
 * `hideTrumpSuit` が true のときは `trumpSuit` を落とした「修正前の本番と同じ
 * 見え方」を AI にだけ与える。
 *
 * ⚠️ 戻り値は AI の評価にだけ渡すこと。ハーネス内部の state（トリック解決に
 * 使う側）は真値のままにする。マスク済み state をループの次周へ持ち越すと
 * 副官フラグが消えたまま試合が進んでしまう。真値を保つことで、勝敗判定は
 * 本番の `gameLogic.determineWinner`（`trumpSuit || napoleonDeclaration.suit`）
 * と等価に保たれる。
 */
function toAIView(
  state: GameState,
  viewerPlayerId: string,
  hideTrumpSuit: boolean
): GameState {
  const view = maskAdjutantIdentityForPlayer(state, viewerPlayerId)
  if (!hideTrumpSuit) return view
  return { ...view, trumpSuit: undefined }
}

/**
 * 1 局のプレイフェーズを最後まで回して計測結果を返す。
 *
 * @param setup 両バリアント共通の初期局面
 * @param assignments 席ごとの設定
 * @param seed 乱数シード（MCTS の determinization を再現するため毎局設定し直す）
 * @param blindSeats 修正前挙動（trumpSuit 未設定）を再現する席の集合
 */
export function playoutGame(
  setup: GameSetup,
  assignments: SeatAssignment[],
  seed: number,
  blindSeats: ReadonlySet<string> = new Set()
): GameOutcome {
  // 同一シードから開始することで、MCTS の determinization も再現可能になる
  setSeed(seed)

  const specById = new Map(
    assignments.map((assignment) => [assignment.playerId, assignment])
  )

  let state: GameState = {
    ...setup.state,
    players: setup.state.players.map((player) => ({
      ...player,
      hand: [...player.hand],
    })),
  }

  let variantDecisions = 0
  let variantDecisionMs = 0
  let totalDecisions = 0
  let totalDecisionMs = 0
  let variantFallbacks = 0
  let totalFallbacks = 0
  let iterations = 0
  const fallbackErrors: Record<string, number> = {}
  const recordError = (signature: string): void => {
    fallbackErrors[signature] = (fallbackErrors[signature] ?? 0) + 1
  }

  while (
    !isGameFinished(state) &&
    iterations < AB_DEFAULTS.MAX_PLAY_ITERATIONS
  ) {
    iterations += 1

    const player = state.players[state.currentPlayerIndex]
    const playable = getPlayableCards(state, player.id)
    if (playable.length === 0) break

    const assignment = specById.get(player.id)
    if (!assignment) {
      throw new Error(`No seat assignment for player ${player.id}`)
    }

    state = syncLeadingSuit(state)

    const startedAt = now()
    const { card, fellBack } = selectCardWithProductionFallback(
      toAIView(state, player.id, blindSeats.has(player.id)),
      assignment,
      playable,
      recordError
    )
    const elapsed = now() - startedAt

    totalDecisions += 1
    totalDecisionMs += elapsed
    if (fellBack) totalFallbacks += 1
    if (assignment.isVariant) {
      variantDecisions += 1
      variantDecisionMs += elapsed
      if (fellBack) variantFallbacks += 1
    }

    state = simulateCardPlay(state, player.id, card)
  }

  const result = getGameResult(state)
  const napoleonFaceCards = result.napoleonTricksWon

  return {
    seed,
    trumpSuit: setup.trumpSuit,
    trumpSuitHiddenSeats: blindSeats.size,
    napoleonWon: result.napoleonWon,
    napoleonFaceCards,
    targetFaceCards: setup.targetFaceCards,
    margin: napoleonFaceCards - setup.targetFaceCards,
    tricksPlayed: state.tricks.length,
    variantDecisions,
    variantDecisionMs,
    variantFallbacks,
    totalDecisions,
    totalDecisionMs,
    totalFallbacks,
    fallbackErrors,
    redeals: setup.redeals,
  }
}
