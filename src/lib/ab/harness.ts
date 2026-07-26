/**
 * A/B セルフプレイ計測ハーネス本体。
 *
 * 設計の要点:
 *  1. シードごとにセットアップ（配牌 → 宣言 → 副官 → 交換）を **1 回だけ** 実行し、
 *     まったく同じ初期局面を両バリアントに与える (common random numbers)。
 *     これにより配牌由来の分散が対応のある差分でキャンセルされる。
 *  2. プレイ方策 (`selectAICard` に渡す AIStrategyConfig) だけがバリアント間で異なる。
 *  3. ネットワーク・Supabase・ML API には一切アクセスしない。
 */

import { resetToMathRandom } from '@/lib/utils/rng'
import type { Suit } from '@/types/game'
import {
  AB_DEFAULTS,
  EMULATE_TRUMP_TARGETS,
  type EmulateTrumpTarget,
  LOG_PREFIX,
  MAX_REPORTED_FALLBACK_ERRORS,
  VARIANT_IDS,
  type VariantRole,
} from './constants'
import {
  playoutGame,
  resolveBlindSeats,
  resolveSeatAssignments,
} from './playout'
import { setupGame } from './setup'
import { mean, pairedComparison, standardDeviation } from './stats'
import type {
  ABResult,
  ABRunOptions,
  FallbackErrorCount,
  GameOutcome,
  SuitBreakdown,
  VariantSummary,
} from './types'

/** `--emulate-missing-trump-suit` の指定を A / B それぞれの真偽値に展開する */
export function resolveEmulationTargets(target: EmulateTrumpTarget): {
  a: boolean
  b: boolean
} {
  return {
    a:
      target === EMULATE_TRUMP_TARGETS.A ||
      target === EMULATE_TRUMP_TARGETS.BOTH,
    b:
      target === EMULATE_TRUMP_TARGETS.B ||
      target === EMULATE_TRUMP_TARGETS.BOTH,
  }
}

/** フォールバック理由を回数の多い順に集計する */
function aggregateFallbackErrors(
  outcomes: GameOutcome[]
): FallbackErrorCount[] {
  const totals = new Map<string, number>()

  for (const outcome of outcomes) {
    for (const [signature, count] of Object.entries(outcome.fallbackErrors)) {
      totals.set(signature, (totals.get(signature) ?? 0) + count)
    }
  }

  return [...totals.entries()]
    .map(([signature, count]) => ({ signature, count }))
    .sort((left, right) =>
      right.count !== left.count
        ? right.count - left.count
        : left.signature.localeCompare(right.signature)
    )
    .slice(0, MAX_REPORTED_FALLBACK_ERRORS)
}

/** 宣言スート別の内訳を作る（対応のある差分もスートごとに計算する） */
function summarizeBySuit(
  aOutcomes: GameOutcome[],
  bOutcomes: GameOutcome[]
): SuitBreakdown[] {
  const suits: Suit[] = []
  for (const outcome of aOutcomes) {
    if (!suits.includes(outcome.trumpSuit)) suits.push(outcome.trumpSuit)
  }

  return suits
    .map((suit) => {
      const indices = aOutcomes
        .map((outcome, index) => ({ outcome, index }))
        .filter((entry) => entry.outcome.trumpSuit === suit)
        .map((entry) => entry.index)

      const a = indices.map((index) => aOutcomes[index])
      const b = indices.map((index) => bOutcomes[index])
      const aWins: number[] = a.map((outcome) => (outcome.napoleonWon ? 1 : 0))
      const bWins: number[] = b.map((outcome) => (outcome.napoleonWon ? 1 : 0))
      const aMargins = a.map((outcome) => outcome.margin)
      const bMargins = b.map((outcome) => outcome.margin)

      return {
        suit,
        games: indices.length,
        aNapoleonWins: aWins.reduce((sum, value) => sum + value, 0),
        bNapoleonWins: bWins.reduce((sum, value) => sum + value, 0),
        aNapoleonWinRate: mean(aWins),
        bNapoleonWinRate: mean(bWins),
        aMeanMargin: mean(aMargins),
        bMeanMargin: mean(bMargins),
        napoleonWinRate: pairedComparison('napoleonWinRate', aWins, bWins),
        margin: pairedComparison('margin', aMargins, bMargins),
      }
    })
    .sort((left, right) =>
      right.games !== left.games
        ? right.games - left.games
        : left.suit.localeCompare(right.suit)
    )
}

/** ゲームごとにシードをずらす歩幅（セットアップの配り直しシードと衝突しにくくする） */
const SEED_STRIDE = 1_000

