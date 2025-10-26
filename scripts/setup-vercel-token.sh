#!/bin/bash

# ============================================
# Vercel Token Setup Script
# ============================================
# このスクリプトはVercel Tokenを設定します
# ============================================

set -e

echo "🔧 Vercel Token Setup"
echo "===================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "❌ GitHub CLI (gh) is not installed"
  echo "Please install it first: https://cli.github.com/"
  exit 1
fi

echo "📝 Vercel Tokenの取得方法:"
echo "1. https://vercel.com/account/tokens にアクセス"
echo "2. 'Create Token' をクリック"
echo "3. Token名を入力（例: GitHub Actions Token）"
echo "4. Scopeを選択（Full Account または特定プロジェクト）"
echo "5. 'Create' をクリックしてTokenをコピー"
echo ""

read -p "Vercel Tokenを取得しましたか？ (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Setup cancelled"
  exit 1
fi

echo ""
echo "🔐 GitHub Secretに設定します..."
echo ""

# Set the secret using gh CLI
gh secret set VERCEL_TOKEN

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ VERCEL_TOKEN が設定されました！"
  echo ""
  echo "次のステップ:"
  echo "1. Vercel プロジェクトをリンク: pnpm vercel link"
  echo "2. .vercel/project.json をコミット"
  echo "3. Release PRを作成してテスト"
  echo ""
else
  echo ""
  echo "❌ Secret設定に失敗しました"
  exit 1
fi
