# マルチプレイヤールーム データベースセットアップ

## 概要

このドキュメントでは、マルチプレイヤールーム機能に必要なPostgreSQL関数のセットアップ手順を説明します。

## 必要なデータベース関数

マルチプレイヤールームでは、プレイヤー数を安全に管理するために以下のPostgreSQL関数が必要です:

- `increment_player_count(TEXT)` - ルームのプレイヤー数を1増やす
- `decrement_player_count(TEXT)` - ルームのプレイヤー数を1減らす（0未満にならない）

## セットアップ手順

### 1. Supabase Dashboardにアクセス

1. [Supabase Dashboard](https://app.supabase.com) にログイン
2. プロジェクトを選択
3. 左サイドバーから **SQL Editor** を開く

### 2. SQL関数を実行

以下のSQLスクリプトを実行します（`docs/database/room_player_count_functions.sql` の内容）:

```sql
-- ============================================
-- Room Player Count Management Functions
-- ============================================
-- 目的: ゲームルームのプレイヤー数を安全に増減する
-- 実行場所: Supabase Dashboard > SQL Editor
-- 対象環境: 開発環境・本番環境の両方で実行
-- ============================================

-- プレイヤー数を増やす関数
CREATE OR REPLACE FUNCTION increment_player_count(room_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = player_count + 1
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- プレイヤー数を減らす関数
CREATE OR REPLACE FUNCTION decrement_player_count(room_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = GREATEST(player_count - 1, 0)
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 関数にアクセス権限を付与
GRANT EXECUTE ON FUNCTION increment_player_count(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_player_count(TEXT) TO service_role;
```

### 3. 動作確認

以下のSQLクエリで関数が正しく作成されたか確認します:

```sql
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('increment_player_count', 'decrement_player_count');
```

**期待される結果:**

```
routine_name            | routine_type | security_type
------------------------+--------------+--------------
increment_player_count  | FUNCTION     | DEFINER
decrement_player_count  | FUNCTION     | DEFINER
```

### 4. テスト実行（オプション）

関数が正しく動作するかテストします:

```sql
-- テスト用ルーム作成（既存のルームIDを使用してもOK）
INSERT INTO game_rooms (id, name, player_count, max_players, status, host_player_id)
VALUES ('test_room_123', 'Test Room', 0, 4, 'waiting', 'test_player_456')
ON CONFLICT (id) DO NOTHING;

-- プレイヤー数を増やす
SELECT increment_player_count('test_room_123');

-- 確認（player_count が 1 になっているはず）
SELECT id, name, player_count FROM game_rooms WHERE id = 'test_room_123';

-- プレイヤー数を減らす
SELECT decrement_player_count('test_room_123');

-- 確認（player_count が 0 に戻っているはず）
SELECT id, name, player_count FROM game_rooms WHERE id = 'test_room_123';

-- テストデータ削除
DELETE FROM game_rooms WHERE id = 'test_room_123';
```

## 関数の詳細

### `increment_player_count(room_id TEXT)`

**目的:** ルームのプレイヤー数を安全に1増やす

**パラメータ:**

- `room_id` (TEXT) - ゲームルームID

**動作:**

- `game_rooms` テーブルの `player_count` カラムを +1 する
- `SECURITY DEFINER` により、RLS制約を回避して実行
- `search_path` 設定によりセキュリティ脆弱性を防止

**使用箇所:**

- `src/app/actions/gameActions.ts` の `joinGameRoomAction()`

### `decrement_player_count(room_id TEXT)`

**目的:** ルームのプレイヤー数を安全に1減らす（0未満にならない）

**パラメータ:**

- `room_id` (TEXT) - ゲームルームID

**動作:**

- `game_rooms` テーブルの `player_count` カラムを -1 する
- `GREATEST(player_count - 1, 0)` により、0未満にならないことを保証
- `SECURITY DEFINER` により、RLS制約を回避して実行
- `search_path` 設定によりセキュリティ脆弱性を防止

**使用箇所:**

- `src/app/actions/gameActions.ts` の `leaveGameRoomAction()`

## セキュリティ考慮事項

### `SECURITY DEFINER` について

- **目的:** RLS（Row Level Security）ポリシーを回避して、プレイヤー数更新を確実に実行
- **リスク:** 関数が全てのプレイヤーに対して実行可能
- **対策:**
  - Server Actionsでのみ呼び出し（クライアント直接呼び出し不可）
  - 入力検証・レート制限を Server Actions で実施

### `search_path` 設定について

- **目的:** SQLインジェクション攻撃を防ぐ
- **設定値:** `public, pg_temp`
- **効果:**
  - 関数内で参照されるオブジェクトは `public` スキーマに限定
  - 悪意あるスキーマ・テーブル参照を防止

### 権限設定

```sql
GRANT EXECUTE ON FUNCTION increment_player_count(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_player_count(TEXT) TO service_role;
```

- **対象:** `service_role` のみ実行可能
- **理由:** Server Actions（サーバーサイド）からのみ呼び出されるべき
- **結果:** クライアントサイドから直接呼び出せない

## トラブルシューティング

### エラー: "function increment_player_count(uuid) does not exist"

**原因:**

- 古いバージョンのUUID型関数が残っている
- TEXT型とUUID型で関数が重複している

**解決策:**

```sql
-- UUID版の関数を削除
DROP FUNCTION IF EXISTS increment_player_count(uuid);
DROP FUNCTION IF EXISTS decrement_player_count(uuid);

-- TEXT版の関数のみ残す（上記のセットアップ手順を再実行）
```

### エラー: "Could not choose the best candidate function"

**原因:** 同じ関数名で異なるパラメータ型の関数が複数存在

**解決策:**

```sql
-- 既存の関数を全て削除
DROP FUNCTION IF EXISTS increment_player_count(TEXT);
DROP FUNCTION IF EXISTS increment_player_count(uuid);
DROP FUNCTION IF EXISTS decrement_player_count(TEXT);
DROP FUNCTION IF EXISTS decrement_player_count(uuid);

-- TEXT版のみ再作成（上記のセットアップ手順を実行）
```

### プレイヤー数が更新されない

**確認項目:**

1. 関数が正しく作成されているか確認（上記「動作確認」参照）
2. Server Actionsでエラーが発生していないか確認（ブラウザコンソール）
3. Supabaseのログを確認（Dashboard > Logs）

**デバッグ方法:**

```sql
-- 直接関数を実行してテスト
SELECT increment_player_count('実際のroom_id');

-- ルームの状態を確認
SELECT * FROM game_rooms WHERE id = '実際のroom_id';
```

## 関連ドキュメント

- [実装状況](../game-logic/IMPLEMENTATION_STATUS.md) - マルチプレイヤールーム機能の全体像
- [データベースパフォーマンス設定](./DATABASE_PERFORMANCE_SETUP.md) - 全体的なDB最適化
- [RLSセットアップ](../security/RLS_SETUP.md) - Row Level Securityの設定

## 参考

- [Supabase Functions Documentation](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [PostgreSQL search_path](https://www.postgresql.org/docs/current/runtime-config-client.html#GUC-SEARCH-PATH)
