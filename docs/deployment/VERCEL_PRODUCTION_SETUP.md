# Vercel Production Setup Guide

## Overview

本番環境での Napoleon Game デプロイメント設定ガイド

## 前提条件

- Supabase Production プロジェクトの作成完了
- Vercel プロジェクトの設定完了
- GitHub リポジトリとの連携設定完了

## 1. Supabase Production プロジェクト設定

### 1.1 新規プロジェクト作成

```bash
# Supabase Dashboard でプロジェクト作成
# 1. https://supabase.com/dashboard
# 2. "New Project" をクリック
# 3. Organization: 適切な組織を選択
# 4. Name: "napoleon-game-production"
# 5. Database Password: 強力なパスワードを設定
# 6. Region: Asia Northeast (Tokyo) - ap-northeast-1
```

### 1.2 データベーススキーマ設定

**重要**: 完全なスキーマは `docs/deployment/production_database_schema.sql` を参照してください。

以下、最小限の手順：

```sql
-- Supabase Dashboard → SQL Editor で実行

-- 1. Players テーブル
CREATE TABLE IF NOT EXISTS players (
  id text PRIMARY KEY,
  name text NOT NULL,
  connected boolean DEFAULT false,
  last_seen timestamp with time zone DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Games テーブル（重要: id は text 型）
CREATE TABLE games (
  id text PRIMARY KEY,
  session_id text,
  state jsonb NOT NULL DEFAULT '{}',
  phase text NOT NULL DEFAULT 'waiting',
  winner_team text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Game Results テーブル
CREATE TABLE game_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id text REFERENCES games(id) ON DELETE CASCADE,
  player_scores jsonb NOT NULL DEFAULT '[]',
  winner_id text,
  finished_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Game Rooms テーブル
CREATE TABLE IF NOT EXISTS game_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id text UNIQUE NOT NULL,
  host_player_id text REFERENCES players(id) ON DELETE CASCADE,
  players jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'waiting',
  max_players integer DEFAULT 4,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- インデックス作成
CREATE INDEX idx_players_connected ON players(connected);
CREATE INDEX idx_players_created_at ON players(created_at);

CREATE INDEX idx_games_id ON games(id);
CREATE INDEX idx_games_phase ON games(phase);
CREATE INDEX idx_games_created_at ON games(created_at);
CREATE INDEX idx_games_winner_team ON games(winner_team);

CREATE INDEX idx_game_results_game_id ON game_results(game_id);
CREATE INDEX idx_game_results_winner_id ON game_results(winner_id);

CREATE INDEX idx_game_rooms_room_id ON game_rooms(room_id);
CREATE INDEX idx_game_rooms_status ON game_rooms(status);
CREATE INDEX idx_game_rooms_host_player_id ON game_rooms(host_player_id);
```

### 1.3 RLS (Row Level Security) 設定

```sql
-- RLS 関数作成
CREATE OR REPLACE FUNCTION set_config(
  setting_name text,
  setting_value text,
  is_local boolean default false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN set_config(setting_name, setting_value, is_local);
END;
$$;

CREATE OR REPLACE FUNCTION get_current_player_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.player_id', true), '');
$$;

-- RLS 有効化
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Players テーブルのポリシー
CREATE POLICY "players_select_policy" ON players
  FOR SELECT USING (
    id = get_current_player_id() OR get_current_player_id() IS NOT NULL
  );

CREATE POLICY "players_insert_policy" ON players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "players_update_policy" ON players
  FOR UPDATE USING (
    id = get_current_player_id() OR get_current_player_id() IS NOT NULL
  );

-- Games テーブルのポリシー（本番環境では緩めに設定）
CREATE POLICY "games_select_policy" ON games FOR SELECT USING (true);
CREATE POLICY "games_insert_policy" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "games_update_policy" ON games FOR UPDATE USING (true);

-- Game Rooms テーブルのポリシー
CREATE POLICY "game_rooms_select_policy" ON game_rooms FOR SELECT USING (true);
CREATE POLICY "game_rooms_insert_policy" ON game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "game_rooms_update_policy" ON game_rooms FOR UPDATE USING (true);

-- Game Results テーブルのポリシー
CREATE POLICY "game_results_select_policy" ON game_results FOR SELECT USING (true);
CREATE POLICY "game_results_insert_policy" ON game_results FOR INSERT WITH CHECK (true);
```

