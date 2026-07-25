/**
 * A/B セルフプレイ計測ハーネスの CLI（引数解釈・整形出力）。
 *
 * 実行本体は `scripts/ab-selfplay.ts`（`pnpm sim:ab`）。
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type {
  AIDifficultyLevel,
  AIStrategyConfig,
  AIStrategyType,
} from '@/lib/ai/aiStrategy'
import type { MCTSConfig } from '@/lib/ai/monteCarloAI'
import {
  AB_DEFAULTS,
  DETERMINISTIC_TIME_LIMIT_MS,
  DIFFICULTY_BY_STRATEGY,
  EMULATE_TRUMP_TARGET_VALUES,
  type EmulateTrumpTarget,
  LOG_PREFIX,
  MCTS_PRESET_BY_NAME,
  MCTS_PRESET_NAME_VALUES,
  MCTS_PRESET_NAMES,
  type MCTSPresetName,
  SETUP_DECLARATION_POLICY_VALUES,
  type SetupDeclarationPolicy,
  STRATEGY_NAME_VALUES,
  STRATEGY_NAMES,
  VARIANT_ROLE_VALUES,
  type VariantRole,
} from './constants'
import type { ABResult, ABRunOptions, VariantSpec } from './types'

/** CLI フラグ名（文字列リテラル直書きを避けるため定数化） */
export const CLI_FLAGS = {
  HELP: '--help',
  GAMES: '--games',
  SEED: '--seed',
  A: '--a',
  B: '--b',
  BASELINE: '--baseline',
  VARIANT_ROLE: '--variant-role',
  SETUP_DECLARATION: '--setup-declaration',
  EMULATE_MISSING_TRUMP_SUIT: '--emulate-missing-trump-suit',
  EMULATE_ROLE: '--emulate-role',
  MAX_REDEALS: '--max-redeals',
  SIMS: '--sims',
  DETERMINIZATIONS: '--det',
  TIME_LIMIT: '--time-limit',
  JSON: '--json',
  QUIET: '--quiet',
} as const

/** MCTS 設定の上書き（テスト・高速実行用） */
export interface MCTSOverrides {
  simulationCount?: number
  determinizationCount?: number
  timeLimit?: number
}

/** 解釈済みの CLI 引数 */
export interface ParsedArgs {
  help: boolean
  options: ABRunOptions
  jsonPath?: string
}

/**
 * バリアント指定文字列を AIStrategyConfig に変換する。
 * 書式: `<strategy>[:<mcts-preset>]`  例) `heuristic`, `mcts:strong`, `hybrid:fast`
 */
export function parseVariantSpec(
  text: string,
  overrides: MCTSOverrides = {}
): VariantSpec {
  const [strategyPart, presetPart] = text.split(':')

  if (!STRATEGY_NAME_VALUES.includes(strategyPart as AIStrategyType)) {
    throw new Error(
      `Unknown strategy "${strategyPart}". Expected one of: ${STRATEGY_NAME_VALUES.join(', ')}`
    )
  }
  const strategy = strategyPart as AIStrategyType

  if (strategy === STRATEGY_NAMES.HEURISTIC) {
    if (presetPart) {
      throw new Error(
        `Strategy "${STRATEGY_NAMES.HEURISTIC}" does not take an MCTS preset (got "${presetPart}")`
      )
    }
    return {
      label: strategy,
      config: {
        strategy,
        difficulty: DIFFICULTY_BY_STRATEGY[strategy] as AIDifficultyLevel,
      },
    }
  }

  const presetName = (presetPart ?? MCTS_PRESET_NAMES.FAST) as MCTSPresetName
  if (!MCTS_PRESET_NAME_VALUES.includes(presetName)) {
    throw new Error(
      `Unknown MCTS preset "${presetName}". Expected one of: ${MCTS_PRESET_NAME_VALUES.join(', ')}`
    )
  }

  const preset = MCTS_PRESET_BY_NAME[presetName]
  const mctsConfig: MCTSConfig = {
    simulationCount: overrides.simulationCount ?? preset.simulationCount,
    explorationConstant: preset.explorationConstant,
    // 既定では実時間制限を実質無効化して決定論性を確保する
    timeLimit: overrides.timeLimit ?? DETERMINISTIC_TIME_LIMIT_MS,
    determinizationCount:
      overrides.determinizationCount ?? preset.determinizationCount,
  }

  const config: AIStrategyConfig = {
    strategy,
    difficulty: DIFFICULTY_BY_STRATEGY[strategy] as AIDifficultyLevel,
    mctsConfig,
  }

  return { label: `${strategy}:${presetName}`, config }
}

