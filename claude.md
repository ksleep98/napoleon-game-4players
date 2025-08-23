# プロジェクト概要

このプロジェクトは以下の仕様で進めます。

- Project: Napoleon Game (4 Players)
- Location: /Users/kk/napoleon-game-4players

# プロジェクトルート構成

- /src : ソースコードディレクトリ
- /tests : テストコードディレクトリ
- /docs : ドキュメント
- readme.md : プロジェクト概要説明
- claude.md : プロジェクト指示ファイル（このファイル）
- .gitignore : Git 管理除外ファイル設定

# 使用言語・技術スタック

- 言語: TypeScript
- フレームワーク: Next.js 15.4 (App Router)
- UI ライブラリ: React 19.x
- スタイリング: Tailwind CSS
- データベース: Prisma ORM (SQLite)
- テストフレームワーク: Jest + React Testing Library
- コード品質: Biome (Linter + Formatter)
- エディター設定: .editorconfig

# GitHub 登録

- GitHub リポジトリは「napoleon-game-4players」
- ブランチ戦略は Git Flow に準拠
  - main（本番リリース）
  - develop（開発用）
  - feature/xxxx（機能単位ブランチ）
- コミットメッセージは「Conventional Commits」規約に従うこと

# 必要なインストール・環境設定

- Node.js 22.14.0（現在使用中）
- npm（パッケージマネージャー）
- VSCode エディタ推奨
- 推奨 VSCode 拡張
  - Biome (biomejs.biome)
  - Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)
  - Prisma (Prisma.prisma)

# 作業の進め方

1. まずはプロジェクトルートにて `npm install` を実行し依存関係を解決すること。
2. 主要なディレクトリ構成を作成し、readme.md を編集。
3. 必要に応じて GitHub リポジトリ作成と初期セットアップを行う。
4. 以降の機能は feature ブランチを使い細かく分けて開発。

# 注意事項

- コードはなるべく日本語コメントは控え英語中心で記述する
- 重要なロジックには日本語説明コメントを補足する
- コーディング規約は Biome + docs/CODING_STANDARDS.md に準ずること

# 実行済みコマンド・設定

## プロジェクトセットアップ (完了)

```bash
# プロジェクト初期化
mkdir -p src tests docs
npm init -y

# Next.js + TypeScript セットアップ
npm install next@15.4 react@latest react-dom@latest
npm install -D typescript @types/react @types/react-dom @types/node

# Tailwind CSS セットアップ
npm install -D tailwindcss postcss autoprefixer

# Prisma ORM セットアップ
npm install -D prisma
npm install @prisma/client
npx prisma init

# Jest テストセットアップ
npm install -D jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/dom

# Biome セットアップ (ESLint/Prettier代替)
npm install -D @biomejs/biome
npx @biomejs/biome init
```

## 作成済みファイル・設定 (完了)

- ✅ tsconfig.json - TypeScript 設定
- ✅ next.config.js - Next.js 設定
- ✅ tailwind.config.js - Tailwind CSS 設定
- ✅ postcss.config.js - PostCSS 設定
- ✅ biome.json - Biome 設定（linter + formatter）
- ✅ jest.config.js + jest.setup.js - Jest 設定
- ✅ .editorconfig - エディター設定
- ✅ .gitignore - Git 除外設定
- ✅ README.md - プロジェクト概要
- ✅ docs/CODING_STANDARDS.md - コーディング規約
- ✅ src/app/ - Next.js App Router 構成
- ✅ prisma/schema.prisma - データベーススキーマ

## 使用可能なコマンド

```bash
# 開発
npm run dev           # 開発サーバー起動
npm run build         # プロダクションビルド
npm run start         # プロダクションサーバー起動

# コード品質
npm run lint          # Biome リント + フォーマットチェック
npm run lint:fix      # Biome 自動修正
npm run format        # Biome フォーマット実行
npm run type-check    # TypeScript型チェック

# テスト
npm test              # Jest テスト実行
npm run test:watch    # Jest ウォッチモード
npm run test:coverage # カバレッジ付きテスト
```

# Napoleon Game 実装完了 ✅

## 実装済み機能

### 📁 Core Game Logic

