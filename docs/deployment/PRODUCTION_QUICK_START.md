# Production Quick Start Guide

## 🚀 本番環境セットアップ手順

### 1. Supabase Production プロジェクト作成

```bash
# 1. Supabase Dashboard にアクセス
# https://supabase.com/dashboard

# 2. 新規プロジェクト作成
# - Name: "napoleon-game-production"
# - Region: Asia Northeast (Tokyo)
# - Database Password: 強力なパスワード設定

# 3. プロジェクト情報取得
# Settings → API → Project URL, anon key, service_role key をコピー
```

### 2. GitHub Secrets 設定

```bash
# GitHub Repository → Settings → Secrets and variables → Actions

# 必須 Secrets:
NEXT_PUBLIC_SUPABASE_URL_PROD=https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY_PROD=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY_PROD=[your-service-role-key]
PRODUCTION_URL=https://napoleon-game-production.vercel.app
```

### 3. Vercel 環境変数設定

```bash
# Vercel Dashboard → Project → Settings → Environment Variables

# Production 環境に以下を設定:
NEXT_PUBLIC_SUPABASE_URL=https://[your-project-id].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[your-anon-key]
SUPABASE_SERVICE_ROLE_KEY=[your-service-role-key]
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production
NEXT_PUBLIC_ENABLE_RLS=true
```

### 4. データベーススキーマ設定

```sql
-- Supabase SQL Editor で実行

-- Game Sessions テーブル
CREATE TABLE game_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id text UNIQUE NOT NULL,
  players jsonb NOT NULL DEFAULT '[]',
  game_state jsonb NOT NULL DEFAULT '{}',
  current_phase text NOT NULL DEFAULT 'waiting',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- インデックス作成
CREATE INDEX idx_game_sessions_session_id ON game_sessions(session_id);
CREATE INDEX idx_game_sessions_created_at ON game_sessions(created_at);

-- RLS 有効化
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- アクセスポリシー
CREATE POLICY "Users can access their game sessions" ON game_sessions
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::json->>'sub' = ANY(
      SELECT jsonb_array_elements_text(players)
    )
  );

CREATE POLICY "Users can create game sessions" ON game_sessions
  FOR INSERT WITH CHECK (true);
```

### 5. 本番デプロイ確認

```bash
# main ブランチにプッシュして自動デプロイ確認
git checkout main
git merge develop
git push origin main

# GitHub Actions でビルド・デプロイ状況確認
# https://github.com/[username]/napoleon-game-4players/actions
```

### 6. E2E テスト実行

```bash
# 本番URLでのE2Eテスト実行
PLAYWRIGHT_BASE_URL=https://napoleon-game-production.vercel.app pnpm test:e2e:production

# または環境変数設定して実行
export PLAYWRIGHT_BASE_URL=https://napoleon-game-production.vercel.app
pnpm test:e2e:production:headed  # ブラウザ表示あり
pnpm test:e2e:production:ui      # Playwright UI使用
```

## 📋 設定完了チェックリスト

### Supabase 設定

- [ ] Production プロジェクト作成完了
- [ ] Database スキーマ設定完了
- [ ] RLS ポリシー設定完了
- [ ] API Keys 取得完了

### GitHub 設定

- [ ] Repository Secrets 設定完了
- [ ] GitHub Actions ワークフロー動作確認
- [ ] main ブランチ保護設定

### Vercel 設定

- [ ] プロジェクト作成・連携完了
- [ ] Production 環境変数設定完了
- [ ] Custom Domain 設定（Optional）
- [ ] 自動デプロイ確認

### テスト確認

- [ ] ビルド成功確認
- [ ] 本番URL アクセス確認
- [ ] ゲーム機能動作確認
- [ ] E2E テスト合格確認

## 🎮 本番動作確認手順

### 1. 基本動作確認

```bash
# 1. 本番URLにアクセス
# https://napoleon-game-production.vercel.app

# 2. ゲーム開始確認
# - Quick Start ボタンクリック
# - プレイヤー情報入力
# - 4人ゲーム開始

# 3. 基本操作確認
# - カード配布
# - ナポレオンコール
# - トリック実行
# - スコア計算
```

### 2. E2E テスト確認

```bash
# 自動テスト実行
pnpm test:e2e:production

# 期待結果: すべてのテストが PASSED
```

### 3. パフォーマンス確認

```bash
# Vercel Analytics で確認
# - Core Web Vitals
# - ページ読み込み速度
# - エラー率

# Supabase ダッシュボードで確認
# - API レスポンス時間
# - データベース使用量
# - アクティブ接続数
```

## 🔧 Available Commands

### 本番用コマンド

```bash
# E2E テスト (本番URL)
pnpm test:e2e:production         # ラインレポート
pnpm test:e2e:production:full    # HTMLレポート
pnpm test:e2e:production:headed  # ブラウザ表示
pnpm test:e2e:production:ui      # Playwright UI

# ビルド確認
NODE_ENV=production pnpm build  # 本番ビルド
NODE_ENV=production pnpm start  # 本番サーバー起動
```

### デバッグ用コマンド

```bash
# 本番環境変数確認
cat .env.production

# Supabase 接続確認
pnpm exec supabase status

# 型チェック・Lint
pnpm type-check
pnpm lint
```

## 🚨 Troubleshooting

### よくある問題

1. **Supabase 接続エラー**
   - 環境変数の URL と Key を再確認
   - RLS ポリシー設定を確認

2. **Build エラー**
   - `pnpm type-check` で型エラー確認
   - `pnpm lint` でコード品質確認

3. **E2E テスト失敗**
   - 本番URL のアクセス確認
   - Supabase データベース状態確認

### デバッグ手順

```bash
# 1. ローカルで本番ビルドテスト
NODE_ENV=production pnpm build
NODE_ENV=production pnpm start

# 2. 本番URLでの手動確認
open https://napoleon-game-production.vercel.app

# 3. GitHub Actions ログ確認
# Repository → Actions → 最新ワークフロー → ログ確認
```

## 📚 参考資料

- [Vercel Production Setup](./VERCEL_PRODUCTION_SETUP.md)
- [Supabase RLS Setup](../security/RLS_SETUP.md)
- [GitHub Actions Configuration](../ci-cd/GITHUB_ACTIONS.md)
- [Testing Guide](../testing/JEST_SETUP.md)

---

> セットアップ完了後は、定期的な本番環境の監視・メンテナンスを実施してください。
