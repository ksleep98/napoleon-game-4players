# E2E Testing Guide - Napoleon Game

## 概要

Napoleon Game の E2E（End-to-End）テストは Playwright を使用して実装されています。実際のブラウザでゲーム全体のフローをテストし、UI/UX の品質を保証します。

**✅ 2025年1月更新: 全テストファイルを TypeScript 化完了**

- 型安全性向上とIntelliSense対応
- ヘルパークラスによるコード構造化
- 包括的な型定義とインターフェース追加

## セットアップ

### 依存関係のインストール

```bash
# Playwright とブラウザのインストール
pnpm install
pnpm exec playwright install
```

### 必要な環境

- Node.js 22.14.0+
- pnpm 9+
- Chromium、Firefox、Webkit ブラウザ（自動インストール）

## テスト実行

### 基本的な実行方法

```bash
# 全ての E2E テストを実行
pnpm test:e2e

# ヘッドモード（ブラウザを表示）で実行
pnpm test:e2e:headed

# UI モードで実行（テスト実行の可視化）
pnpm test:e2e:ui

# デバッグモードで実行
pnpm test:e2e:debug

# 詳細ログ出力（推奨：進行状況を詳しく確認）
pnpm test:e2e:verbose

# 進行状況をライン表示
pnpm test:e2e:progress

# 詳細モード（スクリーンショット・ビデオ付き）
pnpm test:e2e:detailed

# CI用実行（レポート最小化）
pnpm test:e2e:ci

# レポートを表示
pnpm test:e2e:report
```

**推奨：初回実行時や問題調査時**

```bash
# 詳細ログとスクリーンショットで実行
pnpm test:e2e:verbose
```

**サーバー起動で問題がある場合（推奨解決策）**

1. **サーバー状態確認**

```bash
# 開発サーバーの状態をチェック
pnpm test:e2e:check
```

2. **手動サーバー起動**

```bash
# ターミナル1: 開発サーバー起動
pnpm dev

# ターミナル2: サーバー確認
pnpm test:e2e:check

# ターミナル2: テスト実行（サーバー自動起動なし）
pnpm test:e2e:no-server
```

3. **手動実行手順を表示**

```bash
pnpm test:e2e:manual
```

**💡 重要**: `pnpm test:e2e:verbose` でテストが停止する場合は、上記の手動起動方法を使用してください。

### 自動サーバー起動テスト（推奨）

**🚀 新機能: 完全自動化されたE2Eテスト**

```bash
# サーバー自動起動付きE2Eテスト（推奨）
pnpm test:e2e:auto

# 基本テストのみ（高速）
pnpm test:e2e:auto:basic

# フルテスト（HTML レポート付き）
pnpm test:e2e:auto:full
```

**特徴**:

- ✅ サーバーが起動していない場合は自動起動
- ✅ 既に起動している場合はそのまま使用
- ✅ テスト完了後に自動的にサーバー停止
- ✅ 適切なエラーハンドリングと cleanup

### Pre-commit フックでのE2Eテスト

```bash
# Pre-commit設定の選択
pnpm setup:pre-commit
```

**選択肢**:

1. **🏃 Fast (現在)**: 型チェック + 単体テスト (2-3分)
2. **🔍 Complete**: Fast + E2Eテスト (5-8分)
3. **⚡ Minimal**: Lint + フォーマットのみ (30秒)
4. **🚫 Disable**: フック無効化

### 特定のテストファイル実行

```bash
# 基本機能テストのみ
pnpm exec playwright test basic.spec.ts

# ゲームフローテストのみ
pnpm exec playwright test game-flow.spec.ts

# パフォーマンステストのみ
pnpm exec playwright test performance.spec.ts

# 特殊ルールテストのみ
pnpm exec playwright test special-rules.spec.ts
```

### ブラウザ指定実行

```bash
# Chrome のみで実行
pnpm exec playwright test --project=chromium

# Firefox のみで実行
pnpm exec playwright test --project=firefox

# Safari のみで実行
pnpm exec playwright test --project=webkit
```

## テスト構成

### テストファイル構成

```
tests/e2e/
├── basic.spec.ts           # 基本機能テスト（ページ読み込み、UI要素）
├── game-flow.spec.ts       # ゲーム全体フロー（Napoleon宣言→カードプレイ）
├── special-rules.spec.ts   # 特殊ルール・ゲーム機能テスト
└── performance.spec.ts     # パフォーマンス・アクセシビリティテスト
```

### テスト項目

#### 基本機能テスト (`basic.spec.ts`)

- ページ読み込み確認
- 基本UI要素の表示
- レスポンシブデザイン対応（複数ビューポート）

#### ゲームフローテスト (`game-flow.spec.ts`)

- Quick Start からゲーム開始
- Napoleon 宣言フェーズ（型安全なセレクター）
- カードプレイフェーズ（GameTestHelper使用）
- ゲーム進行確認
- エラーハンドリング（包括的エラー監視）

#### 特殊ルールテスト (`special-rules.spec.ts`)

- 複数ゲームセッション処理（メモリリークテスト）
- 切り札表示確認（型付きバリデーション）
- ターン表示機能
- カードインタラクション（SpecialRulesTestHelper）
- スコア・進行状況表示
- ゲーム完了処理

#### パフォーマンステスト (`performance.spec.ts`)

- ページ読み込み時間測定（MemoryMetrics型）
- 高速操作対応テスト（PerformanceTestHelper）
- メモリリーク検出（型安全なメトリクス取得）
- アクセシビリティチェック
- ネットワーク切断対応
- 複数画面サイズ対応（ViewportConfig型）

