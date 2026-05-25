/**
 * Lightweight smoke test: boots the built Next.js app and verifies the
 * homepage responds with 200. Purpose is to catch obviously broken builds
 * (missing pages, runtime crashes on boot, dep mismatches) much faster than
 * the full Playwright suite.
 *
 * Prerequisites:
 *   pnpm build       # produces .next/
 *
 * Usage:
 *   pnpm smoke
 *
 * Optional env:
 *   SMOKE_PORT       (default: 3100 to avoid clashing with vercel dev on 3000)
 *   SMOKE_TIMEOUT_MS (default: 30000 — server-ready timeout)
 *   SMOKE_PATHS      (default: '/' — comma-separated paths to check)
 */

import { type ChildProcess, spawn } from 'node:child_process'
import { setTimeout as wait } from 'node:timers/promises'

const PORT = process.env.SMOKE_PORT || '3100'
const HOST = `http://127.0.0.1:${PORT}`
const STARTUP_TIMEOUT_MS = Number.parseInt(
  process.env.SMOKE_TIMEOUT_MS || '30000',
  10
)
const PATHS = (process.env.SMOKE_PATHS || '/').split(',').map((p) => p.trim())

async function waitForReady(timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  let lastError: string = 'never connected'
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${HOST}/`, {
        signal: AbortSignal.timeout(2_000),
      })
      if (res.status < 500) return
      lastError = `HTTP ${res.status}`
    } catch (err) {
      lastError = (err as Error).message
    }
    await wait(500)
  }
  throw new Error(
    `Server did not become ready within ${timeoutMs}ms (last: ${lastError})`
  )
}

async function check(path: string): Promise<void> {
  const url = `${HOST}${path}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  if (res.status !== 200) {
    throw new Error(`GET ${path} -> ${res.status} (expected 200)`)
  }
  const body = await res.text()
  if (!body.includes('<html')) {
    throw new Error(`GET ${path} -> 200 but body does not look like HTML`)
  }
  console.log(`[smoke] ✓ GET ${path} -> 200 (${body.length} bytes)`)
}

let server: ChildProcess | undefined

function shutdown(): void {
  if (!server || server.killed) return
  console.log('[smoke] stopping server...')
  server.kill('SIGTERM')
}

process.on('SIGINT', () => {
  shutdown()
  process.exit(130)
})
process.on('SIGTERM', () => {
  shutdown()
  process.exit(143)
})

async function main() {
  console.log(`[smoke] booting "next start" on port ${PORT}...`)
  server = spawn('pnpm', ['exec', 'next', 'start', '-p', PORT], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
  })

  server.on('exit', (code, signal) => {
    if (code !== null && code !== 0) {
      console.error(
        `[smoke] server exited unexpectedly (code=${code} signal=${signal})`
      )
      process.exit(1)
    }
  })

  try {
    await waitForReady(STARTUP_TIMEOUT_MS)
    console.log('[smoke] server is up; running checks...')
    for (const path of PATHS) {
      await check(path)
    }
    console.log('[smoke] ✅ all checks passed')
  } finally {
    shutdown()
    // Brief grace period so SIGTERM can land.
    await wait(500)
  }
}

main().catch((err) => {
  console.error('[smoke] ❌', (err as Error).message)
  shutdown()
  process.exit(1)
})
