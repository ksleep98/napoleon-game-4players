#!/usr/bin/env node

/**
 * Auto Polling Branch Cleanup
 * 定期的にGitHub APIをポーリングしてマージ済みブランチを自動削除
 */

const { exec } = require('node:child_process')
const { promisify } = require('node:util')

const execAsync = promisify(exec)

class AutoPollingCleanup {
  constructor(options = {}) {
    this.owner = 'ksleep98'
    this.repo = 'napoleon-game-4players'
    this.baseBranches = ['develop', 'main']
    this.pollInterval = options.pollInterval || 5 * 60 * 1000 // 5分
    this.lastCheck = new Date()
  }

  /**
   * ポーリングを開始
   */
  start() {
    console.log(
      `🔄 Starting auto-polling cleanup (every ${this.pollInterval / 1000}s)`
    )
    console.log(`📅 Last check: ${this.lastCheck.toISOString()}`)

    // 即座に1回実行
    this.checkForMergedBranches()

    // 定期実行を設定
    this.intervalId = setInterval(() => {
      this.checkForMergedBranches()
    }, this.pollInterval)

    return this
  }

  /**
   * ポーリングを停止
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      console.log('🛑 Auto-polling cleanup stopped')
    }
  }

  /**
   * マージ済みブランチをチェック
   */
  async checkForMergedBranches() {
    try {
      console.log(
        `🔍 Checking for merged PRs... (${new Date().toLocaleTimeString()})`
      )

      // 最後のチェック以降にマージされたPRを取得
      const since = this.lastCheck.toISOString()
      const mergedPRs = await this.getRecentlyMergedPRs(since)

      if (mergedPRs.length === 0) {
        console.log('ℹ️  No recently merged PRs found')
        this.lastCheck = new Date()
        return
      }

      console.log(`📋 Found ${mergedPRs.length} recently merged PRs`)

      let cleanupCount = 0
      for (const pr of mergedPRs) {
        const branchName = pr.head.ref

        if (this.baseBranches.includes(branchName)) {
          continue
        }

        if (await this.localBranchExists(branchName)) {
          console.log(`🔄 Processing merged PR #${pr.number}: ${branchName}`)
          await this.cleanupBranch(branchName, pr.base.ref)
          cleanupCount++
        }
      }

      if (cleanupCount > 0) {
        console.log(`✅ Cleaned up ${cleanupCount} branches automatically`)
      }

      this.lastCheck = new Date()
    } catch (error) {
      console.error('❌ Polling check failed:', error.message)
    }
  }

  /**
   * 最近マージされたPRを取得（GitHub MCP Server使用）
   */
  async getRecentlyMergedPRs(since) {
    try {
      // Note: 実際の実装ではGitHub MCP Serverのsearch_pull_requestsを使用
      const query = `is:merged base:develop merged:>=${since.split('T')[0]}`

      const { stdout } = await execAsync(`
        npx claude-mcp-server github search_pull_requests \\
          --owner ${this.owner} \\
          --repo ${this.repo} \\
          --query "${query}" \\
          --sort updated \\
          --order desc \\
          --perPage 10
      `)

      const result = JSON.parse(stdout)
      return result.items || []
    } catch (error) {
      console.error('GitHub API error:', error.message)
      return []
    }
  }

  /**
   * ローカルブランチの存在確認
   */
  async localBranchExists(branchName) {
    try {
      await execAsync(`git rev-parse --verify ${branchName}`)
      return true
    } catch {
      return false
    }
  }

  /**
   * ブランチクリーンアップを実行
   */
  async cleanupBranch(branchName, baseBranch) {
    try {
      // 現在のブランチを確認
      const { stdout: currentBranch } = await execAsync(
        'git rev-parse --abbrev-ref HEAD'
      )
      const current = currentBranch.trim()

      // ベースブランチに切り替え（必要に応じて）
      if (current === branchName) {
        console.log(`🔄 Switching from ${branchName} to ${baseBranch}`)
        await execAsync(`git checkout ${baseBranch}`)
      }

      // ベースブランチを最新に更新
      await execAsync(`git pull origin ${baseBranch}`)

      // ローカルブランチを削除
      try {
        await execAsync(`git branch -d ${branchName}`)
        console.log(`✅ Deleted local branch: ${branchName}`)
      } catch (_error) {
        await execAsync(`git branch -D ${branchName}`)
        console.log(`✅ Force deleted local branch: ${branchName}`)
      }

      // リモート追跡ブランチを削除
      try {
        await execAsync(`git branch -dr origin/${branchName}`)
      } catch (_error) {
        // Already cleaned up
      }

      // リモート参照をクリーンアップ
      await execAsync('git remote prune origin')
    } catch (error) {
      console.error(`❌ Failed to cleanup branch ${branchName}:`, error.message)
    }
  }
}

// CLI実行
if (require.main === module) {
  const pollInterval = parseInt(process.argv[2]) || 5 * 60 * 1000 // デフォルト5分

  const cleanup = new AutoPollingCleanup({ pollInterval })
  cleanup.start()

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down auto-polling cleanup...')
    cleanup.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    cleanup.stop()
    process.exit(0)
  })
}

module.exports = AutoPollingCleanup
