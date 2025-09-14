#!/bin/bash

# GitHub Auto Branch Cleanup Setup Script
# PRマージ時の自動ブランチクリーンアップを設定

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# カラー定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 GitHub Auto Branch Cleanup Setup${NC}"
echo

# GitHub CLI の確認
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI (gh) is not installed${NC}"
    echo "Please install GitHub CLI: https://cli.github.com/"
    exit 1
fi

# GitHub認証確認
if ! gh auth status &> /dev/null; then
    echo -e "${RED}❌ GitHub CLI is not authenticated${NC}"
    echo "Please run: gh auth login"
    exit 1
fi

# Git Hook用のディレクトリを作成
HOOKS_DIR="${REPO_ROOT}/.git/hooks"
mkdir -p "${HOOKS_DIR}"

# Post-merge hookを作成
POST_MERGE_HOOK="${HOOKS_DIR}/post-merge"

cat > "${POST_MERGE_HOOK}" << 'EOF'
#!/bin/bash

# Post-merge hook for auto branch cleanup
# PRマージ後に自動でローカルブランチをクリーンアップ

# 現在のブランチを確認
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
BASE_BRANCHES=("main" "develop")

# ベースブランチにいる場合のみ実行
if [[ " ${BASE_BRANCHES[@]} " =~ " ${CURRENT_BRANCH} " ]]; then
    echo "🧹 Running auto branch cleanup..."

    # Node.jsスクリプトを実行
    if [ -f "scripts/auto-branch-cleanup.js" ]; then
        node scripts/auto-branch-cleanup.js schedule
    else
        echo "⚠️  Auto cleanup script not found"
    fi
else
    echo "ℹ️  Not on base branch (${CURRENT_BRANCH}), skipping auto cleanup"
fi
EOF

# 実行権限を付与
chmod +x "${POST_MERGE_HOOK}"

# Crontab設定（オプション）
setup_cron() {
    echo -e "${BLUE}📅 Setting up cron job for periodic cleanup...${NC}"

    # 既存のcrontabをバックアップ
    crontab -l > /tmp/crontab_backup.txt 2>/dev/null || true

    # 新しいcron設定
    CRON_JOB="0 */6 * * * cd \"${REPO_ROOT}\" && pnpm cleanup:auto:schedule >/dev/null 2>&1"

    # 既存の設定を確認
    if crontab -l 2>/dev/null | grep -q "cleanup:auto:schedule"; then
        echo -e "${YELLOW}⚠️  Cron job already exists${NC}"
    else
        # cron設定を追加
        (crontab -l 2>/dev/null || echo "") | grep -v "cleanup:auto:schedule" > /tmp/new_crontab.txt
        echo "${CRON_JOB}" >> /tmp/new_crontab.txt
        crontab /tmp/new_crontab.txt
        rm /tmp/new_crontab.txt
        echo -e "${GREEN}✅ Cron job added (runs every 6 hours)${NC}"
    fi
}

# セットアップメニュー
echo -e "${YELLOW}📋 Setup Options:${NC}"
echo "1. Git hook only (recommended)"
echo "2. Git hook + cron job"
echo "3. Manual setup only"
echo

read -p "Select option (1-3): " option

case $option in
    1)
        echo -e "${GREEN}✅ Git hook setup completed${NC}"
        echo -e "Post-merge hook installed: ${POST_MERGE_HOOK}"
        ;;
    2)
        setup_cron
        echo -e "${GREEN}✅ Git hook + cron job setup completed${NC}"
        ;;
    3)
        rm "${POST_MERGE_HOOK}"
        echo -e "${BLUE}ℹ️  Manual setup - use 'pnpm cleanup:auto' command${NC}"
        ;;
    *)
        echo -e "${RED}❌ Invalid option${NC}"
        exit 1
        ;;
esac

echo
echo -e "${GREEN}🎉 Auto branch cleanup setup completed!${NC}"
echo
echo -e "${BLUE}Available commands:${NC}"
echo "  pnpm cleanup:auto           # Manual cleanup of merged branches"
echo "  pnpm cleanup:auto:schedule  # Scheduled cleanup (with develop update)"
echo
echo -e "${BLUE}How it works:${NC}"
echo "• When you merge a PR to develop, git hook automatically cleans up local branches"
echo "• Uses GitHub API to verify which branches are actually merged"
echo "• Safely deletes only merged feature branches"
echo "• Keeps base branches (main, develop) intact"