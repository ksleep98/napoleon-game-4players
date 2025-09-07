# 開発コマンド一覧

## パッケージマネージャー

**推奨:** pnpm（npmより高速・効率的）

## 開発サーバー

```bash
pnpm dev              # 開発サーバー起動 (http://localhost:3000)
pnpm build            # プロダクションビルド
pnpm start            # プロダクションサーバー起動
```

## コード品質

```bash
pnpm lint             # Biome リント + フォーマットチェック
pnpm lint:fix         # Biome 自動修正
pnpm format           # Biome フォーマット実行
pnpm format:check     # フォーマットチェック（修正なし）
pnpm type-check       # TypeScript型チェック
pnpm type-check:fast  # 高速型チェック（skipLibCheck）
```

## テスト

```bash
pnpm test             # Jest テスト実行
pnpm test:watch       # Jest ウォッチモード
pnpm test:coverage    # カバレッジ付きテスト
```

## CI/CD

```bash
pnpm ci-check         # 全品質チェック実行 (lint + type-check + format:check + test + build)
pnpm lint:fast        # 高速lintチェック（compact reporter）
```

## 使い分けガイド

### 開発中

- `pnpm dev` - 開発サーバー起動
- `pnpm test:watch` - テスト監視モード

### コミット前

- `pnpm ci-check` - 全チェック実行（推奨）
- `pnpm lint:fix` - 自動修正

### CI/CD環境

- GitHub Actionsが自動実行
- 並列処理で高速化
- 全チェック合格がマージ必須条件

## パフォーマンス

- `lint:fix`: ~15ms (高速自動修正)
- `type-check`: ~2s (型チェック)
- `test`: ~800ms (75テスト実行)
- `build`: ~2s (Next.js最適化ビルド)
