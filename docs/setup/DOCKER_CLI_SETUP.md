# Docker CLIセットアップガイド (GUIなし)

## 概要

Docker DesktopのGUIアプリを使わず、コマンドラインだけでDockerを使用する方法を説明します。
**Colima**を使用して、軽量なコンテナランタイム環境を構築します。

## Colimaとは？

- Docker Desktopの軽量な代替
- Lima (Linux Virtual Machine) ベース
- コマンドラインのみで動作
- 無料・オープンソース
- macOS, Linux対応

## インストール手順

### 1. Docker CLIとColimaをインストール

```bash
# Docker CLIをインストール
brew install docker

# Docker Composeをインストール
brew install docker-compose

# Colimaをインストール
brew install colima
```

### 2. Colimaを起動

```bash
# デフォルト設定で起動
colima start

# またはカスタム設定で起動（推奨）
colima start \
  --cpu 4 \
  --memory 8 \
  --disk 60 \
  --arch aarch64  # Apple Silicon (M1/M2/M3)の場合
  # --arch x86_64 # Intelの場合
```

### 3. インストール確認

```bash
# Dockerバージョン確認
docker --version

# Docker Composeバージョン確認
docker-compose --version

# Colima状態確認
colima status

# Dockerが動作するか確認
docker run hello-world
```

成功すると以下のようなメッセージが表示されます:

```
Hello from Docker!
This message shows that your installation appears to be working correctly.
```

## Colimaの基本コマンド

```bash
# 起動
colima start

# 停止
colima stop

# 再起動
colima restart

# 状態確認
colima status

# 削除（完全に削除してやり直す場合）
colima delete

# ログ確認
colima logs

# SSHでVMに入る
colima ssh
```

## Napoleon GameでDockerを使う

### 方法1: シンプルなDocker起動

```bash
# イメージをビルド
./docker-dev.sh build

# コンテナを起動してpnpm dev実行
./docker-dev.sh run

# bashシェルに入る
./docker-dev.sh shell
```

### 方法2: Docker Compose

```bash
# 環境変数ファイル作成
cp .env.docker.example .env

# サービス起動
docker-compose up -d

# ログ確認
docker-compose logs -f

# 停止
docker-compose down
```

## パフォーマンス設定

### CPUとメモリの調整

```bash
# 現在の設定を確認
colima status

# より多くのリソースを割り当てて再起動
colima stop
colima start --cpu 6 --memory 12 --disk 80
```

### ボリュームマウントの最適化

Colimaはデフォルトで以下のディレクトリをマウントします:

- `$HOME` (ホームディレクトリ全体)
- `/tmp`

プロジェクトがホームディレクトリ内にある場合は追加設定不要です。

## トラブルシューティング

### 起動エラー: "colima is already running"

```bash
# 停止してから再起動
colima stop
colima start
```

### Dockerコマンドが動作しない

```bash
# Colimaが起動しているか確認
colima status

# 起動していない場合
colima start

# Docker contextを確認
docker context ls

# colimaコンテキストを使用
docker context use colima
```

### ポート衝突エラー

```bash
# 使用中のポートを確認
lsof -i :3000

# 別のポートを使用
docker run -p 3001:3000 ...
```

### ボリュームマウントが動作しない

```bash
# プロジェクトがホームディレクトリ内にあるか確認
pwd
# /Users/username/... であればOK

# Colimaを再起動
colima restart
```

### メモリ不足エラー

```bash
# より多くのメモリを割り当て
colima stop
colima start --memory 16
```

## Docker Desktopとの比較

| 項目           | Colima      | Docker Desktop |
| -------------- | ----------- | -------------- |
| GUI            | ❌ なし     | ✅ あり        |
| リソース使用   | 軽量        | 重い           |
| コマンドライン | ✅ 完全対応 | ✅ 完全対応    |
| 起動速度       | 速い        | 遅い           |
| ライセンス     | 無料 (OSS)  | 個人利用無料   |
| Kubernetes     | 対応        | 対応           |
| 推奨環境       | CLI好き     | GUI好き        |

## アンインストール

Colimaを削除する場合:

```bash
# Colimaを停止・削除
colima stop
colima delete

# Homebrewでアンインストール
brew uninstall colima
brew uninstall docker
brew uninstall docker-compose
```

## 自動起動設定 (オプション)

macOS起動時にColimaを自動起動したい場合:

```bash
# LaunchAgentを作成
mkdir -p ~/Library/LaunchAgents

cat > ~/Library/LaunchAgents/com.colima.start.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.colima.start</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/colima</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
</dict>
</plist>
EOF

# 有効化
launchctl load ~/Library/LaunchAgents/com.colima.start.plist
```

無効化する場合:

```bash
launchctl unload ~/Library/LaunchAgents/com.colima.start.plist
rm ~/Library/LaunchAgents/com.colima.start.plist
```

## 次のステップ

1. **Colimaをインストール**: `brew install colima docker docker-compose`
2. **起動**: `colima start`
3. **確認**: `docker run hello-world`
4. **開発開始**: `./docker-dev.sh build && ./docker-dev.sh run`

## 関連ドキュメント

- [Dockerシンプルセットアップ](./DOCKER_SIMPLE_SETUP.md)
- [Docker Composeセットアップ](./DOCKER_SETUP.md)
- [Colima公式ドキュメント](https://github.com/abiosoft/colima)
