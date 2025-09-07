#!/bin/bash

# Smart post-merge cleanup script
# より賢い自動化で、GitHub APIを使用してPRの状態を確認

set -e

# 色付きメッセージ用の関数
print_info() {
    echo -e "\033[36m[INFO]\033[0m $1"
}

print_success() {
    echo -e "\033[32m[SUCCESS]\033[0m $1"
}

print_warning() {
    echo -e "\033[33m[WARNING]\033[0m $1"
}

print_error() {
    echo -e "\033[31m[ERROR]\033[0m $1"
}

# 使用方法を表示
show_usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -f, --force     Skip confirmations and auto-delete branches"
    echo "  -k, --keep      Keep the current branch (don't delete)"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  pnpm cleanup:smart              # Interactive mode"
    echo "  pnpm cleanup:smart -- --force   # Auto-delete mode"
    echo "  pnpm cleanup:smart -- --keep    # Keep branch mode"
}

# デフォルト設定
FORCE_MODE=false
KEEP_BRANCH=false

# コマンドライン引数の解析
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--force)
            FORCE_MODE=true
            shift
            ;;
        -k|--keep)
            KEEP_BRANCH=true
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

print_info "🚀 Smart post-merge cleanup starting..."

# 現在のブランチを取得
CURRENT_BRANCH=$(git branch --show-current)
print_info "Current branch: $CURRENT_BRANCH"

# developブランチでない場合のみ処理を実行
if [ "$CURRENT_BRANCH" = "develop" ]; then
    print_warning "Already on develop branch. Updating to latest..."
    git fetch origin
    git pull origin develop
    git remote prune origin
    print_success "develop branch updated!"
    exit 0
fi

# mainブランチの場合も同様
if [ "$CURRENT_BRANCH" = "main" ]; then
    print_warning "On main branch. Updating to latest..."
    git fetch origin
    git pull origin main
    git remote prune origin
    print_success "main branch updated!"
    exit 0
fi

# 作業ディレクトリが clean か確認
if [ -n "$(git status --porcelain)" ]; then
    print_error "Working directory is not clean. Please commit or stash changes first."
    print_info "Uncommitted changes:"
    git status --short
    exit 1
fi

# GitHub CLIがインストールされているかチェック
if command -v gh &> /dev/null; then
    print_info "Checking PR status with GitHub CLI..."
    
    # PRの状態を確認
    PR_STATE=$(gh pr view "$CURRENT_BRANCH" --json state -q .state 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$PR_STATE" = "MERGED" ]; then
        print_success "✅ PR for branch '$CURRENT_BRANCH' is merged!"
        FORCE_DELETE=true
    elif [ "$PR_STATE" = "CLOSED" ]; then
        print_warning "❌ PR for branch '$CURRENT_BRANCH' is closed (not merged)"
        FORCE_DELETE=true
    elif [ "$PR_STATE" = "OPEN" ]; then
        print_warning "🔄 PR for branch '$CURRENT_BRANCH' is still open"
        FORCE_DELETE=false
    else
        print_info "No PR found for branch '$CURRENT_BRANCH'"
        FORCE_DELETE=false
    fi
else
    print_info "GitHub CLI not found. Skipping PR status check."
    print_info "Install with: brew install gh"
    FORCE_DELETE=false
fi

# リモートから最新情報を取得
print_info "Fetching latest changes from remote..."
git fetch origin

# developブランチに切り替え
print_info "Switching to develop branch..."
git checkout develop

# developブランチを最新に更新
print_info "Updating develop branch..."
git pull origin develop

# ブランチ削除の判断
DELETE_BRANCH=false

if [ "$KEEP_BRANCH" = true ]; then
    print_info "Branch '$CURRENT_BRANCH' kept as requested."
elif [ "$FORCE_MODE" = true ] || [ "$FORCE_DELETE" = true ]; then
    DELETE_BRANCH=true
else
    # インタラクティブに確認
    read -p "Delete the branch '$CURRENT_BRANCH'? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        DELETE_BRANCH=true
    fi
fi

# ブランチ削除の実行
if [ "$DELETE_BRANCH" = true ]; then
    # ローカルブランチを削除
    print_info "Deleting local branch '$CURRENT_BRANCH'..."
    git branch -d "$CURRENT_BRANCH" 2>/dev/null || {
        print_warning "Failed to delete with -d, trying -D (force delete)..."
        git branch -D "$CURRENT_BRANCH"
    }
    
    # リモートブランチが存在するか確認して削除
    if git show-ref --verify --quiet refs/remotes/origin/"$CURRENT_BRANCH"; then
        if [ "$FORCE_MODE" = true ] || [ "$FORCE_DELETE" = true ]; then
            DELETE_REMOTE=true
        else
            read -p "Also delete remote branch 'origin/$CURRENT_BRANCH'? (y/N): " -n 1 -r
            echo
            DELETE_REMOTE=false
            [[ $REPLY =~ ^[Yy]$ ]] && DELETE_REMOTE=true
        fi
        
        if [ "$DELETE_REMOTE" = true ]; then
            print_info "Deleting remote branch 'origin/$CURRENT_BRANCH'..."
            git push origin --delete "$CURRENT_BRANCH" 2>/dev/null || {
                print_warning "Failed to delete remote branch. It may have been already deleted."
            }
        fi
    fi
    
    print_success "Branch '$CURRENT_BRANCH' has been cleaned up."
else
    print_info "Branch '$CURRENT_BRANCH' was kept."
fi

# 不要なリモート参照をクリーンアップ
print_info "Cleaning up remote references..."
git remote prune origin

# マージされたブランチを表示
print_info "Recently merged branches:"
git branch --merged develop | grep -v "develop\|main" | head -5 || print_info "No recently merged branches found."

# 現在の状態を表示
print_info "Current status:"
print_success "✅ Current branch: $(git branch --show-current)"
print_success "✅ Latest commit: $(git log --oneline -1)"

print_success "🎉 Smart cleanup completed!"
print_info "💡 Tip: Use 'pnpm cleanup:smart -- --force' for fully automated cleanup"