function requireValue(flag: string, value: string | undefined): string {
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`)
  }
  return value
}

function parsePositiveInt(flag: string, value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new Error(`${flag} expects a positive integer, got "${value}"`)
  }
  return parsed
}

function parseNonNegativeInt(flag: string, value: string): number {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new Error(`${flag} expects a non-negative integer, got "${value}"`)
  }
  return parsed
}

/**
 * argv（実行ファイル名を除いた配列）を解釈する。
 */
export function parseArgs(argv: string[]): ParsedArgs {
  let games = AB_DEFAULTS.GAMES as number
  let seed = AB_DEFAULTS.SEED as number
  let aText = AB_DEFAULTS.VARIANT_A as string
  let bText = AB_DEFAULTS.VARIANT_B as string
  let baselineText = AB_DEFAULTS.BASELINE as string
  let variantRole = AB_DEFAULTS.VARIANT_ROLE as VariantRole
  let setupDeclaration = AB_DEFAULTS.SETUP_DECLARATION as SetupDeclarationPolicy
  let maxRedeals = AB_DEFAULTS.MAX_REDEALS as number
  let emulateMissingTrumpSuit =
    AB_DEFAULTS.EMULATE_MISSING_TRUMP_SUIT as EmulateTrumpTarget
  let emulateRole = AB_DEFAULTS.EMULATE_ROLE as VariantRole
  let quiet = false
  let help = false
  let jsonPath: string | undefined
  const overrides: MCTSOverrides = {}

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    switch (flag) {
      case CLI_FLAGS.HELP:
        help = true
        break
      case CLI_FLAGS.GAMES:
        games = parsePositiveInt(flag, requireValue(flag, argv[++i]))
        break
      case CLI_FLAGS.SEED:
        seed = parseNonNegativeInt(flag, requireValue(flag, argv[++i]))
        break
      case CLI_FLAGS.A:
        aText = requireValue(flag, argv[++i])
        break
      case CLI_FLAGS.B:
        bText = requireValue(flag, argv[++i])
        break
      case CLI_FLAGS.BASELINE:
        baselineText = requireValue(flag, argv[++i])
        break
      case CLI_FLAGS.VARIANT_ROLE: {
        const value = requireValue(flag, argv[++i])
        if (!VARIANT_ROLE_VALUES.includes(value as VariantRole)) {
          throw new Error(
            `Unknown ${flag} "${value}". Expected one of: ${VARIANT_ROLE_VALUES.join(', ')}`
          )
        }
        variantRole = value as VariantRole
        break
      }
      case CLI_FLAGS.SETUP_DECLARATION: {
        const value = requireValue(flag, argv[++i])
        if (
          !SETUP_DECLARATION_POLICY_VALUES.includes(
            value as SetupDeclarationPolicy
          )
        ) {
          throw new Error(
            `Unknown ${flag} "${value}". Expected one of: ${SETUP_DECLARATION_POLICY_VALUES.join(', ')}`
          )
        }
        setupDeclaration = value as SetupDeclarationPolicy
        break
      }
      case CLI_FLAGS.EMULATE_MISSING_TRUMP_SUIT: {
        const value = requireValue(flag, argv[++i])
        if (
          !EMULATE_TRUMP_TARGET_VALUES.includes(value as EmulateTrumpTarget)
        ) {
          throw new Error(
            `Unknown ${flag} "${value}". Expected one of: ${EMULATE_TRUMP_TARGET_VALUES.join(', ')}`
          )
        }
        emulateMissingTrumpSuit = value as EmulateTrumpTarget
        break
      }
      case CLI_FLAGS.EMULATE_ROLE: {
        const value = requireValue(flag, argv[++i])
        if (!VARIANT_ROLE_VALUES.includes(value as VariantRole)) {
          throw new Error(
            `Unknown ${flag} "${value}". Expected one of: ${VARIANT_ROLE_VALUES.join(', ')}`
          )
        }
        emulateRole = value as VariantRole
        break
      }
      case CLI_FLAGS.MAX_REDEALS:
        maxRedeals = parseNonNegativeInt(flag, requireValue(flag, argv[++i]))
        break
      case CLI_FLAGS.SIMS:
        overrides.simulationCount = parsePositiveInt(
          flag,
          requireValue(flag, argv[++i])
        )
        break
      case CLI_FLAGS.DETERMINIZATIONS:
        overrides.determinizationCount = parsePositiveInt(
          flag,
          requireValue(flag, argv[++i])
        )
        break
      case CLI_FLAGS.TIME_LIMIT:
        overrides.timeLimit = parsePositiveInt(
          flag,
          requireValue(flag, argv[++i])
        )
        break
      case CLI_FLAGS.JSON:
        jsonPath = requireValue(flag, argv[++i])
        break
      case CLI_FLAGS.QUIET:
        quiet = true
        break
      default:
        throw new Error(`Unknown argument "${flag}" (try ${CLI_FLAGS.HELP})`)
    }
  }

  return {
    help,
    jsonPath,
    options: {
      games,
      seed,
      variantA: parseVariantSpec(aText, overrides),
      variantB: parseVariantSpec(bText, overrides),
      baseline: parseVariantSpec(baselineText, overrides),
      variantRole,
      setupDeclaration,
      emulateMissingTrumpSuit,
      emulateRole,
      maxRedeals,
      progress: !quiet,
    },
  }
}

/** --help の本文 */
export function helpText(): string {
  return [
    'Offline A/B self-play harness for Napoleon AI (no network / Supabase / ML).',
    '',
    'Usage:',
    '  pnpm sim:ab [options]',
    '',
    'Options:',
    `  ${CLI_FLAGS.GAMES} <n>              Number of paired games (default: ${AB_DEFAULTS.GAMES})`,
    `  ${CLI_FLAGS.SEED} <n>               Base RNG seed (default: ${AB_DEFAULTS.SEED})`,
    `  ${CLI_FLAGS.A} <spec>               Variant A play policy (default: ${AB_DEFAULTS.VARIANT_A})`,
    `  ${CLI_FLAGS.B} <spec>               Variant B play policy (default: ${AB_DEFAULTS.VARIANT_B})`,
    `  ${CLI_FLAGS.BASELINE} <spec>        Policy for non-variant seats (default: ${AB_DEFAULTS.BASELINE})`,
    `  ${CLI_FLAGS.VARIANT_ROLE} <role>    Seats the variant replaces (default: ${AB_DEFAULTS.VARIANT_ROLE})`,
    `                              one of: ${VARIANT_ROLE_VALUES.join(' | ')}`,
    `  ${CLI_FLAGS.SETUP_DECLARATION} <p>  Napoleon declaration policy during setup`,
    `                              one of: ${SETUP_DECLARATION_POLICY_VALUES.join(' | ')} (default: ${AB_DEFAULTS.SETUP_DECLARATION})`,
    `  ${CLI_FLAGS.EMULATE_MISSING_TRUMP_SUIT} <t>`,
    `                              Hide gameState.trumpSuit from the AI (pre-fix production behaviour)`,
    `                              one of: ${EMULATE_TRUMP_TARGET_VALUES.join(' | ')} (default: ${AB_DEFAULTS.EMULATE_MISSING_TRUMP_SUIT})`,
    `  ${CLI_FLAGS.EMULATE_ROLE} <role>    Seats blinded by the emulation (default: ${AB_DEFAULTS.EMULATE_ROLE})`,
    `                              one of: ${VARIANT_ROLE_VALUES.join(' | ')}`,
    `  ${CLI_FLAGS.MAX_REDEALS} <n>        Redeal attempts before skipping a seed (default: ${AB_DEFAULTS.MAX_REDEALS})`,
    `  ${CLI_FLAGS.SIMS} <n>               Override MCTS simulationCount for every variant`,
    `  ${CLI_FLAGS.DETERMINIZATIONS} <n>                Override MCTS determinizationCount`,
    `  ${CLI_FLAGS.TIME_LIMIT} <ms>        Override MCTS wall-clock limit (breaks determinism)`,
    `  ${CLI_FLAGS.JSON} <path>            Write the full result as JSON`,
    `  ${CLI_FLAGS.QUIET}                  Suppress per-game progress lines`,
    `  ${CLI_FLAGS.HELP}                   Show this help`,
    '',
    'Variant spec:',
    `  <strategy>[:<mcts-preset>]  strategy: ${STRATEGY_NAME_VALUES.join(' | ')}`,
    `                              mcts-preset: ${MCTS_PRESET_NAME_VALUES.join(' | ')} (default: ${MCTS_PRESET_NAMES.FAST})`,
    '',
    'Examples:',
    '  pnpm sim:ab --games 200 --seed 42 --a hybrid --b mcts:strong --variant-role napoleon-team',
    '  pnpm sim:ab --games 50 --a heuristic --b mcts:fast --sims 30 --det 2 --json /tmp/ab.json',
    '',
    'Notes:',
    '  * Both variants play the SAME dealt hands, declaration, adjutant and exchange',
    '    (common random numbers), so the paired difference cancels deal variance.',
    `  * MCTS wall-clock limits are disabled by default (set to ${DETERMINISTIC_TIME_LIMIT_MS}ms)`,
    '    so runs are reproducible; simulationCount is what bounds the search.',
  ].join('\n')
}

function fixed(value: number, digits: number): string {
  return value.toFixed(digits)
}

function signed(value: number, digits: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(digits)}`
}

