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

- GitHub リポジトリは「napoleon-game-4players」を想定
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

# 更新履歴

- 2025-08-23: 初版作成
- 2025-08-23: プロジェクトセットアップ完了、実行コマンド・設定詳細追記
