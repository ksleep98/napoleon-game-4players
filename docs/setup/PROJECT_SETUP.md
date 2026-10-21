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

- Node.js 22.23.4（現在使用中）
- pnpm（パッケージマネージャー - 高速・効率的）
- VSCode エディタ推奨

## 推奨 VSCode 拡張

- Biome (biomejs.biome)
- Tailwind CSS IntelliSense (bradlc.vscode-tailwindcss)

## プロジェクト最適化済み

### 🗑️ 削除された不要ファイル

- `docs/database/PERFORMANCE_SETUP.md` (重複)
- `docs/CODING_STANDARDS.md` (重複)
- `src/lib/supabase/schema.sql` (古いスキーマファイル)
- `scripts/kill-port-3000.js` (未使用スクリプト)
- `.github/workflows/.vscode-settings` (誤配置ファイル)

### 📦 パッケージ最適化

- **削除**: `critters`, `vercel` (未使用依存関係)
- **現在**: 37パッケージに最適化済み
- **効果**: 依存関係軽量化・メンテナンス性向上

### ⚡ パフォーマンス最適化

- PostgreSQL関数統合による50-120ms改善
- Vercel日本リージョン対応
- 詳細: [データベースパフォーマンス設定](../database/DATABASE_PERFORMANCE_SETUP.md)

## 初期セットアップコマンド

```bash
# プロジェクト初期化
mkdir -p src tests docs
pnpm init

# Next.js + TypeScript セットアップ
pnpm install next@15.4 react@latest react-dom@latest
pnpm install -D typescript @types/react @types/react-dom @types/node

# Tailwind CSS セットアップ
pnpm install -D tailwindcss postcss autoprefixer

# Supabase セットアップ
pnpm install @supabase/supabase-js

# Jest テストセットアップ
pnpm install -D jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom @testing-library/dom

# Biome セットアップ (ESLint/Prettier代替)
pnpm install -D @biomejs/biome
npx @biomejs/biome init

# Husky + lint-staged セットアップ
pnpm install -D husky lint-staged
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
2. `pnpm install` で依存関係解決
3. 開発サーバー起動: `pnpm dev`
4. http://localhost:3000 でアクセス確認
