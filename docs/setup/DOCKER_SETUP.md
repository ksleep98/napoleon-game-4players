# Docker Compose セットアップガイド

## 概要

Docker Composeを使用してNapoleon Gameをローカル環境で実行できます。このセットアップには以下が含まれます:

- Next.js 15アプリケーション (開発サーバー)
- Supabase PostgreSQL データベース
- Supabase Auth (GoTrue)
- Supabase REST API (PostgREST)
- Supabase Studio (データベース管理UI・オプショナル)

## 前提条件

- Docker Desktop インストール済み
  - Mac: https://docs.docker.com/desktop/install/mac-install/
  - Windows: https://docs.docker.com/desktop/install/windows-install/
- Docker Compose v2.0以上

## セットアップ手順

### 1. 環境変数ファイルの作成

```bash
# .env.docker.exampleをコピーして.envを作成
cp .env.docker.example .env
```

### 2. 環境変数の設定 (オプショナル)

`.env`ファイルを編集して以下の値を設定できます:

```env
# PostgreSQL パスワード (本番環境では強力なパスワードを使用)
POSTGRES_PASSWORD=your-super-secret-and-long-postgres-password

# JWT Secret (最低32文字)
JWT_SECRET=your-super-secret-jwt-token-with-at-least-32-characters-long

# Supabase Anon Key
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**注意**: デフォルトの開発用キーがサンプルとして含まれています。本番環境では必ず独自のキーを生成してください。

### 3. Docker Composeの起動

```bash
# コンテナをビルド・起動
docker-compose up -d

# ログを確認
docker-compose logs -f
```

### 4. アプリケーションにアクセス

- **アプリケーション**: http://localhost:3000
- **Supabase Database**: localhost:54322 (PostgreSQL)
- **Supabase REST API**: http://localhost:54323
- **Supabase Auth**: http://localhost:54324
- **Supabase Studio**: http://localhost:54323 (データベース管理UI)

### 5. データベーススキーマの初期化

初回起動時、データベーススキーマは自動的に`docs/deployment/production_database_schema.sql`から読み込まれます。

手動で再実行する場合:

```bash
docker-compose exec supabase-db psql -U postgres -d postgres -f /docker-entrypoint-initdb.d/init.sql
```

## 開発コマンド

### コンテナ管理

```bash
# 起動
docker-compose up -d

# 停止
docker-compose down

# 再起動
docker-compose restart

# 完全削除 (ボリュームも含む)
docker-compose down -v

# ビルドし直して起動
docker-compose up --build -d
```

### ログ確認

```bash
# 全サービスのログ
docker-compose logs -f

# 特定サービスのログ
docker-compose logs -f app
docker-compose logs -f supabase-db
```

### データベース接続

```bash
# PostgreSQLシェルに接続
docker-compose exec supabase-db psql -U postgres -d postgres

# SQL実行例
docker-compose exec supabase-db psql -U postgres -d postgres -c "SELECT * FROM players;"
```

### アプリケーションのシェルアクセス

```bash
# アプリケーションコンテナにアクセス
docker-compose exec app sh

# pnpmコマンド実行例
docker-compose exec app pnpm test
docker-compose exec app pnpm lint
```

## トラブルシューティング

### ポート競合エラー

別のアプリケーションが同じポートを使用している場合:

```bash
# ポート使用状況確認 (Mac/Linux)
lsof -i :3000
lsof -i :54322

# ポート使用状況確認 (Windows)
netstat -ano | findstr :3000
```

`docker-compose.yml`のポート設定を変更:

```yaml
services:
  app:
    ports:
      - '3001:3000' # ホスト側のポートを変更
```

### データベース接続エラー

```bash
# データベースの状態確認
docker-compose ps supabase-db

# データベースログ確認
docker-compose logs supabase-db

# データベース再起動
docker-compose restart supabase-db
```

### ホットリロードが動作しない

```bash
# アプリケーションコンテナを再起動
docker-compose restart app

# ビルドキャッシュをクリアして再起動
docker-compose up --build app
```

### データベーススキーマがロードされない

```bash
# 手動でスキーマを実行
docker-compose exec supabase-db psql -U postgres -d postgres < docs/deployment/production_database_schema.sql

# または
cat docs/deployment/production_database_schema.sql | docker-compose exec -T supabase-db psql -U postgres -d postgres
```

### コンテナのクリーンアップ

```bash
# 全コンテナとボリュームを削除して再起動
docker-compose down -v
docker-compose up -d --build
```

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Network                        │
│                     (napoleon-network)                       │
│                                                              │
│  ┌────────────────┐                                         │
│  │   Next.js App  │                                         │
│  │  (Port: 3000)  │                                         │
│  └────────┬───────┘                                         │
│           │                                                  │
│           ├──────────────┬──────────────┬──────────────┐   │
│           │              │              │              │   │
│  ┌────────▼─────┐  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─┐  │
│  │ PostgreSQL   │  │  Auth    │  │   REST   │  │Studio│  │
│  │ (Port: 54322)│  │(Port:    │  │ (Port:   │  │(Port:│  │
│  │              │  │ 54324)   │  │  54323)  │  │54323)│  │
│  └──────────────┘  └──────────┘  └──────────┘  └──────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 本番環境との違い

| 項目             | Docker Compose (ローカル)  | 本番環境 (Vercel + Supabase)    |
| ---------------- | -------------------------- | ------------------------------- |
| データベース     | ローカルPostgreSQL         | Supabase Cloudホスト            |
| 認証             | ローカルGoTrue             | Supabase Auth                   |
| API              | ローカルPostgREST          | Supabase REST API               |
| アプリケーション | ホットリロード開発サーバー | Next.jsビルド + Edge Runtime    |
| 環境変数         | `.env`                     | Vercel環境変数 + GitHub Secrets |

## 次のステップ

1. **開発開始**: http://localhost:3000 でアプリケーションにアクセス
2. **データベース管理**: Supabase Studioでテーブルを確認
3. **コード変更**: `src/`以下のファイルを編集するとホットリロードされます
4. **テスト実行**: `docker-compose exec app pnpm test`

## 関連ドキュメント

- [プロジェクトセットアップ](./PROJECT_SETUP.md)
- [開発コマンド一覧](../development/COMMANDS.md)
- [データベーススキーマ](../deployment/production_database_schema.sql)
- [Supabase RLSセットアップ](../security/RLS_SETUP.md)
