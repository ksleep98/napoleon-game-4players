# Vercel Preview Deployment (本番設定) セットアップ

## 概要

Release PR (develop → main) が作成されると、GitHub ActionsがVercel CLIを使用して本番環境変数でビルド・デプロイし、プレビューURLをPRにコメントします。

**重要:** Vercelの自動デプロイは**ONのまま**でOKです。開発用プレビュー（開発環境変数）とは別に、本番環境変数を使用したプレビューが追加でデプロイされます。

## 機能

- ✅ Release PR作成時にGitHub Actionsが本番設定でデプロイ
- ✅ 本番Supabase環境変数を使用
- ✅ Perfボタン非表示（`NEXT_PUBLIC_ENABLE_PERF_MONITOR=false`）
- ✅ プレビューURLをPRに自動コメント
- ✅ E2Eテストを自動実行（プレビューURL使用）

## セットアップ手順

### 1. Vercel API Tokenの作成

1. https://vercel.com/account/tokens にアクセス
2. **Create Token** をクリック
3. Token名: `github-actions-napoleon-game`
4. Scope: **Full Account** を選択
5. Expiration: **No Expiration** または適切な期限を設定
6. **Create** をクリック
7. 表示されたTokenをコピー

### 2. GitHub Secretsの設定

以下のコマンドでSecretsを設定（既に設定済みの場合はスキップ）:

```bash
# Vercel Token
gh secret set VERCEL_TOKEN --repo ksleep98/napoleon-game-4players
# コピーしたTokenを貼り付けてEnterキーを押す

# Organization ID (既に設定済み)
echo "team_d6zobA7XarMx00GQB0D6TexU" | gh secret set VERCEL_ORG_ID

# Project ID (napoleon-game-dev - 既に設定済み)
echo "prj_GSp6xU2t6160ftNzYSiOsTSn6gcH" | gh secret set VERCEL_PROJECT_ID

# 本番Supabase環境変数 (既に設定済み)
# PROD_NEXT_PUBLIC_SUPABASE_URL
# PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY
# PROD_SUPABASE_SERVICE_ROLE_KEY
```

### 3. Vercel プロジェクトの環境変数設定

**重要**: プレビューデプロイメントで本番環境変数を使用するには、Vercelダッシュボードで環境変数を設定する必要があります。

1. https://vercel.com/kks-projects-204e9670/napoleon-game-dev/settings/environment-variables にアクセス
2. 以下の環境変数を **Preview** 環境に追加：

| 環境変数名                        | 値                             | 環境    |
| --------------------------------- | ------------------------------ | ------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | 本番SupabaseのURL              | Preview |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | 本番Supabaseの匿名キー         | Preview |
| `SUPABASE_SERVICE_ROLE_KEY`       | 本番SupabaseのService Role Key | Preview |
| `NEXT_PUBLIC_APP_ENV`             | `production`                   | Preview |
| `NEXT_PUBLIC_ENABLE_PERF_MONITOR` | `false`                        | Preview |

**注意**:

- これらの環境変数は **Preview** 環境にのみ設定してください
- **Production** や **Development** 環境には設定しないでください
- Service Role Keyは機密情報なので、安全に管理してください

### 4. Vercel Git統合の確認

`vercel.json`で設定済み（開発用プレビューのため、ONのまま）:

```json
{
  "git": {
    "deploymentEnabled": {
      "main": true,
      "develop": true
    }
  }
}
```

**注意:** Vercelの自動デプロイは開発環境変数を使用します。本番環境変数を使用したプレビューはGitHub Actionsで別途デプロイされます。

### 5. GitHub Actionsのパーミッション確認

Repositoryの設定でActions権限を確認:

1. **Settings** → **Actions** → **General**
2. **Workflow permissions** → **Read and write permissions** を選択
3. **Save**

## 動作フロー

### 1. Release PR作成

```bash
# developブランチにpushすると自動的にRelease PRが作成される
git push origin develop
```

### 2. Vercelプレビューデプロイ

Release PRが作成されると、自動的に:

1. 本番環境の設定でビルド
2. Vercelにプレビューデプロイ
3. プレビューURLを取得
4. PRにコメントを追加
5. E2Eテストを実行

### 3. PRコメント例

```markdown
## 🚀 Vercel Preview Deployment (Production Config)

✅ **Preview URL**: https://napoleon-game-xyz123.vercel.app

### 設定

- 本番環境の設定を使用
- 本番Supabaseデータベースに接続
- 本番環境変数を適用

### テスト方法

1. 上記URLにアクセス
2. 本番環境と同じ動作を確認
3. 問題なければこのPRをマージ

---

_⚡ Deployed by Vercel Preview_
```

## トラブルシューティング

### エラー: "Vercel Token is invalid"

**原因**: Tokenが無効または期限切れ

**解決方法**:

1. Vercel Dashboardで新しいTokenを作成
2. GitHub Secretsを更新

```bash
gh secret set VERCEL_TOKEN
```

### エラー: "Project not found"

**原因**: `.vercel/project.json`が存在しない

**解決方法**:

1. ローカルでVercel CLIを実行

```bash
pnpm add -g vercel
vercel link
```

2. 生成された`.vercel/project.json`をコミット

```bash
git add .vercel/project.json
git commit -m "chore: add Vercel project configuration"
git push
```

### プレビューURLが404エラー

**原因**: ビルドが失敗している可能性

**解決方法**:

1. GitHub Actionsのログを確認
2. Vercel Dashboardでデプロイメントステータスを確認

### エラー: "Service Role Key is required for server actions"

**原因**: Vercelプロジェクトのpreview環境に`SUPABASE_SERVICE_ROLE_KEY`が設定されていない

**解決方法**:

1. Vercel Dashboard (https://vercel.com/kks-projects-204e9670/napoleon-game-dev/settings/environment-variables) にアクセス
2. `SUPABASE_SERVICE_ROLE_KEY` を **Preview** 環境に追加
3. 値に本番SupabaseのService Role Keyを設定
4. **Save** をクリック
5. 次回のデプロイから環境変数が反映されます

## セキュリティ

### 本番データベースへのアクセス

プレビューデプロイメントは本番Supabaseデータベースに接続します:

- ✅ RLSポリシーが有効
- ✅ Service Role Keyは安全に管理
- ⚠️ テストデータは本番DBに作成されるため注意

### 推奨事項

1. **テストデータのクリーンアップ**: プレビューテスト後はテストデータを削除
2. **RLSポリシーの検証**: 本番環境と同じセキュリティ設定を確認
3. **アクセス制限**: プレビューURLは一時的なもの、共有に注意

## 関連ドキュメント

- [Vercel本番設定](./VERCEL_PRODUCTION_SETUP.md)
- [RLSセキュリティ設定](../security/RLS_SETUP.md)
- [GitHub Actions](../ci-cd/GITHUB_ACTIONS.md)

## FAQ

### Q: プレビューデプロイメントは本番環境に影響しますか?

A: いいえ、プレビューデプロイメントは独立したURLで動作します。ただし、本番Supabaseデータベースに接続するため、データベース操作は本番に影響します。

### Q: プレビューURLはいつまで有効ですか?

A: Vercelの設定によりますが、通常はPRがマージまたはクローズされるまで有効です。

### Q: コストはかかりますか?

A: Vercelの無料プランでは月に100GB帯域幅まで無料です。超過した場合は有料プランへのアップグレードが必要です。

### Q: 開発環境の設定でプレビューを作成できますか?

A: はい、別のワークフローを作成することで可能です。ただし、Release PRは本番設定でのテストが目的なため、現在は本番設定のみです。
