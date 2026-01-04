# Game Rooms Schema Update - game_id カラム追加

## 概要

マルチプレイヤールーム機能でゲーム開始時にルームとゲームを関連付けるため、`game_rooms`テーブルに`game_id`カラムを追加します。

## 必要な理由

ゲーム開始時に以下のエラーが発生：

```
Could not find the 'game_id' column of 'game_rooms' in the schema cache
```

これは`startGameFromRoomAction`がルームステータスを'playing'に更新する際、`game_id`カラムに値を設定しようとするためです。

## セットアップ手順

### 1. Supabase Dashboardにアクセス

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択
3. 左サイドバーから **SQL Editor** を開く

### 2. SQL実行

以下のSQLを実行（`docs/database/add_game_id_to_rooms.sql`の内容）：

```sql
-- game_id カラムを追加（NULL許可 - まだゲームが開始されていない場合）
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS game_id TEXT;

-- game_id にインデックスを作成（高速検索用）
CREATE INDEX IF NOT EXISTS idx_game_rooms_game_id
ON game_rooms(game_id);
```

### 3. 動作確認

以下のSQLクエリでカラムが正しく追加されたか確認：

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'game_rooms'
  AND column_name = 'game_id';
```

**期待される結果:**

```
column_name | data_type | is_nullable
------------+-----------+------------
game_id     | text      | YES
```

### 4. インデックス確認

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'game_rooms'
  AND indexname = 'idx_game_rooms_game_id';
```

**期待される結果:**

```
indexname               | indexdef
-----------------------+---------------------------------------
idx_game_rooms_game_id | CREATE INDEX idx_game_rooms_game_id...
```

## スキーマ詳細

### 更新後の game_rooms テーブル構造

| カラム名       | データ型  | NULL許可 | 説明                      |
| -------------- | --------- | -------- | ------------------------- |
| id             | text      | NO       | 主キー（ルームID）        |
| name           | text      | NO       | ルーム名                  |
| player_count   | integer   | NO       | 現在のプレイヤー数        |
| max_players    | integer   | NO       | 最大プレイヤー数（通常4） |
| status         | text      | NO       | waiting/playing/finished  |
| host_player_id | text      | NO       | ホストプレイヤーのID      |
| game_id        | text      | YES      | **NEW** 実行中のゲームID  |
| created_at     | timestamp | NO       | ルーム作成日時            |

### game_id の用途

- **waiting**: `game_id`はNULL（ゲーム未開始）
- **playing**: `game_id`にアクティブなゲームIDが設定される
- **finished**: `game_id`は最後に実行したゲームIDを保持

## コード変更

### TypeScript型定義更新

**src/types/game.ts:**

```typescript
export interface GameRoom {
  id: string;
  name: string;
  playerCount: number;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  createdAt: Date;
  hostPlayerId: string;
  gameId?: string; // NEW: ルームで実行中のゲームID
}
```

### Server Action更新

**src/app/actions/gameActions.ts:**

`getRoomDetailsAction`でgame_idを取得：

```typescript
const room: GameRoom = {
  id: data.id,
  name: data.name,
  playerCount: data.player_count,
  maxPlayers: data.max_players,
  status: data.status as 'waiting' | 'playing' | 'finished',
  hostPlayerId: data.host_player_id,
  createdAt: new Date(data.created_at),
  gameId: data.game_id || undefined, // NEW
};
```

`startGameFromRoomAction`でgame_idを設定：

```typescript
const { error: updateError } = await supabaseAdmin
  .from('game_rooms')
  .update({
    status: 'playing',
    game_id: gameId, // ゲームIDをルームに関連付け
  })
  .eq('id', roomId);
```

## トラブルシューティング

### エラー: "column game_id does not exist"

**原因:** SQLが実行されていない

**解決策:**

```sql
-- 手動でカラムを追加
ALTER TABLE game_rooms ADD COLUMN game_id TEXT;
```

### エラー: "relation game_rooms does not exist"

**原因:** `game_rooms`テーブル自体が存在しない

**解決策:**
マルチプレイヤールーム機能の初期セットアップを実行

- [MULTIPLAYER_ROOM_SETUP.md](./MULTIPLAYER_ROOM_SETUP.md) を参照

## 関連ドキュメント

- [マルチプレイヤールームセットアップ](./MULTIPLAYER_ROOM_SETUP.md) - ルーム機能の全体像
- [データベースパフォーマンス設定](./DATABASE_PERFORMANCE_SETUP.md) - 性能最適化
- [実装状況](../game-logic/IMPLEMENTATION_STATUS.md) - 機能実装の進捗

## 参考

- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/overview)
