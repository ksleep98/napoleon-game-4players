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

// pull 先の一時ディレクトリ。cleanup() から参照するためモジュールスコープに置く。
let tmpDir = null
let cleanedUp = false

/**
 * 認証情報を含む一時ディレクトリを削除する。
 *
 * 冪等: シグナル → exit と二重に呼ばれても安全。
 * SIGINT / SIGTERM / SIGHUP からも呼ぶ必要がある。長時間走るシミュレーションを
 * Ctrl-C で止めるのは日常操作であり、そこで SUPABASE_SERVICE_ROLE_KEY が
 * tmp に平文で残るのを防ぐため。
 */
function cleanup() {
  if (cleanedUp || !tmpDir) return
  cleanedUp = true
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch (err) {
    console.warn(
      `[run-sim] warning: could not remove temp env dir ${tmpDir}: ${err.message}`
    )
  }
}

function installCleanupHandlers() {
  process.on('exit', cleanup)
  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(signal, () => {
      cleanup()
      // 128 + シグナル番号 が慣例。SIGINT=2 → 130。
      process.exit(signal === 'SIGINT' ? 130 : 143)
    })
  }
  process.on('uncaughtException', (err) => {
    cleanup()
    throw err
  })
}

function main() {
  if (hasCreds) {
    console.log('[run-sim] Supabase env already present — running directly.')
    process.exit(runTsx([]))
  }

  installCleanupHandlers()

  // 一時ディレクトリへ env を pull → --env-file で読ませる → 必ず削除。
  //
  // mkdtempSync は 0700 のディレクトリをランダム名で作る。os.tmpdir() 直下に
  // PID ベースの予測可能なパスで置くと、Linux コンテナ (/tmp は 1777) で
  // 他ユーザーから service role key を読まれる。Docker 環境を公式サポート
  // しているため、macOS の /var/folders (0700) 前提にはできない。
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'napoleon-sim-'))
  const tmpEnv = path.join(tmpDir, '.env')
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
    // vercel が作ったファイルは 0644 のことがあるため、自分で 0600 に落とす。
    try {
      fs.chmodSync(tmpEnv, 0o600)
    } catch (err) {
      console.warn(
        `[run-sim] warning: could not chmod temp env file: ${err.message}`
      )
    }
    status = runTsx([`--env-file=${tmpEnv}`])
  }

  cleanup()
  process.exit(status)
}

main()
