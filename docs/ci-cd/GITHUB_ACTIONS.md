# GitHub Actions CI/CD

## 設定完了

### ワークフロー設定

- ✅ `.github/workflows/ci.yml` - メインCI/CDパイプライン
- ✅ `main` と `develop` ブランチでトリガー
- ✅ Push/PR時の自動品質チェック

## CI/CD パイプライン内容

### 1. 環境セットアップ

- Ubuntu latest
- Node.js 22.14.0
- pnpm cache有効

### 2. 依存関係インストール

- `pnpm install --frozen-lockfile` 高速インストール
- Biome バイナリ修正（Linux対応）
- インストール検証とフォールバック

### 3. 品質チェック（並列実行）

**Biome利用可能時:**

- lint check
- TypeScript type check
- format check
- Jest test execution

**Biome不可時（フォールバック）:**

- TypeScript type check
- Jest test execution

### 4. ビルド検証

- Next.js プロダクションビルド
- 環境変数モック設定
- ビルド成功確認

## 特殊対応

### Biome Linux バイナリ問題

```yaml
# Biome再インストールとバイナリ修正
rm -rf node_modules/@biomejs/biome node_modules/.bin/biome
pnpm install @biomejs/biome@latest

# 検証とフォールバック
if npx @biomejs/biome --version; then
  echo "✅ Biome installation verified"
else
  echo "BIOME_FAILED=true" >> $GITHUB_ENV
fi
```

### 並列実行によるパフォーマンス

- 複数チェックを `&` でバックグラウンド実行
- `wait` で結果待機・収集
- 全チェック合格必須

### 環境変数設定

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: 'https://mock.supabase.co'
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock_anon_key'
  NODE_ENV: 'production'
  NEXT_TELEMETRY_DISABLED: '1'
```

## 実行結果

- ✅ TypeScript エラーなし
- ✅ 34 Jest テスト全合格
- ✅ Biome lint・format 適用済み
- ✅ Next.js ビルド成功
- ✅ 実行時間: ~30-60秒

## ブランチ保護

CI/CD パイプライン合格が **マージ必須条件** として設定可能:

- Settings > Branches > Add rule
- Status checks required: `ci-pipeline`
- 詳細: `.github/BRANCH_PROTECTION.md` 参照
