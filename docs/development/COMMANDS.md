# 開発コマンド一覧

## 開発サーバー

```bash
npm run dev           # 開発サーバー起動 (http://localhost:3000)
npm run build         # プロダクションビルド
npm run start         # プロダクションサーバー起動
```

## コード品質

```bash
npm run lint          # Biome リント + フォーマットチェック
npm run lint:fix      # Biome 自動修正
npm run format        # Biome フォーマット実行
npm run format:check  # フォーマットチェック（修正なし）
npm run type-check    # TypeScript型チェック
npm run type-check:fast # 高速型チェック（skipLibCheck）
```

## テスト

```bash
npm test              # Jest テスト実行
npm run test:watch    # Jest ウォッチモード
npm run test:coverage # カバレッジ付きテスト
```

## CI/CD

```bash
npm run ci-check      # 全品質チェック実行 (lint + type-check + format:check + test + build)
npm run lint:fast     # 高速lintチェック（compact reporter）
```

## 使い分けガイド

### 開発中

- `npm run dev` - 開発サーバー起動
- `npm run test:watch` - テスト監視モード

### コミット前

- `npm run ci-check` - 全チェック実行（推奨）
- `npm run lint:fix` - 自動修正

### CI/CD環境

- GitHub Actionsが自動実行
- 並列処理で高速化
- 全チェック合格がマージ必須条件

## パフォーマンス

- `lint:fix`: ~15ms (高速自動修正)
- `type-check`: ~2s (型チェック)
- `test`: ~800ms (75テスト実行)
- `build`: ~2s (Next.js最適化ビルド)
