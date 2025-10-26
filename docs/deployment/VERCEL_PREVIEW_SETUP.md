# Vercel Preview Deployment (本番設定) セットアップ

## 概要

Release PR (develop → main) が作成されると、Vercelが自動的にプレビューデプロイメントを作成し、GitHub ActionsがプレビューURLをPRにコメントします。

## 機能

- ✅ Release PR作成時にVercelが自動デプロイ
- ✅ Vercel環境変数を使用（本番設定）
- ✅ プレビューURLをPRに自動コメント
- ✅ E2Eテストを自動実行（プレビューURL使用）

## セットアップ手順

### 1. Vercel環境変数の設定

Vercel Dashboardで本番用の環境変数を設定:

1. [Vercel Dashboard](https://vercel.com)にアクセス
2. プロジェクトを選択
3. **Settings** → **Environment Variables**
4. 以下の変数を追加:

```
NEXT_PUBLIC_SUPABASE_URL = 本番SupabaseのURL
NEXT_PUBLIC_SUPABASE_ANON_KEY = 本番SupabaseのAnon Key
SUPABASE_SERVICE_ROLE_KEY = 本番SupabaseのService Role Key
NEXT_PUBLIC_APP_ENV = production
```

各変数で **Preview** 環境にもチェックを入れる

### 2. Vercel Git統合の確認

`vercel.json`で設定済み:

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

### 3. GitHub Actionsのパーミッション確認

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
