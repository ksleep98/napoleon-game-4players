#!/usr/bin/env node

/**
 * GitHub MCP Server連携 自動ブランチクリーンアップ
 * PRマージ状態をGitHub APIで確認してローカルブランチを削除
 */

const { exec } = require('node:child_process')
const { promisify } = require('node:util')
const execAsync = promisify(exec)

class AutoBranchCleanup {
  constructor() {
    this.owner = 'ksleep98'
    this.repo = 'napoleon-game-4players'
    this.baseBranches = ['develop', 'main']
  }

  /**
   * GitHub MCP Serverを使用してマージ済みPRを取得
   */
  async getMergedPRs() {
    try {
      // GitHub MCP Serverで最近マージされたPRを取得
      const { stdout } = await execAsync(`
        npx claude-mcp-server github search_pull_requests \\
          --owner ${this.owner} \\
          --repo ${this.repo} \\
          --query "is:merged base:develop" \\
          --sort updated \\
          --order desc \\
          --perPage 20
      `)

      return JSON.parse(stdout)
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
   * 現在のブランチ名を取得
   */
  async getCurrentBranch() {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD')
    return stdout.trim()
  }

  /**
   * ブランチを安全に削除
   */
  async deleteBranch(branchName, force = false) {
    const deleteFlag = force ? '-D' : '-d'

    try {
      await execAsync(`git branch ${deleteFlag} ${branchName}`)
      console.log(`✅ Deleted local branch: ${branchName}`)
      return true
    } catch (error) {
      if (!force) {
        console.log(`⚠️  Soft delete failed, trying force delete: ${branchName}`)
        return await this.deleteBranch(branchName, true)
      }
      console.error(`❌ Failed to delete branch ${branchName}:`, error.message)
      return false
    }
  }

  /**
   * リモート追跡ブランチを削除
   */
  async deleteRemoteTrackingBranch(branchName) {
    try {
      await execAsync(`git branch -dr origin/${branchName}`)
      console.log(`✅ Deleted remote tracking: origin/${branchName}`)
    } catch {
      // 既に削除済みまたは存在しない場合は無視
    }
  }

  /**
   * メイン処理: マージ済みPRに対応するローカルブランチを削除
   */
  async cleanupMergedBranches() {
    console.log('🔍 Checking for merged PRs...')

    const mergedPRs = await this.getMergedPRs()
    const currentBranch = await this.getCurrentBranch()

    let cleanupCount = 0

    for (const pr of mergedPRs) {
      const branchName = pr.head.ref

      // ベースブランチはスキップ
      if (this.baseBranches.includes(branchName)) {
        continue
      }

      // ローカルブランチが存在するかチェック
      if (!(await this.localBranchExists(branchName))) {
        continue
      }

      console.log(`🔄 Processing merged PR #${pr.number}: ${branchName}`)

      // 現在のブランチの場合は develop に切り替え
      if (currentBranch === branchName) {
        console.log(`🔄 Switching from ${branchName} to develop`)
        await execAsync('git checkout develop')
        await execAsync('git pull origin develop')
      }

      // ローカルブランチを削除
      if (await this.deleteBranch(branchName)) {
        await this.deleteRemoteTrackingBranch(branchName)
        cleanupCount++
      }
    }

    // リモート参照をクリーンアップ
    if (cleanupCount > 0) {
      await execAsync('git remote prune origin')
      console.log('🧹 Cleaned up remote references')
    }

    console.log(`✅ Cleanup completed: ${cleanupCount} branches removed`)
    return cleanupCount
  }

  /**
   * 定期実行用: 最近の変更をチェック
   */
  async scheduleCheck() {
    const cleanupCount = await this.cleanupMergedBranches()

    // develop ブランチを最新に更新
    const currentBranch = await this.getCurrentBranch()
    if (currentBranch === 'develop' || cleanupCount > 0) {
      console.log('🔄 Updating develop branch')
      await execAsync('git checkout develop')
      await execAsync('git pull origin develop')
    }

    return cleanupCount
  }
}

// CLI実行
if (require.main === module) {
  const cleanup = new AutoBranchCleanup()

  const mode = process.argv[2] || 'auto'

  if (mode === 'schedule') {
    cleanup
      .scheduleCheck()
      .then((count) => {
        console.log(`Schedule check completed: ${count} branches cleaned`)
        process.exit(0)
      })
      .catch((error) => {
        console.error('Schedule check failed:', error)
        process.exit(1)
      })
  } else {
    cleanup
      .cleanupMergedBranches()
      .then((count) => {
        console.log(`Manual cleanup completed: ${count} branches cleaned`)
        process.exit(0)
      })
      .catch((error) => {
        console.error('Manual cleanup failed:', error)
        process.exit(1)
      })
  }
}

module.exports = AutoBranchCleanup
