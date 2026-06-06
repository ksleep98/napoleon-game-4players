#!/usr/bin/env node

// ヘッドレス AI 対 AI シミュレータ (scripts/simulate-games.ts) のラッパー。
//
// 方針: ローカルに永続的な .env を置かない (vercel dev / Vercel 管理で一元化)。
// そのため Supabase 認証情報は実行のたびに `vercel env pull` で OS の一時ファイル
// にだけ取得し、実行後に必ず削除する。リポジトリ内には env ファイルを残さない。
//
// すでに環境変数が注入されている場合 (vercel dev 経由・CI・手動 export) は
// pull をスキップしてそのまま実行する。
//
// Usage:
//   pnpm sim          # 1 game
//   pnpm sim 200      # 200 games
//   NEXT_PUBLIC_AI_DIFFICULTY=hard pnpm sim 100

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const SIM_SCRIPT = path.join(__dirname, 'simulate-games.ts')
const passthroughArgs = process.argv.slice(2)

// シミュレータが必要とする最低限の認証情報。両方そろっていれば pull 不要。
const hasCreds =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY

function runTsx(extraArgs) {
  const result = spawnSync(
    'pnpm',
    ['exec', 'tsx', ...extraArgs, SIM_SCRIPT, ...passthroughArgs],
    { stdio: 'inherit' }
  )
  if (result.error) {
    console.error('[run-sim] failed to launch tsx:', result.error.message)
    return 1
  }
  return result.status ?? 1
}

function main() {
  if (hasCreds) {
    console.log('[run-sim] Supabase env already present — running directly.')
    process.exit(runTsx([]))
  }

  // 一時ファイルへ env を pull → --env-file で読ませる → 実行後に必ず削除。
  // 注意: try/finally で process.exit を呼ぶと finally が走らないため、
  // 終了コードを変数に保持し、削除を済ませてから最後に exit する。
  const tmpEnv = path.join(os.tmpdir(), `napoleon-sim-env-${process.pid}`)
  console.log('[run-sim] Pulling Vercel env to a temp file (not persisted)...')

  const pull = spawnSync(
    'vercel',
    ['env', 'pull', tmpEnv, '--environment=development', '--yes'],
    { stdio: 'inherit' }
  )

  let status
  if (pull.error || pull.status !== 0) {
    console.error(
      '[run-sim] `vercel env pull` failed. Are you logged in? Try: vercel login'
    )
    status = pull.status ?? 1
  } else {
    status = runTsx([`--env-file=${tmpEnv}`])
  }

  // 認証情報を含む一時ファイルを必ず削除する。
  try {
    fs.rmSync(tmpEnv, { force: true })
  } catch (err) {
    console.warn(
      `[run-sim] warning: could not remove temp env file ${tmpEnv}: ${err.message}`
    )
  }

  process.exit(status)
}

main()