function summarize(
  id: VariantSummary['id'],
  label: string,
  outcomes: GameOutcome[]
): VariantSummary {
  const margins = outcomes.map((o) => o.margin)
  const wins = outcomes.filter((o) => o.napoleonWon).length
  const totalDecisions = outcomes.reduce((sum, o) => sum + o.totalDecisions, 0)
  const totalDecisionMs = outcomes.reduce(
    (sum, o) => sum + o.totalDecisionMs,
    0
  )
  const variantDecisions = outcomes.reduce(
    (sum, o) => sum + o.variantDecisions,
    0
  )
  const variantDecisionMs = outcomes.reduce(
    (sum, o) => sum + o.variantDecisionMs,
    0
  )
  const totalFallbacks = outcomes.reduce((sum, o) => sum + o.totalFallbacks, 0)

  return {
    id,
    label,
    games: outcomes.length,
    napoleonWins: wins,
    napoleonWinRate: outcomes.length > 0 ? wins / outcomes.length : 0,
    meanFaceCards: mean(outcomes.map((o) => o.napoleonFaceCards)),
    meanMargin: mean(margins),
    sdMargin: standardDeviation(margins),
    meanTricksPlayed: mean(outcomes.map((o) => o.tricksPlayed)),
    meanVariantDecisionMs:
      variantDecisions > 0 ? variantDecisionMs / variantDecisions : 0,
    meanDecisionMs: totalDecisions > 0 ? totalDecisionMs / totalDecisions : 0,
    totalDecisions,
    fallbackRate: totalDecisions > 0 ? totalFallbacks / totalDecisions : 0,
    totalFallbacks,
    fallbackErrors: aggregateFallbackErrors(outcomes),
  }
}

/**
 * A/B 計測を実行する。
 */
export function runAB(options: ABRunOptions): ABResult {
  const {
    games,
    seed,
    variantA,
    variantB,
    baseline,
    variantRole,
    setupDeclaration,
    maxRedeals,
    progress,
    logger,
  } = options

  const emulateMissingTrumpSuit =
    options.emulateMissingTrumpSuit ??
    (AB_DEFAULTS.EMULATE_MISSING_TRUMP_SUIT as EmulateTrumpTarget)
  const emulateRole =
    options.emulateRole ?? (AB_DEFAULTS.EMULATE_ROLE as VariantRole)
  const emulation = resolveEmulationTargets(emulateMissingTrumpSuit)
  const noBlindSeats: ReadonlySet<string> = new Set()

  const log = logger ?? ((message: string) => console.log(message))

  const aOutcomes: GameOutcome[] = []
  const bOutcomes: GameOutcome[] = []
  const pairs: ABResult['games'] = []
  const skippedSeeds: number[] = []

  const startedAt = Date.now()

  try {
    for (let index = 0; index < games; index++) {
      const gameSeed = seed + index * SEED_STRIDE

      const setup = setupGame(gameSeed, setupDeclaration, maxRedeals)
      if (!setup) {
        skippedSeeds.push(gameSeed)
        if (progress) {
          log(
            `${LOG_PREFIX} seed=${gameSeed} skipped (no Napoleon declaration after ${maxRedeals} redeals)`
          )
        }
        continue
      }

      const blindSeats = resolveBlindSeats(setup, emulateRole)

      const aOutcome = playoutGame(
        setup,
        resolveSeatAssignments(setup, variantRole, variantA, baseline),
        gameSeed,
        emulation.a ? blindSeats : noBlindSeats
      )
      const bOutcome = playoutGame(
        setup,
        resolveSeatAssignments(setup, variantRole, variantB, baseline),
        gameSeed,
        emulation.b ? blindSeats : noBlindSeats
      )

      aOutcomes.push(aOutcome)
      bOutcomes.push(bOutcome)
      pairs.push({ seed: gameSeed, a: aOutcome, b: bOutcome })

      if (progress) {
        log(
          `${LOG_PREFIX} ${index + 1}/${games} seed=${gameSeed} target=${setup.targetFaceCards} ` +
            `A=${aOutcome.napoleonFaceCards}(${aOutcome.margin >= 0 ? '+' : ''}${aOutcome.margin}) ` +
            `B=${bOutcome.napoleonFaceCards}(${bOutcome.margin >= 0 ? '+' : ''}${bOutcome.margin})`
        )
      }
    }
  } finally {
    // 計測が終わったら必ず本番と同じ Math.random に戻す
    resetToMathRandom()
  }

  const elapsedMs = Date.now() - startedAt
  const completed = aOutcomes.length

  return {
    meta: {
      games: completed,
      requestedGames: games,
      seed,
      variantRole,
      setupDeclaration,
      emulateMissingTrumpSuit,
      emulateRole,
      baselineLabel: baseline.label,
      skippedSeeds,
      elapsedMs,
      gamesPerSecond: elapsedMs > 0 ? (completed * 1000) / elapsedMs : 0,
    },
    variantA: summarize(VARIANT_IDS.A, variantA.label, aOutcomes),
    variantB: summarize(VARIANT_IDS.B, variantB.label, bOutcomes),
    paired: {
      napoleonWinRate: pairedComparison(
        'napoleonWinRate',
        aOutcomes.map((o) => (o.napoleonWon ? 1 : 0)),
        bOutcomes.map((o) => (o.napoleonWon ? 1 : 0))
      ),
      margin: pairedComparison(
        'margin',
        aOutcomes.map((o) => o.margin),
        bOutcomes.map((o) => o.margin)
      ),
      faceCards: pairedComparison(
        'faceCards',
        aOutcomes.map((o) => o.napoleonFaceCards),
        bOutcomes.map((o) => o.napoleonFaceCards)
      ),
    },
    bySuit: summarizeBySuit(aOutcomes, bOutcomes),
    games: pairs,
  }
}
