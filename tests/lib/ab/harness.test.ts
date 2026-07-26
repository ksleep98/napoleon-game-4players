import { parseVariantSpec } from '@/lib/ab/cli'
import {
  AB_DEFAULTS,
  EMULATE_TRUMP_TARGETS,
  SETUP_DECLARATION_POLICIES,
  STRATEGY_NAMES,
  TOTAL_FACE_CARDS,
  VARIANT_ROLES,
} from '@/lib/ab/constants'
import { resolveEmulationTargets, runAB } from '@/lib/ab/harness'
import { resolveBlindSeats, resolveSeatAssignments } from '@/lib/ab/playout'
import { setupGame } from '@/lib/ab/setup'
import type { ABResult, ABRunOptions, GameSetup } from '@/lib/ab/types'
import { GAME_CONFIG, GAME_PHASES } from '@/lib/constants'
import { isSeeded, resetToMathRandom } from '@/lib/utils/rng'

const HEURISTIC = parseVariantSpec(STRATEGY_NAMES.HEURISTIC)

/** MCTS を極小設定にして、テストが数百ミリ秒で終わるようにする */
const TINY_MCTS = parseVariantSpec(STRATEGY_NAMES.MCTS, {
  simulationCount: 8,
  determinizationCount: 1,
})

function buildOptions(overrides: Partial<ABRunOptions> = {}): ABRunOptions {
  return {
    games: 2,
    seed: 1234,
    variantA: HEURISTIC,
    variantB: HEURISTIC,
    baseline: HEURISTIC,
    variantRole: VARIANT_ROLES.NAPOLEON_TEAM,
    setupDeclaration: SETUP_DECLARATION_POLICIES.HEURISTIC,
    maxRedeals: AB_DEFAULTS.MAX_REDEALS,
    progress: false,
    ...overrides,
  }
}

/** 実行時間など非決定的なフィールドを落として比較可能にする */
function stripTimings(result: ABResult): unknown {
  const clone = JSON.parse(JSON.stringify(result)) as ABResult

  const meta = clone.meta as unknown as Record<string, unknown>
  meta.elapsedMs = 0
  meta.gamesPerSecond = 0

  for (const variant of [clone.variantA, clone.variantB]) {
    const record = variant as unknown as Record<string, unknown>
    record.meanVariantDecisionMs = 0
    record.meanDecisionMs = 0
  }

  for (const pair of clone.games) {
    for (const outcome of [pair.a, pair.b]) {
      const record = outcome as unknown as Record<string, unknown>
      record.variantDecisionMs = 0
      record.totalDecisionMs = 0
    }
  }

  return clone
}

function handSignature(setup: GameSetup): string {
  return setup.state.players
    .map((player) =>
      player.hand
        .map((card) => card.id)
        .sort()
        .join(',')
    )
    .join('|')
}

describe('ab/setup', () => {
  afterEach(() => {
    resetToMathRandom()
  })

  it('produces an identical deal for the same seed', () => {
    const first = setupGame(
      99,
      SETUP_DECLARATION_POLICIES.HEURISTIC,
      AB_DEFAULTS.MAX_REDEALS
    )
    const second = setupGame(
      99,
      SETUP_DECLARATION_POLICIES.HEURISTIC,
      AB_DEFAULTS.MAX_REDEALS
    )

    expect(first).not.toBeNull()
    expect(second).not.toBeNull()
    expect(handSignature(second as GameSetup)).toBe(
      handSignature(first as GameSetup)
    )
    expect((second as GameSetup).trumpSuit).toBe((first as GameSetup).trumpSuit)
    expect((second as GameSetup).targetFaceCards).toBe(
      (first as GameSetup).targetFaceCards
    )
  })

  it('produces a different deal for a different seed', () => {
    const signatures = new Set<string>()

    for (const seed of [1, 2, 3, 4, 5]) {
      const setup = setupGame(
        seed,
        SETUP_DECLARATION_POLICIES.HEURISTIC,
        AB_DEFAULTS.MAX_REDEALS
      )
      expect(setup).not.toBeNull()
      signatures.add(handSignature(setup as GameSetup))
    }

    expect(signatures.size).toBe(5)
  })

  it('hands back a state that is ready for the playing phase', () => {
    const setup = setupGame(
      2024,
      SETUP_DECLARATION_POLICIES.HEURISTIC,
      AB_DEFAULTS.MAX_REDEALS
    )
    expect(setup).not.toBeNull()
    const { state, trumpSuit, targetFaceCards } = setup as GameSetup

    expect(state.phase).toBe(GAME_PHASES.PLAYING)
    // gameSimulator / strategicCardEvaluator は trumpSuit を直接読むので必須
    expect(state.trumpSuit).toBe(trumpSuit)
    expect(state.napoleonDeclaration?.suit).toBe(trumpSuit)
    expect(targetFaceCards).toBeGreaterThanOrEqual(13)
    expect(targetFaceCards).toBeLessThanOrEqual(TOTAL_FACE_CARDS)

    expect(state.players).toHaveLength(GAME_CONFIG.PLAYERS_COUNT)
    for (const player of state.players) {
      expect(player.hand).toHaveLength(GAME_CONFIG.CARDS_PER_PLAYER)
    }
    expect(state.players.filter((p) => p.isNapoleon)).toHaveLength(1)
    expect(state.exchangedCards).toHaveLength(GAME_CONFIG.HIDDEN_CARDS)
  })
})

