#!/bin/bash

# Supabase Keep-Alive用のGitHub Secretsを設定するスクリプト

set -e

echo "🔑 Setting up GitHub Secrets for Supabase Keep-Alive"
echo ""

# 開発環境の環境変数を読み込み
if [ -f .env.local ]; then
  echo "📝 Reading development environment variables from .env.local..."
  source .env.local

  # 開発環境のSecretsを設定
  if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "Setting NEXT_PUBLIC_SUPABASE_URL..."
    gh secret set NEXT_PUBLIC_SUPABASE_URL --body "$NEXT_PUBLIC_SUPABASE_URL"
    echo "✅ NEXT_PUBLIC_SUPABASE_URL set"
  else
    echo "⚠️ NEXT_PUBLIC_SUPABASE_URL not found in .env.local"
  fi

  if [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "Setting NEXT_PUBLIC_SUPABASE_ANON_KEY..."
    gh secret set NEXT_PUBLIC_SUPABASE_ANON_KEY --body "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "✅ NEXT_PUBLIC_SUPABASE_ANON_KEY set"
  else
    echo "⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.local"
  fi
else
  echo "⚠️ .env.local not found, skipping development environment setup"
fi

echo ""

# 本番環境の環境変数を読み込み
if [ -f .env.production ]; then
  echo "📝 Reading production environment variables from .env.production..."

  # 一時的に変数をクリア
  unset NEXT_PUBLIC_SUPABASE_URL
  unset NEXT_PUBLIC_SUPABASE_ANON_KEY

  source .env.production

  # 本番環境のSecretsを設定（PROD_プレフィックス付き）
  if [ -n "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "Setting PROD_NEXT_PUBLIC_SUPABASE_URL..."
    gh secret set PROD_NEXT_PUBLIC_SUPABASE_URL --body "$NEXT_PUBLIC_SUPABASE_URL"
    echo "✅ PROD_NEXT_PUBLIC_SUPABASE_URL set"
  else
    echo "⚠️ NEXT_PUBLIC_SUPABASE_URL not found in .env.production"
  fi

  if [ -n "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ]; then
    echo "Setting PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY..."
    gh secret set PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY --body "$NEXT_PUBLIC_SUPABASE_ANON_KEY"
    echo "✅ PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY set"
  else
    echo "⚠️ NEXT_PUBLIC_SUPABASE_ANON_KEY not found in .env.production"
  fi
else
  echo "⚠️ .env.production not found, skipping production environment setup"
fi

echo ""
echo "🎉 GitHub Secrets setup completed!"
echo ""
echo "To verify, run:"
echo "  gh secret list"
echo ""
echo "To test the workflow manually, run:"
echo "  gh workflow run supabase-keep-alive.yml"