function row(label: string, a: string, b: string): string {
  return `  ${label.padEnd(30)}${a.padStart(14)}${b.padStart(16)}`
}

/** 人間可読なサマリを生成 */
export function formatSummary(result: ABResult): string {
  const { meta, variantA, variantB, paired, bySuit } = result
  const lines: string[] = []

  lines.push('')
  lines.push(`${LOG_PREFIX} ===== A/B self-play summary =====`)
  lines.push(
    `${LOG_PREFIX} games=${meta.games}/${meta.requestedGames}  seed=${meta.seed}  ` +
      `variant-role=${meta.variantRole}  baseline=${meta.baselineLabel}  ` +
      `setup-declaration=${meta.setupDeclaration}  ` +
      `emulate-missing-trump-suit=${meta.emulateMissingTrumpSuit}(${meta.emulateRole})`
  )
  if (meta.skippedSeeds.length > 0) {
    lines.push(
      `${LOG_PREFIX} skipped seeds (no declaration): ${meta.skippedSeeds.join(', ')}`
    )
  }
  lines.push(
    `${LOG_PREFIX} elapsed=${fixed(meta.elapsedMs / 1000, 2)}s  ` +
      `paired-games/sec=${fixed(meta.gamesPerSecond, 3)}`
  )
  lines.push('')
  lines.push(
    row('metric', `A: ${variantA.label}`, `B: ${variantB.label}`).trimEnd()
  )
  lines.push(`  ${'-'.repeat(58)}`)
  lines.push(
    row(
      'napoleon win rate',
      fixed(variantA.napoleonWinRate, 4),
      fixed(variantB.napoleonWinRate, 4)
    )
  )
  lines.push(
    row(
      'napoleon wins',
      `${variantA.napoleonWins}/${variantA.games}`,
      `${variantB.napoleonWins}/${variantB.games}`
    )
  )
  lines.push(
    row(
      'mean face cards (nap. team)',
      fixed(variantA.meanFaceCards, 3),
      fixed(variantB.meanFaceCards, 3)
    )
  )
  lines.push(
    row(
      'mean margin (won - declared)',
      signed(variantA.meanMargin, 3),
      signed(variantB.meanMargin, 3)
    )
  )
  lines.push(
    row('sd margin', fixed(variantA.sdMargin, 3), fixed(variantB.sdMargin, 3))
  )
  lines.push(
    row(
      'mean tricks played',
      fixed(variantA.meanTricksPlayed, 2),
      fixed(variantB.meanTricksPlayed, 2)
    )
  )
  lines.push(
    row(
      'ms/decision (variant seats)',
      fixed(variantA.meanVariantDecisionMs, 3),
      fixed(variantB.meanVariantDecisionMs, 3)
    )
  )
  lines.push(
    row(
      'ms/decision (all seats)',
      fixed(variantA.meanDecisionMs, 3),
      fixed(variantB.meanDecisionMs, 3)
    )
  )
  lines.push(
    row(
      'total decisions',
      `${variantA.totalDecisions}`,
      `${variantB.totalDecisions}`
    )
  )
  lines.push(
    row(
      'strategy-throw fallback rate',
      fixed(variantA.fallbackRate, 4),
      fixed(variantB.fallbackRate, 4)
    )
  )

  lines.push('')
  lines.push(`${LOG_PREFIX} paired differences (B - A), 95% CI:`)
  for (const comparison of [
    paired.napoleonWinRate,
    paired.margin,
    paired.faceCards,
  ]) {
    lines.push(
      `  ${comparison.metric.padEnd(18)}${signed(comparison.meanDiff, 4).padStart(10)}  ` +
        `[${signed(comparison.ci95Lower, 4)}, ${signed(comparison.ci95Upper, 4)}]  ` +
        `se=${fixed(comparison.standardError, 4)}  n=${comparison.n}  ` +
        `${comparison.significant ? 'SIGNIFICANT' : 'not significant'}`
    )
  }

  if (bySuit.length > 0) {
    lines.push('')
    lines.push(`${LOG_PREFIX} breakdown by declared trump suit:`)
    lines.push(
      `  ${'suit'.padEnd(10)}${'n'.padStart(5)}${'A win'.padStart(9)}${'B win'.padStart(9)}` +
        `${'diff'.padStart(10)}${'A margin'.padStart(11)}${'B margin'.padStart(11)}${'diff'.padStart(10)}  95% CI (win rate)`
    )
    for (const entry of bySuit) {
      lines.push(
        `  ${entry.suit.padEnd(10)}${String(entry.games).padStart(5)}` +
          `${fixed(entry.aNapoleonWinRate, 4).padStart(9)}` +
          `${fixed(entry.bNapoleonWinRate, 4).padStart(9)}` +
          `${signed(entry.napoleonWinRate.meanDiff, 4).padStart(10)}` +
          `${signed(entry.aMeanMargin, 3).padStart(11)}` +
          `${signed(entry.bMeanMargin, 3).padStart(11)}` +
          `${signed(entry.margin.meanDiff, 3).padStart(10)}` +
          `  [${signed(entry.napoleonWinRate.ci95Lower, 4)}, ${signed(entry.napoleonWinRate.ci95Upper, 4)}]` +
          `${entry.napoleonWinRate.significant ? ' SIGNIFICANT' : ''}`
      )
    }
  }

  for (const variant of [variantA, variantB]) {
    if (variant.fallbackErrors.length === 0) continue
    lines.push('')
    lines.push(
      `${LOG_PREFIX} fallback causes (${variant.id}: ${variant.label}), top ${variant.fallbackErrors.length}:`
    )
    for (const entry of variant.fallbackErrors) {
      lines.push(`  ${String(entry.count).padStart(6)}  ${entry.signature}`)
    }
  }

  lines.push('')

  return lines.join('\n')
}

/** JSON 出力を書き出す */
export function writeJsonResult(path: string, result: ABResult): string {
  const absolute = resolve(path)
  mkdirSync(dirname(absolute), { recursive: true })
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
  return absolute
}