describe('ab/playout seat assignment', () => {
  afterEach(() => {
    resetToMathRandom()
  })

  it('gives the variant to the Napoleon team only', () => {
    const setup = setupGame(
      555,
      SETUP_DECLARATION_POLICIES.HEURISTIC,
      AB_DEFAULTS.MAX_REDEALS
    ) as GameSetup
    expect(setup).not.toBeNull()

    const assignments = resolveSeatAssignments(
      setup,
      VARIANT_ROLES.NAPOLEON_TEAM,
      TINY_MCTS,
      HEURISTIC
    )

    for (const assignment of assignments) {
      const isTeam =
        assignment.playerId === setup.napoleonPlayerId ||
        assignment.playerId === setup.adjutantPlayerId
      expect(assignment.isVariant).toBe(isTeam)
      expect(assignment.spec.label).toBe(
        isTeam ? TINY_MCTS.label : HEURISTIC.label
      )
    }
  })

  it('gives the variant to every seat when role is "all"', () => {
    const setup = setupGame(
      556,
      SETUP_DECLARATION_POLICIES.HEURISTIC,
      AB_DEFAULTS.MAX_REDEALS
    ) as GameSetup

    const assignments = resolveSeatAssignments(
      setup,
      VARIANT_ROLES.ALL,
      TINY_MCTS,
      HEURISTIC
    )

    expect(assignments.every((a) => a.isVariant)).toBe(true)
  })
})

describe('ab/harness runAB', () => {
  afterEach(() => {
    resetToMathRandom()
  })

  it('is deterministic for the same seed (heuristic)', () => {
    const first = runAB(buildOptions())
    const second = runAB(buildOptions())

    expect(stripTimings(second)).toEqual(stripTimings(first))
  })

  it('is deterministic for the same seed (MCTS variant)', () => {
    const options = buildOptions({ variantB: TINY_MCTS, games: 2 })

    const first = runAB(options)
    const second = runAB(options)

    expect(stripTimings(second)).toEqual(stripTimings(first))
  })

  it('produces different games for a different seed', () => {
    const first = runAB(buildOptions({ seed: 10 }))
    const second = runAB(buildOptions({ seed: 20 }))

    expect(second.games.map((g) => g.seed)).not.toEqual(
      first.games.map((g) => g.seed)
    )
  })

  it('reports a zero paired difference when A and B are the same policy', () => {
    const result = runAB(buildOptions({ games: 3 }))

    expect(result.paired.margin.meanDiff).toBe(0)
    expect(result.paired.napoleonWinRate.meanDiff).toBe(0)
    expect(result.variantA.napoleonWinRate).toBe(
      result.variantB.napoleonWinRate
    )
  })

  it('completes a small run with metrics in a plausible range', () => {
    const result = runAB(buildOptions({ games: 2, variantB: TINY_MCTS }))

    expect(result.meta.games).toBe(2)
    expect(result.meta.requestedGames).toBe(2)
    expect(result.games).toHaveLength(2)
    expect(result.meta.gamesPerSecond).toBeGreaterThan(0)

    for (const summary of [result.variantA, result.variantB]) {
      expect(summary.games).toBe(2)
      expect(summary.napoleonWinRate).toBeGreaterThanOrEqual(0)
      expect(summary.napoleonWinRate).toBeLessThanOrEqual(1)
      expect(summary.meanFaceCards).toBeGreaterThanOrEqual(0)
      expect(summary.meanFaceCards).toBeLessThanOrEqual(TOTAL_FACE_CARDS)
      expect(summary.totalDecisions).toBeGreaterThan(0)
      expect(summary.meanDecisionMs).toBeGreaterThanOrEqual(0)
      expect(summary.fallbackRate).toBeGreaterThanOrEqual(0)
      expect(summary.fallbackRate).toBeLessThanOrEqual(1)
    }

    for (const pair of result.games) {
      for (const outcome of [pair.a, pair.b]) {
        expect(outcome.napoleonFaceCards).toBeGreaterThanOrEqual(0)
        expect(outcome.napoleonFaceCards).toBeLessThanOrEqual(TOTAL_FACE_CARDS)
        expect(outcome.margin).toBe(
          outcome.napoleonFaceCards - outcome.targetFaceCards
        )
        expect(outcome.napoleonWon).toBe(
          outcome.napoleonFaceCards >= outcome.targetFaceCards
        )
        expect(outcome.tricksPlayed).toBeGreaterThan(0)
        expect(outcome.tricksPlayed).toBeLessThanOrEqual(12)
        expect(outcome.totalDecisions).toBeGreaterThan(0)
      }
      // ペア比較なので両バリアントは同じ配牌・同じ宣言を共有する
      expect(pair.a.targetFaceCards).toBe(pair.b.targetFaceCards)
      expect(pair.a.seed).toBe(pair.b.seed)
    }
  })

  it('restores Math.random after the run', () => {
    runAB(buildOptions({ games: 1 }))

    expect(isSeeded()).toBe(false)
  })

  it('breaks the result down by declared trump suit', () => {
    const result = runAB(buildOptions({ games: 4 }))

    const total = result.bySuit.reduce((sum, entry) => sum + entry.games, 0)
    expect(total).toBe(result.meta.games)

    for (const entry of result.bySuit) {
      expect(entry.napoleonWinRate.n).toBe(entry.games)
      expect(entry.margin.n).toBe(entry.games)
    }
  })
})

