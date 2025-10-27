# Environment Variables Security Guide

## ⚠️ 重要なセキュリティルール

### 絶対に守るべきこと

1. **本番環境の認証情報をファイルに保存しない**
   - `.env.production` に実際の認証情報を入れない
   - Gitに追跡されるファイルには絶対に認証情報を書かない

2. **Vercel環境変数を使用する**
   - 本番環境の認証情報は**必ずVercel Dashboard**で設定
   - `SUPABASE_SERVICE_ROLE_KEY` は特に重要（admin権限）

3. **テンプレートファイルのみをGit管理**
   - `.env.production.example` はGit追跡OK（プレースホルダーのみ）
   - `.env.production` は`.gitignore`で除外

## 環境変数の設定方法

### ローカル開発環境

```bash
# .env.local ファイルを作成（Gitに追跡されない）
cp .env.example .env.local

# 実際の認証情報を設定
vim .env.local
```

### 本番環境（Vercel）

1. **Vercel Dashboard**にログイン
2. プロジェクトを選択
3. **Settings** → **Environment Variables**
4. 以下を**Production環境のみ**に設定：

```bash
NEXT_PUBLIC_SUPABASE_URL=https://[実際のプロジェクトID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[実際のanon key]
SUPABASE_SERVICE_ROLE_KEY=[実際のservice role key]
NEXT_PUBLIC_APP_ENV=production
NODE_ENV=production
```

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

- `.env.example` - ローカル開発用テンプレート
- `.env.production.example` - 本番環境用テンプレート
- プレースホルダーのみ含む

### ❌ Git追跡NG

- `.env` - 実際の認証情報
- `.env.local` - 実際の認証情報
- `.env.production` - 実際の認証情報
- `.env*.local` - すべてのローカル環境変数

## .gitignore 設定

```gitignore
# Environment variables
.env
.env*.local
.env.production

# Only track templates
!.env.example
!.env.production.example
```

## トラブルシューティング

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

### 環境変数が読み込まれない場合

```bash
# Vercel環境変数を確認
vercel env ls

# ローカルで本番環境をテスト
vercel env pull .env.local
pnpm build
pnpm start
```

## ベストプラクティス

1. **定期的な認証情報ローテーション**
   - 3-6ヶ月ごとにService Role Keyを更新

2. **最小権限の原則**
   - 必要な環境変数のみを設定
   - 不要な権限を持つキーは使わない

3. **監査ログの確認**
   - Supabase Dashboardで不審なアクセスをチェック

4. **チーム教育**
   - すべての開発者にこのガイドを共有
   - Pre-commit hookで`.env.production`のコミットをブロック

---

> 💡 **参考**: このガイドに従うことで、認証情報漏洩のリスクを最小化できます。
