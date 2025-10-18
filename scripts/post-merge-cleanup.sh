#!/bin/bash

# Post-merge cleanup script
# このスクリプトは機能ブランチがマージされた後の後片付けを自動化します

set -e  # エラー時に停止

# post-mergeフックとの重複実行を防ぐ
export CLEANUP_MANUAL_RUN=1

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

print_info "🧹 Post-merge cleanup starting..."

# 現在のブランチを取得
CURRENT_BRANCH=$(git branch --show-current)
print_info "Current branch: $CURRENT_BRANCH"

# developブランチでない場合のみ処理を実行
if [ "$CURRENT_BRANCH" = "develop" ]; then
    print_warning "Already on develop branch. No cleanup needed."
    exit 0
fi

# 作業ディレクトリが clean か確認
if [ -n "$(git status --porcelain)" ]; then
    print_error "Working directory is not clean. Please commit or stash changes first."
    exit 1
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

# 前のブランチを削除するか確認
read -p "Delete the branch '$CURRENT_BRANCH'? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    # ローカルブランチを削除
    print_info "Deleting local branch '$CURRENT_BRANCH'..."
    git branch -d "$CURRENT_BRANCH" 2>/dev/null || {
        print_warning "Branch '$CURRENT_BRANCH' already deleted or doesn't exist"
    }
    
    # リモートブランチは GitHub で自動削除されるためスキップ
    if git show-ref --verify --quiet refs/remotes/origin/"$CURRENT_BRANCH"; then
        print_info "Remote branch 'origin/$CURRENT_BRANCH' exists but skipping deletion"
        print_info "💡 GitHub auto-deletes remote branches on squash merge"
    else
        print_info "Remote branch 'origin/$CURRENT_BRANCH' already deleted by GitHub"
    fi
    
    print_success "Branch '$CURRENT_BRANCH' has been deleted."
else
    print_info "Branch '$CURRENT_BRANCH' was kept."
fi

# 不要なリモート参照をクリーンアップ
print_info "Cleaning up remote references..."
git remote prune origin

# 現在の状態を表示
print_info "Current status:"
git status --short
git branch -v

print_success "🎉 Post-merge cleanup completed!"
print_info "You are now on develop branch and ready for the next feature."