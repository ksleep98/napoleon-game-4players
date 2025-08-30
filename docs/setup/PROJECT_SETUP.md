# プロジェクトセットアップ

## 技術スタック

- 言語: TypeScript
- フレームワーク: Next.js 15.4 (App Router)
- UI ライブラリ: React 19.x
- スタイリング: Tailwind CSS
- データベース: Supabase (PostgreSQL)
- テストフレームワーク: Jest + React Testing Library
- コード品質: Biome (Linter + Formatter)
- エディター設定: .editorconfig

## 環境要件

- Node.js 22.14.0（現在使用中）
- npm（パッケージマネージャー）
- VSCode エディタ推奨

## 推奨 VSCode 拡張

- Biome (biomejs.biome)
- Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)
- Prisma (Prisma.prisma)

## 初期セットアップコマンド

```bash
# プロジェクト初期化
mkdir -p src tests docs
npm init -y

# Next.js + TypeScript セットアップ
npm install next@15.4 react@latest react-dom@latest
npm install -D typescript @types/react @types/react-dom @types/node

# Tailwind CSS セットアップ
npm install -D tailwindcss postcss autoprefixer

# Supabase セットアップ
npm install @supabase/supabase-js

# Jest テストセットアップ
npm install -D jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/dom

# Biome セットアップ (ESLint/Prettier代替)
npm install -D @biomejs/biome
npx @biomejs/biome init

# Husky + lint-staged セットアップ
npm install -D husky lint-staged
npx husky init
```

## 作成済み設定ファイル

- ✅ tsconfig.json - TypeScript 設定
- ✅ next.config.js - Next.js 設定
- ✅ tailwind.config.js - Tailwind CSS 設定
- ✅ postcss.config.js - PostCSS 設定
- ✅ biome.json - Biome 設定（linter + formatter）
- ✅ jest.config.js + jest.setup.js - Jest 設定
- ✅ .editorconfig - エディター設定
- ✅ .gitignore - Git 除外設定
- ✅ docs/CODING_STANDARDS.md - コーディング規約
- ✅ src/app/ - Next.js App Router 構成
- ✅ src/lib/supabase/ - Supabase統合・リアルタイム同期・データベーススキーマ

## インストール手順

1. リポジトリクローン
2. `npm install` で依存関係解決
3. 開発サーバー起動: `npm run dev`
4. http://localhost:3000 でアクセス確認
