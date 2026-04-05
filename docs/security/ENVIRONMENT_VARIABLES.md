# Environment Variables Security Guide

## ⚠️ 重要なセキュリティルール

### 絶対に守るべきこと

1. **本番環境の認証情報をファイルに保存しない**
   - `.env.production` ファイルは作成しない（Vercel環境変数で管理）
   - Gitに追跡されるファイルには絶対に認証情報を書かない

2. **Vercel環境変数を使用する**
   - すべての環境（Production / Preview / Development）の認証情報はVercel Dashboardで管理
   - `SUPABASE_SERVICE_ROLE_KEY` は特に重要（admin権限）

3. **テンプレートファイルのみをGit管理**
   - `.env.example` / `.env.local.example` / `.env.production.example` はGit追跡OK（プレースホルダーのみ）

## 環境変数の管理方式

### `vercel dev` による開発（推奨）

ローカルに秘密情報を平文保存せず、Vercel上の環境変数を直接使用する方式。

```bash
# Vercel CLIでログイン（初回のみ）
vercel login

# 開発サーバー起動（Vercel環境変数が自動注入される）
vercel dev
# → http://localhost:3000
```

**メリット:**

- ローカルに `.env` / `.env.local` ファイルが不要
- キーの漏洩リスクが低い
- チーム間でキーの共有が不要

**注意事項:**

- オフライン時はVercelに接続できないため使用不可
- `pnpm test` など直接実行するコマンドにはVercel環境変数は注入されない（CIではモック値を使用）
- `.env` / `.env.local` が存在するとそちらも読み込まれるため、`vercel dev` 使用時はローカルファイルを削除または退避すること

### ローカルファイルによる開発（従来方式）

```bash
# .env.local ファイルを作成（Gitに追跡されない）
cp .env.local.example .env.local

# 実際の認証情報を設定
vim .env.local

# 開発サーバー起動
pnpm dev
```

## envファイルの役割

| ファイル              | 用途                                                 | Git追跡 | 秘密情報     |
| --------------------- | ---------------------------------------------------- | ------- | ------------ |
| `.env.example`        | Next.js開発テンプレート（`vercel dev` 使用時は不要） | ✅      | なし         |
| `.env.docker.example` | Docker インフラ専用テンプレート                      | ✅      | なし         |
| `.env`                | 基本設定（全環境共通の非秘密値）                     | ❌      | **含めない** |
| `.env.local`          | ローカル開発用（Supabaseキー等）                     | ❌      | あり         |
| `.env.production`     | **使用しない**（Vercel管理）                         | ❌      | -            |

### Next.js の読み込み順序（優先度：下が高い）

1. `.env` — 全環境共通のデフォルト値
2. `.env.local` — ローカル固有の値（`.env` を上書き）
3. Vercel注入値（`vercel dev` 使用時）

> **重要**: `vercel dev` 使用時にローカルファイルが存在すると両方読み込まれ、値が競合する可能性があります。`vercel dev` を使う場合は `.env` / `.env.local` を削除してください。

### Vercel環境変数の設定

1. **Vercel Dashboard** → プロジェクト → **Settings** → **Environment Variables**
2. 各環境（Production / Preview / Development）に応じて設定

| 変数名                            | Production | Preview | Development |
| --------------------------------- | ---------- | ------- | ----------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | ✅         | ✅      | ✅          |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | ✅         | ✅      | ✅          |
| `SUPABASE_SERVICE_ROLE_KEY`       | ✅         | ✅      | ✅          |
| `NODE_ENV`                        | ✅         | -       | -           |
| `NEXT_PUBLIC_APP_ENV`             | ✅         | -       | -           |
| `NEXT_PUBLIC_ENABLE_RLS`          | ✅         | -       | -           |
| `NEXT_PUBLIC_ENABLE_PERF_MONITOR` | ✅         | ✅      | -           |

## 認証情報の重要度

### 🔴 CRITICAL: SUPABASE_SERVICE_ROLE_KEY

- **権限**: Supabaseのすべてのデータにアクセス可能（RLSバイパス）
- **影響**: 漏洩すると全データベースが危険にさらされる
- **対策**:
  - 絶対にGitにコミットしない
  - Vercel環境変数のみで管理
  - 定期的にローテーション

### 🟡 MEDIUM: NEXT_PUBLIC_SUPABASE_ANON_KEY

- **権限**: クライアント側で公開される（RLS制限あり）
- **影響**: 適切なRLSポリシーがあれば安全
- **対策**: RLSポリシーを確実に設定

### 🟢 LOW: NEXT_PUBLIC_SUPABASE_URL

- **権限**: なし（公開情報）
- **影響**: 最小限
- **対策**: 特になし

## ファイル管理ルール

### ✅ Git追跡OK

- `.env.example` - Next.js開発テンプレート
- `.env.docker.example` - Docker インフラ専用テンプレート
- プレースホルダーのみ含む

### ❌ Git追跡NG

- `.env` - 実際の設定値
- `.env.local` - 実際の認証情報
- `.env.production` - 作成しない（Vercel管理）
- `.env*.local` - すべてのローカル環境変数

## .gitignore 設定

```gitignore
# Environment variables
.env
.env*.local
.env.production
!.env.docker.example      # Track Docker environment template
```

## トラブルシューティング

### `vercel dev` で Invalid API key エラーが出る場合

1. Vercel Dashboardで **Development** 環境にキーが設定されているか確認
2. ローカルの `.env` / `.env.local` が残っていないか確認（競合の原因）
3. `vercel dev` を再起動

```bash
# Vercel環境変数を確認
vercel env ls

# Development環境の値を確認（一時ファイルに出力）
vercel env pull /tmp/.env.check
cat /tmp/.env.check
rm /tmp/.env.check
```

### `vercel dev` で Hydration エラーが出る場合

`vercel dev` はサーバー側で `VERCEL=1` を設定するため、環境判定が `local` ではなく `vercel-develop` になる場合がある。`src/lib/utils/environment.ts` で `VERCEL_ENV === 'development'` のとき `local` を返すように対応済み。

### 誤ってGitにコミットしてしまった場合

```bash
# 1. 即座にGitから削除
git rm --cached .env.production
git commit -m "security: remove sensitive file"

# 2. 認証情報を即座にローテーション
# Supabase Dashboard → Settings → API → Reset service_role key

# 3. Git履歴から完全に削除（必要に応じて）
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.production" \
  --prune-empty --tag-name-filter cat -- --all
```

## ベストプラクティス

1. **`vercel dev` を標準の開発方法として使用する**
   - ローカルに秘密情報ファイルを持たない運用

2. **定期的な認証情報ローテーション**
   - 3-6ヶ月ごとにService Role Keyを更新

3. **最小権限の原則**
   - 必要な環境変数のみを設定
   - 不要な権限を持つキーは使わない

4. **監査ログの確認**
   - Supabase Dashboardで不審なアクセスをチェック

---

> 参考: このガイドに従うことで、認証情報漏洩のリスクを最小化できます。
