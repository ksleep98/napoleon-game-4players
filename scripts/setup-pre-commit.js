#!/usr/bin/env node

// Pre-commit設定選択スクリプト
const fs = require('node:fs')
const path = require('node:path')
const readline = require('node:readline')

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const HUSKY_DIR = path.join(__dirname, '..', '.husky')
const PRE_COMMIT_PATH = path.join(HUSKY_DIR, 'pre-commit')
const PRE_COMMIT_E2E_PATH = path.join(HUSKY_DIR, 'pre-commit-e2e')

console.log('🔧 Pre-commit Hook Setup')
console.log('========================')
console.log('')
console.log('Choose your preferred pre-commit configuration:')
console.log('')
console.log('1. 🏃 Fast (current): Type check + Unit tests (2-3 minutes)')
console.log('2. 🔍 Complete: Fast + E2E tests (5-8 minutes)')
console.log('3. ⚡ Minimal: Only linting + formatting (30 seconds)')
console.log('4. 🚫 Disable: No pre-commit hooks')
console.log('')

rl.question('Select option (1-4): ', (answer) => {
  const choice = parseInt(answer, 10)

  switch (choice) {
    case 1:
      setupFastPreCommit()
      break
    case 2:
      setupCompletePreCommit()
      break
    case 3:
      setupMinimalPreCommit()
      break
    case 4:
      disablePreCommit()
      break
    default:
      console.log('❌ Invalid choice. Keeping current configuration.')
      break
  }

  rl.close()
})

function setupFastPreCommit() {
  // 現在の設定を維持
  console.log('✅ Fast pre-commit configuration is already active')
  console.log('📋 Includes: Linting, formatting, type check, unit tests')
  console.log('⏱️ Estimated time: 2-3 minutes')
}

function setupCompletePreCommit() {
  try {
    // E2E版のpre-commitをコピー
    const e2eContent = fs.readFileSync(PRE_COMMIT_E2E_PATH, 'utf8')
    fs.writeFileSync(PRE_COMMIT_PATH, e2eContent)

    console.log('✅ Complete pre-commit configuration activated')
    console.log(
      '📋 Includes: Linting, formatting, type check, unit tests, E2E tests'
    )
    console.log('⏱️ Estimated time: 5-8 minutes')
    console.log('')
    console.log('💡 E2E tests will run with automatic server startup')
    console.log('   If E2E tests fail, you can choose to continue with commit')
  } catch (error) {
    console.error('❌ Failed to setup complete pre-commit:', error.message)
  }
}

function setupMinimalPreCommit() {
  const minimalContent = `#!/bin/sh

echo "⚡ Running minimal pre-commit checks..."

# Run lint-staged for automatic fixes only
echo "📝 Running automatic fixes on staged files..."
npx lint-staged

echo "✅ Minimal pre-commit checks completed!"
echo "🎉 Ready to commit!"
`

  try {
    fs.writeFileSync(PRE_COMMIT_PATH, minimalContent)
    console.log('✅ Minimal pre-commit configuration activated')
    console.log('📋 Includes: Only linting and formatting of staged files')
    console.log('⏱️ Estimated time: 30 seconds')
  } catch (error) {
    console.error('❌ Failed to setup minimal pre-commit:', error.message)
  }
}

function disablePreCommit() {
  const disabledContent = `#!/bin/sh

echo "🚫 Pre-commit hooks are disabled"
echo "🎉 Committing without checks..."
`

  try {
    fs.writeFileSync(PRE_COMMIT_PATH, disabledContent)
    console.log('✅ Pre-commit hooks disabled')
    console.log('⚠️ Quality checks will only run in CI/CD')
    console.log(
      '💡 You can re-enable anytime with: node scripts/setup-pre-commit.js'
    )
  } catch (error) {
    console.error('❌ Failed to disable pre-commit:', error.message)
  }
}
