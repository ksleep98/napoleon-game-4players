# Diagrams - Napoleon Game

このディレクトリには、Napoleon Gameプロジェクトのシステム構成図とゲームフロー図が含まれています。

## 📁 ファイル一覧

### 1. システム構成図 (System Architecture)

- **ファイル**: `system-architecture.drawio`
- **内容**:
  - Frontend (Next.js + Vercel)
  - Backend (Supabase PostgreSQL)
  - CI/CD (GitHub Actions)
  - Infrastructure (Terraform + Terraform Cloud)
  - データフローと認証フロー

### 2. ゲームフロー図 (Game Flow)

- **ファイル**: `game-flow.drawio`
- **内容**:
  - **マルチプレイヤーモード**:
    - ルーム作成・参加フロー
    - ウェイティングルーム（4人待機）
    - ゲーム開始
  - **シングルプレイヤーモード (AI対戦)**:
    - Quick Start
    - AI プレイヤー自動生成
  - **共通ゲームフロー**（6つのフェーズ）:
    - INITIALIZATION
    - NAPOLEON DECLARATION
    - ADJUTANT SELECTION
    - CARD EXCHANGE
    - PLAYING (Tricks)
    - FINISHED
  - 各フェーズで使用されるファイルと関数
  - コンポーネントの関連性
  - AI処理フロー（シングルプレイヤーのみ）
  - データレイヤー（Supabase）との接続

## 🎨 PNG形式にエクスポートする方法

draw.io形式のファイルをPNG画像としてエクスポートするには、以下の手順に従ってください：

### オンライン版 (推奨)

1. **draw.ioを開く**
   - ブラウザで https://app.diagrams.net/ にアクセス

2. **ファイルを開く**
   - `File` > `Open from` > `Device`
   - `system-architecture.drawio` または `game-flow.drawio` を選択

3. **PNGとしてエクスポート**
   - `File` > `Export as` > `PNG...`
   - **重要**: `Include a copy of my diagram` にチェックを入れる
     - これにより、編集可能なdraw.io.png形式で保存されます
   - `Zoom` は 100% または 150% を推奨
   - `Border Width` は 10-20px を推奨
   - `Export` をクリック

4. **ファイル名を変更**
   - エクスポートしたファイルを以下の名前で保存：
     - `system-architecture.drawio.png`
     - `game-flow.drawio.png`

### デスクトップ版

draw.io Desktopがインストールされている場合：

1. **アプリケーションで開く**

   ```bash
   open -a draw.io system-architecture.drawio
   ```

2. **同じエクスポート手順を実行**
   - `File` > `Export as` > `PNG...`
   - `Include a copy of my diagram` をチェック

### コマンドライン (上級者向け)

draw.io Desktop CLIがインストールされている場合：

```bash
# Homebrewでインストール（macOS）
brew install --cask drawio

# PNG形式でエクスポート
drawio -x -f png -o system-architecture.drawio.png system-architecture.drawio
drawio -x -f png -o game-flow.drawio.png game-flow.drawio
```

## 📊 図の内容詳細

### システム構成図の主要コンポーネント

- **User Layer**: ブラウザからのアクセス
- **Frontend Layer** (Vercel):
  - Next.js 15.4 (App Router)
  - React 19.x + TypeScript
  - Game Components
  - Game Logic
- **Backend Layer** (Supabase):
  - Supabase Auth (Anonymous Session)
  - PostgreSQL (Game State DB)
  - Row Level Security (RLS Policies)
  - Realtime (WebSocket Sync)
- **CI/CD Layer** (GitHub Actions):
  - CI Pipeline (Lint, Type Check, Test)
  - E2E Tests (Playwright)
  - Auto Deploy
- **Infrastructure Layer** (Terraform):
  - Terraform Cloud (VCS-driven)
  - GitHub Management
  - Branch Protection

### ゲームフロー図の主要ステージ

#### マルチプレイヤーモード（緑色のセクション）

1. **Rooms Page**: ゲームルーム一覧、作成・参加
   - ファイル: `rooms/page.tsx`
   - 関数: `createGameRoom()`, `joinGameRoom()`

2. **Waiting Room**: 参加者待機（4人まで）
   - ファイル: `rooms/[roomId]/waiting/page.tsx`
   - ポーリングでリアルタイム更新

3. **Game Start**: ホストがゲーム開始ボタンを押す
   - ファイル: `gameInitActions.ts: initializeGameFromRoom()`

#### シングルプレイヤーモード（オレンジ色のセクション）

1. **Quick Start**: ホームページから即座にゲーム開始
   - 3人のAIプレイヤー自動生成
   - ファイル: `gameInitActions.ts: initializeAIGame()`

#### 共通ゲームフロー（青色のセクション）

1. **INITIALIZATION**: ゲーム開始、カード配布（各プレイヤー13枚）
2. **NAPOLEON DECLARATION**: ナポレオン宣言フェーズ
   - 全員パス → カード再配布
3. **ADJUTANT SELECTION**: 副官選択フェーズ
4. **CARD EXCHANGE**: カード交換フェーズ（ナポレオンと副官）
5. **PLAYING**: トリックプレイフェーズ（13回繰り返し）
6. **FINISHED**: ゲーム終了、スコア計算

各フェーズには、使用される主要ファイル・関数・コンポーネントが記載されています。

#### AI処理（黄色のセクション）

シングルプレイヤーモードのみ有効:

- AI戦略選択（MCTS、ハイブリッド）
- AIナポレオン宣言
- AIカード選択
- AI遅延制御（リアルな遅延シミュレーション）

#### データレイヤー（赤色のセクション）

Supabaseデータベース:

- **マルチプレイヤー用テーブル**: `game_rooms`, `players`, `room_players`
- **ゲーム用テーブル**: `game_sessions`, `game_players`, `game_tricks`
- **RLS Policies**: プレイヤーは自分の手札のみ閲覧可能
- **Realtime Subscriptions**: WebSocket同期、ポーリング

## 🔄 図の更新方法

1. draw.ioで `.drawio` ファイルを開く
2. 必要な変更を加える
3. 保存する
4. 上記の手順でPNG形式に再エクスポート

## 📝 備考

- draw.io.png形式は、PNG画像としても表示でき、draw.ioで開けば編集もできる便利な形式です
- 図を更新した際は、必ずPNG版も再エクスポートしてください
- 大きな変更を加えた場合は、このREADMEも更新してください
