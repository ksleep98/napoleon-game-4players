#!/usr/bin/env node

// 自動サーバー起動付きE2Eテスト実行スクリプト
const { spawn, execSync } = require('node:child_process')
const net = require('node:net')
const _path = require('node:path')

const PORT = 3000
const SERVER_URL = `http://localhost:${PORT}`

console.log('🚀 Starting E2E tests with automatic server management...')

// ポートが使用中かチェック
function checkPortInUse(port) {
  return new Promise((resolve) => {
    console.log(`🔍 Attempting to bind to port ${port}...`)
    const server = net.createServer()

    server.listen(port, (err) => {
      if (err) {
        console.log(`❌ Port ${port} bind failed: ${err.message}`)
        server.close()
        resolve(true) // ポートが使用中
      } else {
        console.log(`✅ Port ${port} is available`)
        server.close()
        resolve(false) // ポートが空いている
      }
    })

    server.on('error', (err) => {
      console.log(`❌ Port ${port} error: ${err.code || err.message}`)
      resolve(true) // ポートが使用中
    })
  })
}

// より厳密なサーバー健全性チェック（HTMLコンテンツを検証）
function waitForServer(url, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now()
    let attempts = 0

    const check = () => {
      attempts++
      const elapsed = Date.now() - startTime
      console.log(
        `🔍 Server check attempt ${attempts} (${Math.round(elapsed / 1000)}s elapsed)`
      )

      const http = require('node:http')
      const req = http.get(url, (res) => {
        console.log(
          `📡 Server response: ${res.statusCode} ${res.statusMessage}`
        )

        if (res.statusCode === 200) {
          let data = ''
          res.on('data', (chunk) => {
            data += chunk
          })
          res.on('end', () => {
            // HTMLコンテンツが実際に返されているかチェック
            if (data.includes('<html') || data.includes('<!DOCTYPE html')) {
              console.log(
                `✅ Server is ready at ${url} (${res.statusCode}) with valid HTML content`
              )
              resolve()
            } else {
              console.log(
                `⚠️ Server responding but content invalid (${data.length} chars)`
              )
              if (Date.now() - startTime > timeout) {
                reject(
                  new Error(
                    `Server content validation timeout after ${timeout}ms`
                  )
                )
              } else {
                setTimeout(check, 2000)
              }
            }
          })
        } else if (res.statusCode === 404) {
          console.log(`✅ Server is ready at ${url} (${res.statusCode})`)
          resolve()
        } else {
          console.log(`⏳ Waiting for server (got ${res.statusCode})...`)
          setTimeout(check, 1000)
        }
      })

      req.on('error', (err) => {
        console.log(`❌ Server check error: ${err.code || err.message}`)
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Server startup timeout after ${timeout}ms`))
        } else {
          console.log(`⏳ Retrying server check in 2 seconds...`)
          setTimeout(check, 2000)
        }
      })

      req.setTimeout(10000, () => {
        console.log(`⏰ Request timeout (10s), retrying...`)
        req.abort()
      })
    }

    check()
  })
}

// 問題のあるサーバープロセスを検出・終了
function killHungServer(port) {
  try {
    console.log(`🔍 Checking for hung processes on port ${port}...`)
    const pids = execSync(`lsof -ti:${port} 2>/dev/null || true`, {
      encoding: 'utf8',
    }).trim()

    if (pids) {
      const pidList = pids.split('\n').filter((pid) => pid)
      console.log(
        `🛑 Found ${pidList.length} process(es) on port ${port}: ${pidList.join(', ')}`
      )

      for (const pid of pidList) {
        try {
          console.log(`💀 Force killing process ${pid}...`)
          execSync(`kill -9 ${pid}`, { encoding: 'utf8' })
          console.log(`✅ Process ${pid} killed`)
        } catch (error) {
          console.log(`⚠️ Could not kill process ${pid}: ${error.message}`)
        }
      }

      // プロセス終了を少し待つ
      console.log(`⏳ Waiting for cleanup...`)
      setTimeout(() => {}, 1000)

      return true
    }

    return false
  } catch (error) {
    console.log(`❌ Error checking for hung processes: ${error.message}`)
    return false
  }
}

async function main() {
  let serverProcess = null
  const _serverWasRunning = false

  try {
    console.log(`🔍 Checking port ${PORT} availability...`)

    // ポート使用状況をチェック
    const portInUse = await checkPortInUse(PORT)
    console.log(`📋 Port ${PORT} in use: ${portInUse}`)

    if (portInUse) {
      console.log('🟡 Port 3000 is occupied')
      console.log(
        '🛠️ For E2E testing reliability, forcing fresh server start...'
      )

      // Always kill existing processes for clean E2E testing
      console.log('🗑️ Cleaning up existing server processes...')
      const killedProcesses = killHungServer(PORT)
      if (killedProcesses) {
        console.log('✅ Server processes cleaned up')
      } else {
        console.log('💡 No processes found to clean up')
      }

      console.log('⏳ Waiting for port to be freed...')
      await new Promise((resolve) => setTimeout(resolve, 3000))

      // 再度ポート確認
      const portStillInUse = await checkPortInUse(PORT)
      if (!portStillInUse) {
        console.log('🔄 Port is now free - will start fresh server')
      } else {
        console.log(
          '⚠️ Port still occupied after cleanup - this may cause issues'
        )
        // Continue anyway as we've done our best to clean up
      }
    } else {
      console.log('🔴 Port 3000 is available - will start development server')
    }

    // Always start a fresh server for E2E tests
    console.log('🔄 Starting fresh development server for E2E testing...')

    // 開発サーバーを起動
    serverProcess = spawn('pnpm', ['dev'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_ENV: 'development',
        PORT: PORT.toString(),
        NEXT_TELEMETRY_DISABLED: '1',
      },
    })

    // サーバーが起動するまで待機
    console.log('⏳ Waiting for server to be ready...')
    await waitForServer(SERVER_URL, 60000)

    // E2Eテストを実行
    console.log('🧪 Starting E2E tests...')
    console.log(`📁 Working directory: ${process.cwd()}`)
    console.log(`🌐 Server URL: ${SERVER_URL}`)

    const testArgs = process.argv.slice(2)
    const testCommand = testArgs.length > 0 ? testArgs : ['--reporter=line']

    console.log(
      `📋 Test command: pnpm exec playwright test ${testCommand.join(' ')}`
    )
    console.log(`🌍 Environment: NODE_ENV=test, PLAYWRIGHT_SKIP_WEBSERVER=1`)

    const testProcess = spawn(
      'pnpm',
      ['exec', 'playwright', 'test', ...testCommand],
      {
        stdio: 'inherit',
        env: {
          ...process.env,
          PLAYWRIGHT_SKIP_WEBSERVER: '1', // 手動でサーバーを管理
          NODE_ENV: 'test',
        },
      }
    )

    console.log(`🏃 Test process started with PID: ${testProcess.pid}`)

    // テストの完了を待機
    const testExitCode = await new Promise((resolve) => {
      testProcess.on('close', (code) => {
        console.log(`🏁 Test process completed with exit code: ${code}`)
        resolve(code)
      })

      testProcess.on('error', (error) => {
        console.error(`💥 Test process error: ${error.message}`)
        resolve(1)
      })
    })

    if (testExitCode === 0) {
      console.log('✅ E2E tests completed successfully!')

      // テストレポート生成
      console.log('📋 Generating test report...')
      try {
        const reportGenerator = require('./generate-e2e-report.js')
        const reportFile = reportGenerator.generateTestReport()
        console.log(`📄 Test report saved to: ${reportFile}`)
      } catch (error) {
        console.log(`⚠️ Report generation failed: ${error.message}`)
      }
    } else {
      console.log('❌ E2E tests failed')
    }

    process.exit(testExitCode)
  } catch (error) {
    console.error('💥 Error during E2E test execution:', error.message)
    process.exit(1)
  } finally {
    // サーバーを停止（常に自分で起動したサーバーを停止）
    if (serverProcess) {
      console.log('🛑 Stopping development server...')
      serverProcess.kill('SIGTERM')

      // Graceful shutdown を待つ
      setTimeout(() => {
        if (!serverProcess.killed) {
          console.log('💀 Force killing server...')
          serverProcess.kill('SIGKILL')
        }
      }, 3000)
    }
  }
}

// エラーハンドリング
process.on('SIGINT', () => {
  console.log('\n🛑 Process interrupted')
  process.exit(1)
})

process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught exception:', error)
  process.exit(1)
})

main().catch((error) => {
  console.error('💥 Fatal error:', error)
  process.exit(1)
})
