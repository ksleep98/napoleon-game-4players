# Docker シンプルセットアップガイド

## 概要

このガイドでは、Docker Composeを使わずに、シンプルなDockerコンテナ内でNapoleon Gameを実行する方法を説明します。

## 特徴

- ✅ シンプルなDockerfileとbashスクリプト
- ✅ インタラクティブにコンテナ内でコマンド実行
- ✅ ホットリロード対応（srcとpublicディレクトリをマウント）
- ✅ 必要に応じてShellに入って手動操作可能
- ✅ Supabaseは外部（Supabase Cloud）を使用

## 前提条件

- Docker Desktop インストール済み
- Supabase Cloud プロジェクト作成済み（または他の外部データベース）

## セットアップ手順

### 1. Dockerイメージをビルド

```bash
./docker-dev.sh build
```

または直接Dockerコマンドで:

```bash
docker build -t napoleon-game-dev .
```

### 2. コンテナを起動してpnpm devを実行

```bash
./docker-dev.sh run
```

これで自動的に以下が実行されます:

- コンテナが起動
- `pnpm dev` が実行される
- http://localhost:3000 でアクセス可能

### 3. コンテナのシェルに入る（インタラクティブモード）

```bash
./docker-dev.sh shell
```

シェルに入った後、手動でコマンド実行:

```bash
# 開発サーバー起動
pnpm dev

# テスト実行
pnpm test

# Lint実行
pnpm lint

# ビルド
pnpm build

# 終了
exit
```

### 4. カスタムコマンドを実行

```bash
# テスト実行
./docker-dev.sh exec 'pnpm test'

# Lint実行
./docker-dev.sh exec 'pnpm lint'

# CI チェック
./docker-dev.sh exec 'pnpm ci-check'

# ビルド
./docker-dev.sh exec 'pnpm build'
```

## docker-dev.sh スクリプトの使い方

### コマンド一覧

```bash
# イメージをビルド
./docker-dev.sh build

# コンテナを起動してpnpm devを実行（デフォルト）
./docker-dev.sh run

# コンテナのシェルに入る
./docker-dev.sh shell

# カスタムコマンドを実行
./docker-dev.sh exec 'コマンド'

# ヘルプを表示
./docker-dev.sh --help
```

### 直接Dockerコマンドを使う場合

スクリプトを使わずに直接Dockerコマンドを実行することもできます:

```bash
# イメージをビルド
docker build -t napoleon-game-dev .

# pnpm devを実行
docker run -it --rm \
  -p 3000:3000 \
  -v "$(pwd)/src:/app/src" \
  -v "$(pwd)/public:/app/public" \
  -e NODE_ENV=development \
  napoleon-game-dev \
  pnpm dev

# Shellに入る
docker run -it --rm \
  -p 3000:3000 \
  -v "$(pwd)/src:/app/src" \
  -v "$(pwd)/public:/app/public" \
  -e NODE_ENV=development \
  napoleon-game-dev \
  bash

# カスタムコマンド実行
docker run -it --rm \
  -v "$(pwd)/src:/app/src" \
  napoleon-game-dev \
  pnpm test
```

## ホットリロードについて

以下のディレクトリがボリュームマウントされているため、ファイルを変更すると自動的に反映されます:

- `src/` - アプリケーションソースコード
- `public/` - 静的ファイル

**注意**: `package.json`や`pnpm-lock.yaml`を変更した場合は、イメージを再ビルドする必要があります:

```bash
./docker-dev.sh build
```

## 環境変数の設定

環境変数は以下の方法で設定できます:

### 方法1: .env.localファイルを使用（推奨）

```bash
# .env.localファイルを作成
cat > .env.local << EOF
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_ENABLE_PERF_MONITOR=true
EOF
```

Next.jsは自動的に`.env.local`を読み込みます。

### 方法2: docker runコマンドで直接指定

```bash
docker run -it --rm \
  -p 3000:3000 \
  -v "$(pwd)/src:/app/src" \
  -e NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  napoleon-game-dev \
  pnpm dev
```

## トラブルシューティング

### ポート3000が既に使用されている

別のポートを使用:

```bash
docker run -it --rm \
  -p 3001:3000 \
  -v "$(pwd)/src:/app/src" \
  napoleon-game-dev \
  pnpm dev
```

http://localhost:3001 でアクセスできます。

### イメージのリビルドが必要な場合

依存関係を更新した場合:

```bash
./docker-dev.sh build
```

キャッシュを使わずにビルド:

```bash
docker build --no-cache -t napoleon-game-dev .
```

### コンテナが起動しない

実行中のコンテナを確認:

```bash
docker ps -a
```

既存のコンテナを削除:

```bash
docker rm napoleon-game-container
```

### ホットリロードが動作しない

1. ボリュームマウントが正しいか確認
2. ファイルのパーミッションを確認
3. コンテナを再起動

```bash
# Ctrl+C で停止
./docker-dev.sh run
```

## Docker vs Docker Compose

### Docker（このガイド）

**メリット:**

- シンプル・軽量
- 外部Supabaseを使用
- 素早く起動

**デメリット:**

- データベースは別途セットアップが必要

**おすすめ:**

- 既にSupabase Cloudを使用している
- シンプルな環境が好き
- すぐに開発を始めたい

### Docker Compose

**メリット:**

- 完全なローカル環境（DB含む）
- ネットワーク不要
- 本番環境に近い構成

**デメリット:**

- 複雑・リソースを多く使用
- 起動に時間がかかる

**おすすめ:**

- オフラインで開発したい
- ローカルでデータベースを完全に制御したい

詳細: [Docker Composeセットアップ](./DOCKER_SETUP.md)

## 次のステップ

1. **開発開始**: http://localhost:3000 でアクセス
2. **コード編集**: `src/`以下のファイルを編集
3. **テスト実行**: `./docker-dev.sh exec 'pnpm test'`

## 関連ドキュメント

- [Docker Composeセットアップ](./DOCKER_SETUP.md) - フルスタックローカル環境
- [プロジェクトセットアップ](./PROJECT_SETUP.md) - 通常の開発環境
- [開発コマンド一覧](../development/COMMANDS.md) - pnpm scripts