**注意**: 上記のRLSポリシーは開発段階用の緩い設定です。本格運用時にはセキュリティを強化してください。

## 2. Vercel 環境変数設定

### 2.1 Production 環境変数

**⚠️ セキュリティ重要**: 本番環境の認証情報は**必ずVercelの環境変数**で設定してください。
`.env.production` ファイルに実際の認証情報を入れないでください（Gitに追跡される可能性があります）。

Vercel Dashboard → Project Settings → Environment Variables で設定:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PRODUCTION_PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_PRODUCTION_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_PRODUCTION_SERVICE_ROLE_KEY]

# Environment
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production

# Feature Flags
NEXT_PUBLIC_ENABLE_RLS=true
NEXT_PUBLIC_ENABLE_PERF_MONITOR=true

# Optional: Analytics
NEXT_PUBLIC_ANALYTICS_ID=[YOUR_ANALYTICS_ID]
SENTRY_DSN=[YOUR_SENTRY_DSN]
```

### 2.2 Environment 設定

- **Environment**: `Production`
- **Git Branch**: `main`
- **Apply to**: `Production`のみ

## 3. Deployment Settings

### 3.1 Build Configuration

```json
{
  "buildCommand": "pnpm build",
  "outputDirectory": ".next",
  "installCommand": "pnpm install --frozen-lockfile",
  "devCommand": "pnpm dev"
}
```

### 3.2 Domain Configuration

```bash
# Custom Domain (Optional)
# Vercel Dashboard → Domains で設定
# 例: napoleon-game.your-domain.com
```

## 4. GitHub Actions for Production

### 4.1 Production Deploy Workflow

`.github/workflows/production-deploy.yml`:

```yaml
name: Production Deploy

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm type-check

      - name: Lint
        run: pnpm lint

      - name: Test
        run: pnpm test:ci
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://mock.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: mock_anon_key
          SUPABASE_SERVICE_ROLE_KEY: mock_service_role_key

      - name: Build
        run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          NEXT_PUBLIC_APP_ENV: production

      - name: E2E Tests (Production URL)
        if: github.event_name == 'pull_request'
        run: pnpm test:e2e:production
        env:
          PLAYWRIGHT_BASE_URL: https://napoleon-game-production.vercel.app
```

## 5. E2E Tests for Production

### 5.1 Production E2E Configuration

`playwright-production.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';
import { config as baseConfig } from './playwright.config';

export default defineConfig({
  ...baseConfig,
  use: {
    ...baseConfig.use,
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      'https://napoleon-game-production.vercel.app',
  },
  webServer: undefined, // Production環境では webServer を使用しない
  projects: [
    {
      name: 'chromium-production',
      use: { ...baseConfig.projects?.[0]?.use },
    },
  ],
});
```

### 5.2 Package.json Scripts

```json
{
  "scripts": {
    "test:e2e:production": "SKIP_E2E_TESTS=${SKIP_E2E_TESTS:-false} playwright test --config=playwright-production.config.ts",
    "test:e2e:production:ui": "SKIP_E2E_TESTS=${SKIP_E2E_TESTS:-false} playwright test --config=playwright-production.config.ts --ui",
    "test:e2e:production:headed": "SKIP_E2E_TESTS=${SKIP_E2E_TESTS:-false} playwright test --config=playwright-production.config.ts --headed"
  }
}
```

## 6. セキュリティ設定

### 6.1 Vercel Security Headers

`next.config.js`:

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/(.*)',
          headers: [
            {
              key: 'X-Frame-Options',
              value: 'DENY',
            },
            {
              key: 'X-Content-Type-Options',
              value: 'nosniff',
            },
            {
              key: 'Referrer-Policy',
              value: 'origin-when-cross-origin',
            },
          ],
        },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
```

### 6.2 Environment Variables Security

```bash
# 本番環境では以下を必ず設定
NEXT_PUBLIC_ENABLE_RLS=true  # RLS を有効化
NEXT_PUBLIC_APP_ENV=production  # 本番環境フラグ
```

## 7. Monitoring & Analytics

### 7.1 Vercel Analytics

