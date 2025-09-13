# Cloudflare Pages Setup Guide

Napoleon Game (4 Players) をCloudflare Pagesにデプロイする完全ガイドです。

## 📋 前提条件

- Cloudflareアカウント (無料で作成可能)
- GitHubリポジトリがプッシュ済み
- Supabaseプロジェクトが設定済み

## 🚀 デプロイ手順

### 1. Cloudflare Dashboard でプロジェクト作成

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) にログイン
2. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
3. GitHubリポジトリ `ksleep98/napoleon-game-4players` を選択
4. **Begin setup** をクリック

### 2. ビルド設定

**Project name**: `napoleon-game-4players`

**Production branch**: `main`

**Build settings**:

- **Framework preset**: `Next.js`
- **Build command**: `npm run pages:build`
- **Build output directory**: `.next`
- **Root directory**: `/` (デフォルト)

### 3. 環境変数設定

**Environment variables** セクションで以下を設定:

```
NODE_VERSION=22.14.0
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**重要**: 実際のSupabase認証情報に置き換えてください

### 4. デプロイ実行

1. **Save and Deploy** をクリック
2. 初回ビルド完了まで約3-5分待機
3. デプロイ成功でURL生成: `https://napoleon-game-4players.pages.dev`

## ✅ 機能サポート状況

### 完全サポート

- ✅ Next.js App Router
- ✅ Server Actions
- ✅ SSR/SSG
- ✅ API Routes
- ✅ 環境変数
- ✅ 自動デプロイメント

### 自動最適化

- 🚀 Edge Runtime
- 🌐 Global CDN
- 🔒 HTTPS
- 📦 圧縮

## 🔄 自動デプロイメント

- `main` ブランチ → 本番環境
- `develop` ブランチ → プレビュー環境
- Pull Request → 一時プレビュー

## 🚨 トラブルシューティング

### よくある問題

1. **ビルドエラー**: Node.js バージョン確認
2. **環境変数エラー**: Supabase認証情報確認
3. **Server Actions エラー**: RLS設定確認

### ログ確認

**Functions** → **Real-time Logs** でエラー詳細確認

## 🔗 リンク

- **本番**: https://napoleon-game-4players.pages.dev
- **プレビュー**: https://develop.napoleon-game-4players.pages.dev
- **Dashboard**: https://dash.cloudflare.com/

---

> **注意**: 初回デプロイ後、数分でドメインが有効になります
