#!/usr/bin/env node
/**
 * developブランチ保護スクリプト
 * Git Hooksを設定してdevelopブランチへの直接コミット/プッシュを防ぐ
 */

import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const projectRoot = join(__dirname, '..')
const hooksDir = join(projectRoot, '.git', 'hooks')

// Pre-commit hook content
const preCommitHook = `#!/bin/sh
# Prevent direct commits to develop branch
current_branch=$(git rev-parse --abbrev-ref HEAD)
if [ "$current_branch" = "develop" ]; then
    echo ""
    echo "❌ Error: Direct commits to develop branch are not allowed"
    echo ""
    echo "🔧 To fix this:"
    echo "  1. Create a feature branch: git checkout -b feature/your-feature-name"
    echo "  2. Or switch to existing branch: git checkout your-branch-name"
    echo ""
    echo "📝 Current staged changes will be preserved when you switch branches"
    echo ""
    exit 1
fi

# Continue with original pre-commit checks if they exist
if [ -f ".git/hooks/pre-commit.original" ]; then
    exec .git/hooks/pre-commit.original "$@"
fi
`

// Pre-push hook content
const prePushHook = `#!/bin/sh
# Prevent direct push to develop branch
while read local_ref local_sha remote_ref remote_sha
do
    branch_name=$(echo "$remote_ref" | sed 's|refs/heads/||')
    if [ "$branch_name" = "develop" ]; then
        echo ""
        echo "❌ Error: Direct push to develop branch is not allowed"
        echo ""
        echo "🔧 To fix this:"
        echo "  1. Use Pull Request workflow"
        echo "  2. Push to feature branch: git push origin feature/your-feature-name"
        echo "  3. Create PR from GitHub: develop ← feature/your-feature-name"
        echo ""
        exit 1
    fi
done
`

async function setupHooks() {
  try {
    // .git/hooks ディレクトリの存在確認
    try {
      await fs.access(hooksDir)
    } catch {
      console.log('❌ Error: .git/hooks directory not found')
      console.log('This script must be run from a Git repository root')
      process.exit(1)
    }

    console.log('🔧 Setting up develop branch protection...')

    // 既存のpre-commitフックをバックアップ
    const preCommitPath = join(hooksDir, 'pre-commit')
    const preCommitBackupPath = join(hooksDir, 'pre-commit.original')

    try {
      await fs.access(preCommitPath)
      await fs.copyFile(preCommitPath, preCommitBackupPath)
      console.log('📁 Backed up existing pre-commit hook')
    } catch {
      // No existing hook
    }

    // Pre-commit hook を作成
    await fs.writeFile(preCommitPath, preCommitHook, { mode: 0o755 })
    console.log('✅ Created pre-commit hook (prevents commits to develop)')

    // Pre-push hook を作成
    const prePushPath = join(hooksDir, 'pre-push')
    await fs.writeFile(prePushPath, prePushHook, { mode: 0o755 })
    console.log('✅ Created pre-push hook (prevents push to develop)')

    console.log('')
    console.log('🛡️  Develop branch protection is now active!')
    console.log('')
    console.log('📋 What this does:')
    console.log('  • Prevents direct commits to develop branch')
    console.log('  • Prevents direct push to develop branch')
    console.log('  • Encourages feature branch workflow')
    console.log('')
    console.log('🔧 To disable protection:')
    console.log('  pnpm run develop:unprotect')
    console.log('')
  } catch (error) {
    console.error('❌ Error setting up hooks:', error.message)
    process.exit(1)
  }
}

async function removeHooks() {
  try {
    console.log('🔧 Removing develop branch protection...')

    const preCommitPath = join(hooksDir, 'pre-commit')
    const preCommitBackupPath = join(hooksDir, 'pre-commit.original')
    const prePushPath = join(hooksDir, 'pre-push')

    // Pre-commit hook を削除/復元
    try {
      await fs.access(preCommitBackupPath)
      await fs.copyFile(preCommitBackupPath, preCommitPath)
      await fs.unlink(preCommitBackupPath)
      console.log('✅ Restored original pre-commit hook')
    } catch {
      try {
        await fs.unlink(preCommitPath)
        console.log('✅ Removed pre-commit hook')
      } catch {
        // No hook to remove
      }
    }

    // Pre-push hook を削除
    try {
      await fs.unlink(prePushPath)
      console.log('✅ Removed pre-push hook')
    } catch {
      // No hook to remove
    }

    console.log('')
    console.log('🔓 Develop branch protection removed')
    console.log('')
  } catch (error) {
    console.error('❌ Error removing hooks:', error.message)
    process.exit(1)
  }
}

async function checkStatus() {
  try {
    const preCommitPath = join(hooksDir, 'pre-commit')
    const prePushPath = join(hooksDir, 'pre-push')

    console.log('🔍 Develop branch protection status:')
    console.log('')

    try {
      const preCommitContent = await fs.readFile(preCommitPath, 'utf8')
      const hasProtection = preCommitContent.includes(
        'Direct commits to develop branch are not allowed'
      )
      console.log(
        `  Pre-commit protection: ${hasProtection ? '✅ Active' : '❌ Inactive'}`
      )
    } catch {
      console.log('  Pre-commit protection: ❌ Inactive')
    }

    try {
      const prePushContent = await fs.readFile(prePushPath, 'utf8')
      const hasProtection = prePushContent.includes(
        'Direct push to develop branch is not allowed'
      )
      console.log(
        `  Pre-push protection: ${hasProtection ? '✅ Active' : '❌ Inactive'}`
      )
    } catch {
      console.log('  Pre-push protection: ❌ Inactive')
    }

    console.log('')
  } catch (error) {
    console.error('❌ Error checking status:', error.message)
    process.exit(1)
  }
}

// コマンドライン引数の処理
const command = process.argv[2]

switch (command) {
  case 'enable':
  case 'setup':
    await setupHooks()
    break
  case 'disable':
  case 'remove':
  case 'unprotect':
    await removeHooks()
    break
  case 'status':
  case 'check':
    await checkStatus()
    break
  default:
    console.log('🛡️  Develop Branch Protection Tool')
    console.log('')
    console.log('Usage:')
    console.log('  node scripts/setup-develop-protection.js <command>')
    console.log('')
    console.log('Commands:')
    console.log(
      '  enable    Setup protection (prevent commits/push to develop)'
    )
    console.log('  disable   Remove protection')
    console.log('  status    Check current protection status')
    console.log('')
    console.log('Or use npm scripts:')
    console.log('  pnpm run develop:protect')
    console.log('  pnpm run develop:unprotect')
    console.log('  pnpm run develop:status')
    break
}
