#!/usr/bin/env node

/**
 * GitHub Webhook Auto Branch Cleanup
 * PRマージ時にローカルブランチを自動削除するWebhookハンドラー
 */

const { exec } = require('node:child_process')
const { promisify } = require('node:util')
const execAsync = promisify(exec)

class GitHubWebhookCleanup {
  constructor() {
    this.baseBranches = ['develop', 'main']
  }

  /**
   * PRマージイベントを処理
   */
  async handlePullRequestMerge(payload) {
    const { pull_request: pr, action } = payload

    if (action !== 'closed' || !pr.merged) {
      console.log('PR not merged, skipping cleanup')
      return
    }

    const branchName = pr.head.ref
    const baseBranch = pr.base.ref

    if (this.baseBranches.includes(branchName)) {
      console.log(`Base branch ${branchName} - skipping deletion`)
      return
    }

    console.log(`🔄 Processing merged PR: ${branchName} → ${baseBranch}`)

    try {
      await this.cleanupBranch(branchName, baseBranch)
      console.log('✅ Branch cleanup completed successfully')
    } catch (error) {
      console.error('❌ Branch cleanup failed:', error.message)
    }
  }

  /**
   * ブランチクリーンアップを実行
   */
  async cleanupBranch(branchName, baseBranch) {
    // 1. 現在のブランチを確認
    const { stdout: currentBranch } = await execAsync(
      'git rev-parse --abbrev-ref HEAD'
    )
    const current = currentBranch.trim()

    // 2. ベースブランチに切り替え
    if (current === branchName) {
      console.log(`🔄 Switching from ${branchName} to ${baseBranch}`)
      await execAsync(`git checkout ${baseBranch}`)
    }

    // 3. ベースブランチを最新に更新
    console.log(`🔄 Updating ${baseBranch} branch`)
    await execAsync(`git pull origin ${baseBranch}`)

    // 4. ローカルブランチを削除
    try {
      console.log(`🗑️  Deleting local branch: ${branchName}`)
      await execAsync(`git branch -d ${branchName}`)
    } catch (_error) {
      // 強制削除を試行
      console.log(`🗑️  Force deleting local branch: ${branchName}`)
      await execAsync(`git branch -D ${branchName}`)
    }

    // 5. リモート追跡ブランチを削除
    try {
      console.log(`🗑️  Cleaning up remote tracking: origin/${branchName}`)
      await execAsync(`git branch -dr origin/${branchName}`)
    } catch (_error) {
      // リモート追跡ブランチが存在しない場合は無視
      console.log('Remote tracking branch already cleaned up')
    }

    // 6. プルーンでリモート参照をクリーンアップ
    await execAsync('git remote prune origin')

    console.log(`✅ Successfully cleaned up branch: ${branchName}`)
  }

  /**
   * 手動実行用: マージ済みブランチを検出して削除
   */
  async cleanupMergedBranches() {
    console.log('🔍 Checking for merged branches...')

    try {
      // マージ済みのローカルブランチを取得
      const { stdout } = await execAsync('git branch --merged develop')
      const mergedBranches = stdout
        .split('\n')
        .map((branch) => branch.trim().replace(/^\*\s*/, ''))
        .filter(
          (branch) =>
            branch &&
            !this.baseBranches.includes(branch) &&
            branch.startsWith('feature/')
        )

      if (mergedBranches.length === 0) {
        console.log('✅ No merged feature branches found')
        return
      }

      console.log(
        `Found ${mergedBranches.length} merged branches:`,
        mergedBranches
      )

      for (const branch of mergedBranches) {
        await this.cleanupBranch(branch, 'develop')
      }
    } catch (error) {
      console.error('❌ Failed to cleanup merged branches:', error.message)
    }
  }
}

// CLI実行時の処理
if (require.main === module) {
  const cleanup = new GitHubWebhookCleanup()

  // 引数に基づいて実行モードを決定
  const mode = process.argv[2]

  if (mode === 'manual') {
    cleanup.cleanupMergedBranches()
  } else if (mode === 'webhook') {
    // Webhook payloadを標準入力から読み取り
    let payload = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      payload += chunk
    })
    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(payload)
        cleanup.handlePullRequestMerge(data)
      } catch (error) {
        console.error('❌ Invalid webhook payload:', error.message)
        process.exit(1)
      }
    })
  } else {
    console.log('Usage:')
    console.log(
      '  node scripts/github-webhook-cleanup.js manual   # Manual cleanup'
    )
    console.log(
      '  echo "payload" | node scripts/github-webhook-cleanup.js webhook'
    )
  }
}

module.exports = GitHubWebhookCleanup
