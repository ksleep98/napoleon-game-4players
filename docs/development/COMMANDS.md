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

## プロジェクト管理・クリーンアップ

```bash
# ブランチクリーンアップ（マージ後の整理）
pnpm cleanup              # インタラクティブ版（確認あり）
pnpm cleanup:smart        # GitHub CLI連携版（推奨）
pnpm cleanup:polling      # ポーリング自動削除

# 自動クリーンアップ設定
pnpm setup:auto-cleanup enable   # 自動クリーンアップ有効化
pnpm setup:auto-cleanup disable  # 自動クリーンアップ無効化
pnpm setup:auto-cleanup status   # 設定状況確認

# GitHub連携設定
pnpm setup:github-cleanup # GitHub CLI設定
pnpm setup:pre-commit     # pre-commit hooks設定
```

## E2Eテスト（Playwright）

```bash
pnpm test:e2e             # E2Eテスト実行
pnpm test:e2e:headed      # ヘッド付きモード
pnpm test:e2e:ui          # UIモード
pnpm test:e2e:debug       # デバッグモード
pnpm test:e2e:auto        # サーバー自動起動版

# レポート・結果確認
pnpm test:e2e:report      # E2Eレポート生成
pnpm test:e2e:html        # HTMLレポート表示
```

## その他のユーティリティ

```bash
# フォーマット（Markdown/YAML）
pnpm format:other         # Prettier実行
pnpm format:other:check   # Prettierチェック

# 包括的品質チェック
pnpm ci-fix               # lint:fix + format + type-check + test
```

## パフォーマンス（最適化済み）

- `lint:fix`: ~15ms (高速自動修正)
- `type-check`: ~2s (型チェック)
- `test`: ~800ms (141テスト実行)
- `build`: ~2s (Next.js最適化ビルド)
- **依存関係**: 37パッケージ（最適化済み）
- **不要ファイル**: 6ファイル削除済み
