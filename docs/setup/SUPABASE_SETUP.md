# Supabase Setup Guide

Napoleon Game用のSupabaseセットアップガイドです。

## 🚀 セットアップ手順

### 1. Supabaseプロジェクト作成

1. [Supabase](https://supabase.com)にアクセス
2. GitHubアカウントでサインイン
3. "New Project"をクリック
4. プロジェクト情報を入力:
   - **Name**: `napoleon-game-4players`
   - **Database Password**: 強力なパスワードを設定
   - **Region**: `Northeast Asia (Tokyo)` を選択（低レイテンシのため）

### 2. 環境変数設定

プロジェクト作成後、以下の環境変数を取得:

```bash
# Settings > API から取得
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxxxx.xxxxxx.xxxxxx
SUPABASE_SERVICE_ROLE_KEY=xxxxxx.xxxxxx.xxxxxx  # 管理用（秘匿情報）
```

#### ローカル開発用設定

```bash
# .env.local ファイルを作成
cp .env.local.example .env.local

# 取得した値を.env.localに設定
NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_actual_service_role_key
```

#### 本番環境用設定

```bash
# Vercel/Netlify等のデプロイサービスで設定
NEXT_PUBLIC_SUPABASE_URL=production_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=production_anon_key
SUPABASE_SERVICE_ROLE_KEY=production_service_role_key
```

### 3. データベーススキーマの実行

1. Supabase Dashboard > SQL Editor に移動
2. `src/lib/supabase/schema.sql` の内容をコピー&ペースト
3. "Run" ボタンでSQL実行

#### 実行されるテーブル:

- `game_rooms` - ゲームルーム管理
- `players` - プレイヤー情報
- `games` - ゲーム状態保存
- `game_results` - ゲーム結果履歴

#### 自動で作成される機能:

- **Row Level Security (RLS)** - セキュアなデータアクセス
- **リアルタイム購読** - ライブ更新機能
- **インデックス** - 高速クエリ
- **トリガー・関数** - 自動データ更新

### 4. リアルタイム機能の有効化

1. Dashboard > Settings > API に移動
2. "Realtime" セクションで以下のテーブルを有効化:
   - ✅ `game_rooms`
   - ✅ `players`
   - ✅ `games`
   - ✅ `game_results`

### 5. セキュリティ設定

#### RLS (Row Level Security) ポリシー

スキーマ実行により、以下のセキュリティポリシーが自動適用:

```sql
-- ゲーム参加者のみがゲーム情報にアクセス可能
CREATE POLICY "Game participants can view games" ON games
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM players p
      WHERE p.game_id = games.id
      AND p.id = current_setting('app.player_id', true)
    )
  );
```

#### CORS設定

本番デプロイ時はCORS設定が必要:

1. Dashboard > Settings > API
2. CORS origins に本番URLを追加

### 6. テスト・検証

#### 接続テスト

```bash
pnpm dev
# ブラウザで http://localhost:3000 にアクセス
# デベロッパーツールでSupabase接続エラーがないか確認
```

#### データベーステスト

```sql
-- SQL Editorで実行
SELECT * FROM game_rooms LIMIT 5;
SELECT * FROM players LIMIT 5;
```

## 🔧 開発時の使用方法

### React Hooks使用例

```typescript
import {
  useConnectionState,
  usePlayerSession,
  useGameRoom,
} from '@/hooks/useSupabase';

function GameComponent() {
  const { isConnected } = useConnectionState();
  const { playerId, initializePlayer } = usePlayerSession();
  const { room, players } = useGameRoom('room_123');

  // リアルタイム状態が自動で同期される
}
```

### 直接サービス使用例

```typescript
import {
  createGameRoom,
  joinGameRoom,
  saveGameState,
} from '@/lib/supabase/gameService';

// ゲームルーム作成
const room = await createGameRoom({
  id: 'room_123',
  name: 'My Game Room',
  playerCount: 0,
  maxPlayers: 4,
  status: 'waiting',
  hostPlayerId: 'player_123',
});

// ゲーム状態保存
await saveGameState(gameState);
```

## 📊 監視・デバッグ

### ログ確認

```bash
# Supabase Dashboard > Logs
# - API logs
# - Realtime logs
# - Database logs
```

### パフォーマンス監視

```bash
# Dashboard > Reports
# - API usage
# - Database performance
# - Realtime connections
```

## ✅ 最新の修正・改善事項 (2024/08/25)

### セッション管理の最適化

**問題**: `set_config`関数の404/PGRST202エラー

- 開発環境でRLS無効化時にSupabaseのRPC関数呼び出しエラー
- Quick Start使用時のコンソールエラー

**解決策**: 開発環境向けセッション管理の簡素化

```typescript
// 修正後: src/lib/supabase/client.ts
export const setPlayerSession = async (playerId: string) => {
  // ローカルストレージに保存
  if (typeof window !== 'undefined') {
    localStorage.setItem('napoleon_player_id', playerId);
  }

  // 開発環境ではRLSが無効化されているため、RPC呼び出しをスキップ
  // 本番環境でRLS有効化時は、コメントアウトされたコードを有効にする
};
```

### Quick Start機能の実装

**追加機能**:

- 即座にゲーム開始できる機能
- 4人プレイヤーの自動設定
- エラーのないシームレスな体験

**実装場所**:

- `src/hooks/useGameState.ts`: 初期化処理の最適化
- `src/app/game/[gameId]/page.tsx`: URLパラメータ処理

### テストカバレッジの拡張

**追加されたテスト**: 41個の新しいテスト（合計75個）

- `tests/lib/supabase/client.test.ts`: 基本セッション管理
- `tests/lib/supabase/client-functions.test.ts`: 実関数テスト
- `tests/lib/supabase/session-management.test.ts`: RLS修正確認
- `tests/lib/supabase/environment.test.ts`: 環境設定テスト

**カバー範囲**:

- セッション管理（保存・取得・SSR対応）
- エラーハンドリング
- パフォーマンステスト
- 型安全性確認

## 🚨 トラブルシューティング

### よくある問題

#### 1. 接続エラー

```
Error: Failed to connect to Supabase
```

**解決策**:

- 環境変数の設定確認
- ネットワーク接続確認
- Supabaseプロジェクトの状態確認

#### 2. RLS エラー (解決済み)

```
Error: new row violates row-level security policy for table 'games'
```

**修正内容**:

- 開発環境でのRLS一時無効化: `ALTER TABLE games DISABLE ROW LEVEL SECURITY`
- セッション管理のローカルストレージベース化
- Quick Start機能での安全な初期化

#### 3. セッション設定エラー (解決済み)

```
GET .../rpc/set_config:1 404 (Not Acceptable)
PGRST202: Could not find function public.set_config
```

**修正内容**:

- 開発環境でのRPC呼び出し削除
- `setPlayerSession`関数の簡素化
- テスト環境での警告表示のみ（機能には影響なし）

#### 4. リアルタイム未動作

```
Realtime subscription not working
```

**解決策**:

- テーブルのRealtime有効化確認
- 接続状態確認
- ブラウザのWebSocket対応確認

### デバッグ情報取得

```typescript
// 接続状態確認
console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
console.log('Connection state:', supabase.realtime.isConnected());

// プレイヤーセッション確認
import { getPlayerSession } from '@/lib/supabase/client';
console.log('Current player:', getPlayerSession());
```

## 📈 パフォーマンス最適化

### インデックス追加

```sql
-- 頻繁にクエリされるカラムにインデックス追加
CREATE INDEX idx_games_updated_at ON games(updated_at);
CREATE INDEX idx_players_connected ON players(connected);
```

### 接続プール設定

```typescript
// 大量アクセス時の設定調整
export const supabase = createClient(url, key, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});
```

---

このセットアップ完了後、Napoleon GameはSupabaseの堅牢なリアルタイムデータベースを活用して動作します。
