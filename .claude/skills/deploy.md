# Deploy Skill

## 目的

Vercelへの安全なデプロイを実行するスキル。環境変数チェック、ビルド検証、デプロイ実行を段階的に行います。

## 前提条件

- Vercel CLIがインストール済み（`vercel --version`で確認）
- 適切なVercelプロジェクトにリンク済み
- 環境変数が正しく設定されている

## デプロイフロー

### 1. Pre-deploy チェック

```bash
# ブランチ確認
git branch --show-current

# 変更確認
git status

# 最新のdevelopをプル
git pull origin develop

# 依存関係更新
pnpm install
```

### 2. ビルド検証

```bash
# TypeScript型チェック
pnpm type-check

# Linting
pnpm lint

# テスト実行
pnpm test

# ビルド成功確認
pnpm build
```

### 3. デプロイ実行

#### Preview デプロイ（feature/develop）

```bash
# Preview環境にデプロイ
vercel

# デプロイURL確認
# → https://napoleon-game-xxx.vercel.app
```

#### Production デプロイ（main）

```bash
# 本番環境にデプロイ（要確認）
vercel --prod

# または
pnpm deploy:prod
```

## 環境変数チェック

### 必須環境変数

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_ENV`

### 確認方法

```bash
# ローカル環境変数確認
cat .env.local

# Vercel環境変数確認
vercel env ls

# 環境変数追加（必要に応じて）
vercel env add NEXT_PUBLIC_SUPABASE_URL
```

## チェックリスト

デプロイ前に以下を確認：

- [ ] `develop`ブランチが最新
- [ ] `pnpm type-check`成功
- [ ] `pnpm lint`成功
- [ ] `pnpm test`成功
- [ ] `pnpm build`成功
- [ ] 環境変数が正しく設定されている
- [ ] RLSポリシーが正しく設定されている
- [ ] マイグレーションが完了している

## デプロイ後の確認

- [ ] デプロイURLにアクセス可能
- [ ] Supabase接続成功
- [ ] ゲーム起動成功
- [ ] マルチプレイヤー動作確認
- [ ] エラーログ確認（Vercel Dashboard）

## トラブルシューティング

### ビルドエラー

```bash
# ビルドログ確認
vercel logs

# ローカルでビルド再現
pnpm build
```

### 環境変数エラー

```bash
# 環境変数確認
vercel env ls

# 環境変数追加
vercel env add <NAME>
```

### Supabase接続エラー

- Supabase URLが正しいか確認
- ANON KEYが正しいか確認
- RLSポリシーが正しく設定されているか確認

## ロールバック

問題が発生した場合：

```bash
# 以前のデプロイに戻す
vercel rollback

# または特定のデプロイIDを指定
vercel rollback <deployment-id>
```

## 参考リンク

- [Vercelダッシュボード](https://vercel.com/dashboard)
- [デプロイドキュメント](../docs/ci-cd/DEPLOYMENT.md)
- [環境変数ガイド](../docs/security/ENVIRONMENT_VARIABLES.md)
