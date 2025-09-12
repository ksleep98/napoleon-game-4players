#!/usr/bin/env node

// Port 3000を占有しているプロセスを確認・終了するスクリプト
const { execSync } = require('node:child_process')

console.log('🔍 Checking processes using port 3000...')

try {
  // macOS/Linuxでポート3000を使用しているプロセスを確認
  const output = execSync('lsof -ti:3000 2>/dev/null || true', {
    encoding: 'utf8',
  })

  if (output.trim()) {
    const pids = output
      .trim()
      .split('\n')
      .filter((pid) => pid)
    console.log(`🎯 Found ${pids.length} process(es) using port 3000:`)

    for (const pid of pids) {
      try {
        // プロセス情報を取得
        const processInfo = execSync(
          `ps -p ${pid} -o pid,ppid,command 2>/dev/null || true`,
          { encoding: 'utf8' }
        )
        console.log(`📋 PID ${pid}:`)
        console.log(processInfo)
      } catch (_error) {
        console.log(`⚠️ Could not get info for PID ${pid}`)
      }
    }

    console.log('')
    console.log('🛑 To kill these processes, run:')
    console.log(`   kill ${pids.join(' ')}`)
    console.log('')
    console.log('🔄 Or to kill them now:')

    const readline = require('node:readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    rl.question('Kill processes now? (y/N): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        try {
          execSync(`kill ${pids.join(' ')}`)
          console.log('✅ Processes killed successfully')
          setTimeout(() => {
            console.log('🔍 Checking if port is now free...')
            try {
              const checkOutput = execSync(
                'lsof -ti:3000 2>/dev/null || true',
                { encoding: 'utf8' }
              )
              if (checkOutput.trim()) {
                console.log('⚠️ Port 3000 is still occupied')
                console.log(
                  `💡 You may need to use: kill -9 ${checkOutput.trim()}`
                )
              } else {
                console.log('✅ Port 3000 is now free!')
              }
            } catch (_error) {
              console.log('✅ Port 3000 appears to be free')
            }
          }, 1000)
        } catch (error) {
          console.error('❌ Failed to kill processes:', error.message)
        }
      } else {
        console.log('📋 Processes left running')
      }
      rl.close()
    })
  } else {
    console.log('✅ No processes found using port 3000')
    console.log('🎯 Port 3000 is available')
  }
} catch (error) {
  console.error('❌ Error checking port usage:', error.message)
  console.log('💡 Try running manually: lsof -ti:3000')
}