- ✅ `src/types/game.ts` - 型定義（Card, Player, GameState 等）
- ✅ `src/lib/constants.ts` - ゲーム定数・デッキ作成
- ✅ `src/utils/cardUtils.ts` - カードシャッフル・配布ロジック
- ✅ `src/lib/gameLogic.ts` - ターンベースゲームロジック
- ✅ `src/lib/scoring.ts` - 勝敗判定・スコア計算

### 🗄️ Supabase Integration

- ✅ `src/lib/supabase/client.ts` - データベース接続設定
- ✅ `src/lib/supabase/gameService.ts` - ゲーム状態の保存・読込・リアルタイム監視
- ✅ `src/lib/supabase/schema.sql` - データベーススキーマ
- ✅ `.env.local.example` - 環境変数設定例

### 🎮 UI Components

- ✅ `src/components/game/Card.tsx` - カードコンポーネント
- ✅ `src/components/game/PlayerHand.tsx` - プレイヤー手札表示
- ✅ `src/components/game/GameBoard.tsx` - ゲームボード（4 人配置）
- ✅ `src/components/game/NapoleonSelector.tsx` - ナポレオン宣言 UI
- ✅ `src/components/game/GameStatus.tsx` - ゲーム状況表示

### 📱 Pages & Hooks

- ✅ `src/hooks/useGameState.ts` - ゲーム状態管理カスタムフック
- ✅ `src/app/page.tsx` - ホームページ（ランディングページ）
- ✅ `src/app/rooms/page.tsx` - ゲームルーム一覧
- ✅ `src/app/game/[gameId]/page.tsx` - ゲームプレイページ

## 実装済みゲーム仕様

### 🎴 基本仕様

- ✅ 4 人用ナポレオンゲーム
- ✅ 48 枚カード使用（52 枚から 2 のカード 4 枚を除く）
- ✅ 各プレイヤー 12 枚ずつ配布
- ✅ 4 枚の隠しカード
- ✅ Fisher-Yates アルゴリズムによるシャッフル

### 🏆 ゲームフロー

- ✅ ナポレオン宣言フェーズ
- ✅ 副官選択（ナポレオンがカード指定可能）
- ✅ ターン制カードプレイ
- ✅ フォロー義務の実装
- ✅ トリック勝者判定
- ✅ スコア計算（ナポレオン 8 トリック以上で勝利）

### 💾 データ管理

- ✅ ゲーム状態の Supabase 保存
- ✅ リアルタイム同期
- ✅ ゲーム結果の記録
- ✅ プレイヤー統計情報

### 🎨 UI/UX

- ✅ レスポンシブデザイン
- ✅ カードアニメーション
- ✅ 4 人プレイヤー配置（上下左右）
- ✅ 進行状況表示
- ✅ チーム表示（ナポレオン・副官・市民）

## 環境・設定修正

### 📦 パッケージ管理

- ✅ Yarn → NPM 移行完了
- ✅ `package-lock.json` 生成
- ✅ `npm run dev` コマンド対応

### 🛠️ 開発ツール

- ✅ ESLint + Prettier → Biome 移行完了
- ✅ コード品質向上・高速化
- ✅ `.editorconfig` 設定

### 🎨 スタイル設定

- ✅ Tailwind CSS v3 対応（v4 互換性問題解決）
- ✅ PostCSS 設定修正
- ✅ 開発サーバー正常起動確認

## 動作確認

- ✅ `npm run dev` で開発サーバー起動（http://localhost:3001）
- ✅ TypeScript 型チェック通過
- ✅ Biome リント・フォーマット正常動作
- ✅ Quick Start (Demo) 機能実装済み

## 次のステップ

1. **Supabase プロジェクト設定**

   - プロジェクト作成
   - `schema.sql` でテーブル作成
   - 環境変数設定（`.env.local`）

2. **4 人プレイヤーで COM ３人用の実装**

   - 初期動作確認
   - ４人用ルール追加

# 更新履歴

- 2025-08-23: 初版作成
- 2025-08-23: プロジェクトセットアップ完了、実行コマンド・設定詳細追記
- 2025-08-23: Napoleon Game 実装中、Yarn→NPM 移行、Biome 導入、Tailwind CSS 修正