## 設定

### Playwright 設定 (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  baseURL: 'http://localhost:3000',

  // CI での実行設定
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  // TypeScript サポート
  fullyParallel: true,
  forbidOnly: !!process.env.CI,

  // ブラウザ設定
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // 開発サーバー自動起動
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
```

## CI/CD 統合

### GitHub Actions

E2E テストは GitHub Actions で自動実行されます：

```yaml
# Push to main/develop または 'e2e-test' ラベル付きPRで実行
e2e-tests:
  runs-on: ubuntu-latest
  if: |
    github.event_name == 'push' ||
    (github.event_name == 'pull_request' && contains(github.event.pull_request.labels.*.name, 'e2e-test'))
```

### 実行条件

1. **自動実行**: `main` または `develop` ブランチへのプッシュ
2. **手動実行**: PR に `e2e-test` ラベルを追加
3. **失敗時**: テストレポートが自動アップロード

## ログとスクリーンショット機能

### 詳細ログ出力

各テストファイルには詳細なログ出力機能が実装されています：

```typescript
// ログレベル別出力例
🎮 14:30:15 [SETUP] Starting Quick Game...
🃏 14:30:18 [NAPOLEON] Napoleon declaration phase detected
📸 14:30:20 Screenshot saved: game-phase-napoleonPhase-2025-01-11T14-30-20.png
✅ 14:30:22 Napoleon declaration clicked
🤖 14:30:25 [AI_TURNS] Letting AI handle remaining turns...
```

### 自動スクリーンショット

テスト実行中に以下のタイミングで自動スクリーンショット取得：

- **テスト開始時**: 初期状態
- **各ゲームフェーズ**: Napoleon宣言、カードプレイ等
- **重要なアクション前後**: ボタンクリック、カード選択
- **テスト完了時**: 最終状態
- **エラー発生時**: 問題調査用

### 実行結果確認

```bash
# スクリーンショット確認
ls test-results/screenshots/

# テストレポート確認
pnpm test:e2e:report

# 詳細なHTML レポート（推奨）
pnpm test:e2e:detailed
```

## トラブルシューティング

### よくある問題と解決方法

#### 1. ブラウザが起動しない

```bash
# ブラウザを再インストール
pnpm exec playwright install --force
```

#### 2. タイムアウトエラー

```bash
# タイムアウト時間を延長
pnpm exec playwright test --timeout=60000
```

#### 3. ポート競合エラー

```bash
# 別のポートで開発サーバーを起動
PORT=3001 pnpm dev
```

#### 4. テストが不安定

```bash
# リトライ回数を増加
pnpm exec playwright test --retries=3
```

### デバッグ方法

#### 1. ヘッドモードでの確認

```bash
pnpm test:e2e:headed
```

#### 2. UI モードでの詳細確認

```bash
pnpm test:e2e:ui
```

#### 3. デバッグモードでステップ実行

```bash
pnpm test:e2e:debug
```

#### 4. スクリーンショット確認

テスト失敗時のスクリーンショットは `test-results/` に保存されます。

## TypeScript 対応の詳細

### ヘルパークラス

各テストファイルには専用のヘルパークラスを実装：

```typescript
// GameTestHelper (game-flow.spec.ts)
class GameTestHelper {
  constructor(private page: Page) {}

  async startQuickGame(): Promise<void>;
  async findVisibleElement(
    selectors: readonly string[]
  ): Promise<Locator | null>;
  async waitForGamePhase(phase: keyof GamePhaseSelectors): Promise<boolean>;
}

// SpecialRulesTestHelper (special-rules.spec.ts)
class SpecialRulesTestHelper {
  async hasAnyIndicator(indicators: string[]): Promise<boolean>;
  async checkTrumpSuit(): Promise<{ hasTrump: boolean; isValid: boolean }>;
}

// PerformanceTestHelper (performance.spec.ts)
class PerformanceTestHelper {
  async getMemoryMetrics(): Promise<MemoryMetrics | null>;
  async measureLoadTime(): Promise<number>;
}
```

### 型定義インターフェース

```typescript
// ゲーム要素選択のための型定義
interface GamePhaseSelectors {
  napoleonPhase: string[];
  playingPhase: string[];
  gameState: string[];
}

// パフォーマンス測定用
interface MemoryMetrics {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
}

// ビューポート設定用
interface ViewportConfig {
  width: number;
  height: number;
  name?: string;
}
```

### TypeScript の利点

1. **型安全性**: コンパイル時エラー検出
2. **IntelliSense**: IDE での自動補完とドキュメント表示
3. **リファクタリング**: 安全な変数名変更・構造変更
4. **コード品質**: 型チェックによるバグ予防

## ベストプラクティス

### テスト作成時の注意点

1. **要素選択**: `data-testid` 属性を優先使用
2. **待機処理**: 適切な待機メソッドを使用
3. **テスト独立性**: 各テストは独立して実行可能にする
4. **エラーハンドリング**: 例外処理を適切に実装（`.catch(() => false)`パターン）
5. **パフォーマンス**: 不要な待機時間を避ける
6. **型定義**: ヘルパークラスとインターフェースの活用

### メンテナンス

1. **定期更新**: Playwright とブラウザの定期更新
2. **テスト見直し**: UI変更に合わせたテスト調整
3. **レポート確認**: CI での実行結果定期確認

## 参考資料

- [Playwright 公式ドキュメント](https://playwright.dev/)
- [Napoleon Game 実装状況](../game-logic/IMPLEMENTATION_STATUS.md)
- [コーディングルール](../development/CODING_RULES.md)