describe('ab/harness missing trumpSuit emulation', () => {
  afterEach(() => {
    resetToMathRandom()
  })

  it('maps the emulation target onto the two variants', () => {
    expect(resolveEmulationTargets(EMULATE_TRUMP_TARGETS.NONE)).toEqual({
      a: false,
      b: false,
    })
    expect(resolveEmulationTargets(EMULATE_TRUMP_TARGETS.A)).toEqual({
      a: true,
      b: false,
    })
    expect(resolveEmulationTargets(EMULATE_TRUMP_TARGETS.B)).toEqual({
      a: false,
      b: true,
    })
    expect(resolveEmulationTargets(EMULATE_TRUMP_TARGETS.BOTH)).toEqual({
      a: true,
      b: true,
    })
  })

  it('scopes the blinded seats by role', () => {
    const setup = setupGame(
      777,
      SETUP_DECLARATION_POLICIES.HEURISTIC,
      AB_DEFAULTS.MAX_REDEALS
    ) as GameSetup
    expect(setup).not.toBeNull()

    expect(resolveBlindSeats(setup, VARIANT_ROLES.ALL).size).toBe(
      GAME_CONFIG.PLAYERS_COUNT
    )

    const napoleonOnly = resolveBlindSeats(setup, VARIANT_ROLES.NAPOLEON)
    expect([...napoleonOnly]).toEqual([setup.napoleonPlayerId])

    const allied = resolveBlindSeats(setup, VARIANT_ROLES.ALLIED)
    expect(allied.has(setup.napoleonPlayerId)).toBe(false)
    if (setup.adjutantPlayerId) {
      expect(allied.has(setup.adjutantPlayerId)).toBe(false)
    }
  })

  it('hides trumpSuit only from the emulated variant', () => {
    const result = runAB(
      buildOptions({
        games: 2,
        emulateMissingTrumpSuit: EMULATE_TRUMP_TARGETS.A,
      })
    )

    expect(result.meta.emulateMissingTrumpSuit).toBe(EMULATE_TRUMP_TARGETS.A)
    for (const pair of result.games) {
      expect(pair.a.trumpSuitHiddenSeats).toBe(GAME_CONFIG.PLAYERS_COUNT)
      expect(pair.b.trumpSuitHiddenSeats).toBe(0)
    }
  })

  it('leaves the trick resolution untouched when the AI view is blinded', () => {
    // 切り札を隠すのは AI の視界だけ。ルール（勝敗判定）は宣言スートのまま解決される。
    // トリック数は 12 固定ではない: 本番 (gameLogic.completeTrick → scoring.isGameDecided)
    // と同様、勝敗が確定した時点で打ち切られるため 12 以下になりうる。
    const result = runAB(
      buildOptions({
        games: 2,
        emulateMissingTrumpSuit: EMULATE_TRUMP_TARGETS.BOTH,
      })
    )

    for (const pair of result.games) {
      for (const outcome of [pair.a, pair.b]) {
        expect(outcome.trumpSuitHiddenSeats).toBe(GAME_CONFIG.PLAYERS_COUNT)
        expect(outcome.tricksPlayed).toBeGreaterThan(0)
        expect(outcome.tricksPlayed).toBeLessThanOrEqual(
          GAME_CONFIG.CARDS_PER_PLAYER
        )
        expect(outcome.napoleonFaceCards).toBeLessThanOrEqual(TOTAL_FACE_CARDS)
      }
    }
  })
})
