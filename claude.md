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
  aa

# 使用言語・技術スタック

- 言語: React
- 言語: TypeScript
- フレームワーク: Next.js 15.4
- その他: Tailwind CSS, Prisma, Jest (テストフレームワーク)

# GitHub 登録

- GitHub リポジトリは「napoleon-game-4players」を想定
- ブランチ戦略は Git Flow に準拠
  - main（本番リリース）
  - develop（開発用）
  - feature/xxxx（機能単位ブランチ）
- コミットメッセージは「Conventional Commits」規約に従うこと

# 必要なインストール・環境設定

- Node.js 20.x（推奨）
- yarn または npm（どちらかを使用）
- VSCode エディタ推奨
- 推奨 VSCode 拡張
  - Biome
  - Tailwind CSS IntelliSense

# 作業の進め方

1. まずはプロジェクトルートにて `yarn install` を実行し依存関係を解決すること。
2. 主要なディレクトリ構成を作成し、readme.md を編集。
3. 必要に応じて GitHub リポジトリ作成と初期セットアップを行う。
4. 以降の機能は feature ブランチを使い細かく分けて開発。

# 注意事項

- コードはなるべく日本語コメントは控え英語中心で記述する
- 重要なロジックには日本語説明コメントを補足する
- コーディング規約は ESLint ルールに準ずること

# 更新履歴

- 2025-08-23: 初版作成
