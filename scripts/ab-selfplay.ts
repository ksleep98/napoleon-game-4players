/**
 * オフライン A/B セルフプレイ計測ハーネス（CLI エントリ）。
 *
 * Usage:
 *   pnpm sim:ab --help
 *   pnpm sim:ab --games 200 --seed 42 --a hybrid --b mcts:strong --variant-role napoleon-team
 *   pnpm sim:ab --games 50 --a heuristic --b mcts:fast --sims 30 --det 2 --json /tmp/ab.json
 *
 * 既存の `pnpm sim` (scripts/simulate-games.ts) とは目的が異なる別物:
 *   - `pnpm sim`    : ML 学習データを Supabase に蓄積する（認証情報必須・全席同一 AI）
 *   - `pnpm sim:ab` : AI の強さを A/B で計測する（ネットワーク非依存・再現可能）
 *
 * このスクリプトはネットワーク・Supabase・ML API に一切アクセスしないため、
 * 環境変数なしで実行できる。
 */

import {
  formatSummary,
  helpText,
  parseArgs,
  writeJsonResult,
} from '@/lib/ab/cli'
import { LOG_PREFIX } from '@/lib/ab/constants'
import { runAB } from '@/lib/ab/harness'

function main(): void {
  let parsed: ReturnType<typeof parseArgs>

  try {
    parsed = parseArgs(process.argv.slice(2))
  } catch (error) {
    console.error(`${LOG_PREFIX} ${(error as Error).message}`)
    console.error(helpText())
    process.exit(1)
    return
  }

  if (parsed.help) {
    console.log(helpText())
    return
  }

  const { options, jsonPath } = parsed

  console.log(
    `${LOG_PREFIX} starting ${options.games} paired game(s)  ` +
      `A=${options.variantA.label}  B=${options.variantB.label}  ` +
      `baseline=${options.baseline.label}  role=${options.variantRole}  seed=${options.seed}`
  )

  const result = runAB(options)

  console.log(formatSummary(result))

  if (jsonPath) {
    const written = writeJsonResult(jsonPath, result)
    console.log(`${LOG_PREFIX} wrote JSON result to ${written}`)
  }

  if (result.meta.games === 0) {
    console.error(`${LOG_PREFIX} no games completed`)
    process.exit(1)
  }
}

main()
