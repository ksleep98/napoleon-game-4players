#!/bin/bash

# Setup script for automatic post-merge cleanup
# 自動クリーンアップの設定スクリプト

set -e

print_info() {
    echo -e "\033[36m[SETUP]\033[0m $1"
}

print_success() {
    echo -e "\033[32m[SETUP]\033[0m $1"
}

print_warning() {
    echo -e "\033[33m[SETUP]\033[0m $1"
}

print_error() {
    echo -e "\033[31m[SETUP]\033[0m $1"
}

show_usage() {
    echo "Usage: $0 [enable|disable|status]"
    echo ""
    echo "Commands:"
    echo "  enable   Enable automatic post-merge cleanup"
    echo "  disable  Disable automatic post-merge cleanup"
    echo "  status   Show current status"
    echo ""
    echo "Examples:"
    echo "  pnpm setup:auto-cleanup enable"
    echo "  pnpm setup:auto-cleanup disable"
    echo "  pnpm setup:auto-cleanup status"
}

# デフォルトは status
ACTION=${1:-status}

case $ACTION in
    enable)
        print_info "🔧 Enabling automatic post-merge cleanup..."
        
        # Huskyのpost-mergeフックをアクティブにする
        if [ -f ".husky/post-merge" ]; then
            chmod +x .husky/post-merge
            print_success "✅ Husky post-merge hook enabled"
        else
            print_error "❌ .husky/post-merge not found"
            exit 1
        fi
        
        # GitHub CLIがインストールされているか確認
        if command -v gh &> /dev/null; then
            print_success "✅ GitHub CLI detected - smart cleanup available"
        else
            print_warning "⚠️ GitHub CLI not found"
            print_info "💡 For optimal cleanup, install with: brew install gh"
            print_info "💡 Manual PR status checking will be used"
        fi
        
        print_success "🎉 Auto-cleanup is now enabled!"
        print_info "💡 Next merge to develop branch will trigger automatic cleanup"
        print_info "💡 Disable with: pnpm setup:auto-cleanup disable"
        ;;
        
    disable)
        print_info "🛑 Disabling automatic post-merge cleanup..."
        
        # Huskyのpost-mergeフックを無効にする
        if [ -f ".husky/post-merge" ]; then
            chmod -x .husky/post-merge
            print_success "✅ Husky post-merge hook disabled"
        else
            print_info "ℹ️ .husky/post-merge not found (already disabled)"
        fi
        
        print_success "🎉 Auto-cleanup is now disabled!"
        print_info "💡 Use manual cleanup: pnpm cleanup:smart"
        print_info "💡 Re-enable with: pnpm setup:auto-cleanup enable"
        ;;
        
    status)
        print_info "📊 Auto-cleanup status:"
        echo ""
        
        # Huskyの状態をチェック
        if [ -f ".husky/post-merge" ] && [ -x ".husky/post-merge" ]; then
            print_success "✅ Auto-cleanup: ENABLED"
        elif [ -f ".husky/post-merge" ]; then
            print_warning "⚠️ Auto-cleanup: DISABLED (file exists but not executable)"
        else
            print_error "❌ Auto-cleanup: NOT CONFIGURED"
        fi
        
        # GitHub CLIの状態をチェック
        if command -v gh &> /dev/null; then
            GH_VERSION=$(gh --version | head -1)
            print_success "✅ GitHub CLI: $GH_VERSION"
        else
            print_warning "⚠️ GitHub CLI: NOT INSTALLED"
            print_info "   Install with: brew install gh"
        fi
        
        # Git情報
        CURRENT_BRANCH=$(git branch --show-current)
        print_info "📍 Current branch: $CURRENT_BRANCH"
        
        echo ""
        print_info "💡 Enable:  pnpm setup:auto-cleanup enable"
        print_info "💡 Disable: pnpm setup:auto-cleanup disable"
        print_info "💡 Manual:  pnpm cleanup:smart"
        ;;
        
    *)
        print_error "Unknown command: $ACTION"
        show_usage
        exit 1
        ;;
esac