```bash
# Vercel Dashboard で有効化
# Project Settings → Analytics → Enable
```

### 7.2 Error Tracking (Optional)

```bash
# Sentry integration
npm install @sentry/nextjs
```

## 8. Deployment Checklist

### 8.1 Pre-deployment

- [ ] Supabase Production プロジェクト作成完了
- [ ] **データベーススキーマ実行完了** (1.2, 1.3の全SQL実行)
- [ ] **テーブル構造確認** (`games.id` が text 型であることを確認)
- [ ] RLS 関数・ポリシー設定完了
- [ ] Vercel 環境変数設定完了 (Production環境のみ)
- [ ] GitHub Secrets 設定完了 (オプション)
- [ ] Security Headers 設定完了

### 8.2 Post-deployment

- [ ] Vercel でデプロイ成功確認
- [ ] Production URL でのゲーム動作確認
- [ ] **AI対戦機能の動作確認** (https://napoleon-game.vercel.app)
- [ ] Supabase ダッシュボードでのデータ確認
  - [ ] `players` テーブルにデータが保存されているか
  - [ ] `games` テーブルにゲーム状態が保存されているか
- [ ] E2E テスト実行・合格確認 (オプション)
- [ ] Performance monitoring 確認 (オプション)
- [ ] Error tracking 設定確認 (オプション)

## 9. Troubleshooting

### 9.1 Common Issues

#### `Invalid session` エラー

**原因**: `players` テーブルが存在しない、またはRLS関数が未作成

**解決策**:

```sql
-- Supabase SQL Editor で実行
-- 1.2, 1.3 のすべてのSQLを再実行
```

#### `Failed to save AI game state` エラー

**原因**: `games` テーブルの `id` カラムが `uuid` 型になっている

**解決策**:

```sql
-- 既存のテーブルを削除して再作成
DROP TABLE IF EXISTS game_results CASCADE;
DROP TABLE IF EXISTS games CASCADE;

-- 1.2 のスキーマを再実行（games.id は text 型であることを確認）
```

#### `column "winner_team" does not exist` エラー

**原因**: `games` テーブルに `winner_team` カラムが存在しない

**解決策**:

```sql
ALTER TABLE games ADD COLUMN IF NOT EXISTS winner_team text;
CREATE INDEX IF NOT EXISTS idx_games_winner_team ON games(winner_team);
```

#### Supabase 接続エラー

**解決策**:

- Vercel 環境変数の URL と Key を再確認
- Production 環境にのみ設定されているか確認

#### RLS エラー

**解決策**:

- RLS関数 (`set_config`, `get_current_player_id`) が作成されているか確認
- ポリシー設定を確認

#### Build エラー

**解決策**:

- 型チェックとlintを実行

```bash
pnpm type-check
pnpm lint
```

### 9.2 Debug Commands

```bash
# ローカルで本番ビルドテスト
NODE_ENV=production pnpm build
NODE_ENV=production pnpm start

# 本番環境でのE2Eテスト
PLAYWRIGHT_BASE_URL=https://your-production-url.vercel.app pnpm test:e2e:production
```

## Next Steps

1. ✅ Supabase Production プロジェクト作成
2. ✅ データベーススキーマ実行 (`docs/deployment/production_database_schema.sql`)
3. ✅ Vercel 環境変数設定 (Production 環境のみ)
4. ✅ Vercel デプロイ・動作確認
5. ⏭️ GitHub Actions 設定 (オプション)
6. ⏭️ E2E テスト実行 (オプション)
7. ⏭️ カスタムドメイン設定 (オプション)

## Quick Start (最小手順)

最速で本番環境を立ち上げる手順：

```bash
# 1. Supabase でプロジェクト作成
# https://supabase.com/dashboard → New Project

# 2. SQL Editor で docs/deployment/production_database_schema.sql を実行
# または、セクション 1.2, 1.3 のSQLをすべて実行

# 3. Vercel で環境変数設定 (Production のみ)
NEXT_PUBLIC_SUPABASE_URL=https://[YOUR_PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_ANON_KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR_SERVICE_ROLE_KEY]
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production

# 4. Vercel でデプロイ → 完了！
```

---

> 詳細な設定手順や問題解決については、このドキュメントのセクション9 (Troubleshooting) を参照してください。
