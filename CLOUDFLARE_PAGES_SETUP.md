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

### 2. ビルド設定（最適化済み）

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

## ⚡ 25MB制限対策（実装済み）

### 最適化機能

- **✅ Webpackキャッシュ無効化**: 巨大な.packファイル削除
- **✅ コンソール削除**: 本番環境でconsole.log削除
- **✅ クリーンビルド**: 毎回.nextフォルダを削除してからビルド
- **✅ ファイル除外**: `.cfpagesignore`で不要ファイル除外

### ビルドサイズ最適化結果

- **ビルドサイズ**: ~4MB（25MB制限を大幅に下回る）
- **キャッシュファイル**: 0個
- **デプロイ速度**: 大幅改善

## ✅ 機能サポート状況

### 完全サポート

- ✅ **Next.js App Router**: 完全対応
- ✅ **Server Actions**: SSR環境で動作
- ✅ **SSR/SSG**: 混在モード対応
- ✅ **API Routes**: `/api/*` ルート対応
- ✅ **環境変数**: ビルド時・ランタイム両方サポート
- ✅ **自動デプロイメント**: Git連携

### 自動最適化

- 🚀 **Edge Runtime**: 高速レスポンス
- 🌐 **Global CDN**: 世界中に配信
- 🔒 **HTTPS**: 自動設定
- 📦 **圧縮**: 自動最適化

## 🔄 自動デプロイメント

- `main` ブランチ → 本番環境
- `develop` ブランチ → プレビュー環境
- Pull Request → 一時プレビュー

## 🚨 トラブルシューティング

### よくある問題

1. **ビルドエラー**: Node.js バージョン確認（22.14.0推奨）
2. **環境変数エラー**: Supabase認証情報確認
3. **Server Actions エラー**: RLS設定確認
4. **ファイルサイズエラー**: 最適化設定済みで解決

### ログ確認

**Functions** → **Real-time Logs** でエラー詳細確認

## 📁 プロジェクト構成

### Pages用最適化ファイル

- `next.config.js`: Webpackキャッシュ無効化設定
- `.cfpagesignore`: 大容量ファイル除外設定
- `package.json`: 最適化ビルドスクリプト

### 削除済みファイル

- `wrangler.toml`: Workers用設定（Pages不要）
- `worker.js`: Workers用エントリーポイント（Pages不要）

## 🔗 リンク

- **本番**: https://napoleon-game-4players.pages.dev
- **プレビュー**: https://develop.napoleon-game-4players.pages.dev
- **Dashboard**: https://dash.cloudflare.com/

---

> **注意**: 25MB制限対策により、初回デプロイも高速化されています
