# データベースパフォーマンス設定手順

このドキュメントでは、Napoleon Gameの50-120ms性能向上を実現するためのSupabaseデータベース設定手順を説明します。

## 📋 概要

最適化により期待される効果:

- **Connection Time**: 161.3ms → **50-80ms** (-70% improvement)
- **Simple Query**: 178.8ms → **80-120ms** (-50% improvement)
- **Complex Query**: 200ms+ → **100-150ms** (-40% improvement)

## 🚀 必須：SQLファイルの実行

### STEP 1: パフォーマンス関数のインストール

1. Supabaseダッシュボードにログイン
2. **SQL Editor**に移動
3. `docs/database/performance_functions.sql`の内容をコピー&ペースト
4. **RUN**ボタンをクリックして実行

実行する関数:

```sql
-- 1. 利用可能ルーム検索（高頻度）
CREATE OR REPLACE FUNCTION get_available_rooms(room_limit INT DEFAULT 10)

-- 2. 接続プレイヤー検索（高頻度）
CREATE OR REPLACE FUNCTION get_connected_players(search_term TEXT DEFAULT '', player_limit INT DEFAULT 20)

-- 3. プレイヤー統計計算（軽量版）
CREATE OR REPLACE FUNCTION get_player_stats_simple(player_uuid TEXT)

-- 4. 最近のゲーム結果（軽量版）
CREATE OR REPLACE FUNCTION get_recent_results(player_uuid TEXT, result_limit INT DEFAULT 10)

-- 5. パフォーマンス監視用ビュー
CREATE OR REPLACE VIEW perf_stats AS ...
```

### STEP 2: パフォーマンスインデックスの作成

⚠️ **重要**: 各インデックスを**個別に実行**してください（一括実行不可）

1. Supabaseダッシュボードの**SQL Editor**で以下を1つずつ実行:

```sql
-- インデックス1: ゲームルーム検索用
CREATE INDEX IF NOT EXISTS idx_game_rooms_waiting_fast
ON game_rooms (status, created_at DESC)
WHERE status = 'waiting' AND player_count < max_players;
```

```sql
-- インデックス2: プレイヤー検索用
CREATE INDEX IF NOT EXISTS idx_players_connected_search
ON players (connected, name)
WHERE connected = true;
```

```sql
-- インデックス3: ナポレオンゲーム結果用
CREATE INDEX IF NOT EXISTS idx_game_results_napoleon_fast
ON game_results (napoleon_player_id, created_at DESC);
```

```sql
-- インデックス4: アジュタントゲーム結果用
CREATE INDEX IF NOT EXISTS idx_game_results_adjutant_fast
ON game_results (adjutant_player_id, created_at DESC)
WHERE adjutant_player_id IS NOT NULL;
```

### STEP 3: インストール確認

以下のクエリで正常にインストールされたことを確認:

```sql
-- 関数の確認
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_name LIKE 'get_%';

-- インデックスの確認
SELECT indexname, tablename
FROM pg_indexes
WHERE indexname LIKE '%_fast';

-- ビューの確認
SELECT * FROM perf_stats;
```

## 📊 パフォーマンス測定

### 関数のテスト実行

```sql
-- 利用可能ルーム検索（期待時間: 20-40ms）
SELECT * FROM get_available_rooms(10);

-- 接続プレイヤー検索（期待時間: 15-30ms）
SELECT * FROM get_connected_players('', 20);

-- プレイヤー統計（期待時間: 25-50ms）
SELECT * FROM get_player_stats_simple('your-player-id');

-- 最近の結果（期待時間: 20-40ms）
SELECT * FROM get_recent_results('your-player-id', 5);
```

### アプリケーション側での確認

アプリケーションを起動して開発者コンソールで以下を確認:

```
⚡ Using optimized DB function - 50-80ms faster!
⚡ Using optimized DB function for players - 50-80ms faster!
```

これらのメッセージが表示されれば最適化が有効になっています。

## 🔧 設定の最適化

### Supabase設定推奨値

**Connection Pooling** (Database Settings):

```
Pool Mode: Transaction
Pool Size: 15-25 (high traffic)
Max Client Conn: 200
```

**Performance Settings**:

```sql
-- 統計更新の最適化
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_cache_size = '4GB';
SELECT pg_reload_conf();
```

## 🚨 トラブルシューティング

### よくある問題

1. **関数が見つからない**

   ```
   Error: function get_available_rooms does not exist
   ```

   → performance_functions.sqlを再実行

2. **インデックス作成エラー**

   ```
   Error: relation "idx_xxx" already exists
   ```

   → 正常です。IF NOT EXISTSが動作中

3. **権限エラー**
   ```
   Error: permission denied for relation
   ```
   → Supabaseの管理者権限でSQL Editorを使用

### パフォーマンスが向上しない場合

1. **関数の使用確認**:

   ```javascript
   // 開発者コンソールで確認
   console.log('Function usage logs should appear here');
   ```

2. **フォールバック動作確認**:

   ```sql
   -- 手動でRPC関数をテスト
   SELECT * FROM get_available_rooms(5);
   ```

3. **インデックス使用確認**:
   ```sql
   EXPLAIN (ANALYZE, BUFFERS)
   SELECT * FROM game_rooms
   WHERE status = 'waiting' AND player_count < max_players;
   ```

## 📈 期待される改善

| 機能               | 改善前    | 改善後    | 削減率 |
| ------------------ | --------- | --------- | ------ |
| ルーム検索         | 150-200ms | 50-80ms   | 60-70% |
| プレイヤー検索     | 100-150ms | 30-60ms   | 50-70% |
| 統計取得           | 200-300ms | 80-120ms  | 60-70% |
| 初期データ読み込み | 500ms+    | 200-300ms | 40-60% |

## ✅ チェックリスト

- [ ] performance_functions.sql を実行
- [ ] 4つのインデックスを個別に作成
- [ ] 関数・インデックス・ビューの存在確認
- [ ] アプリケーションでの最適化ログ確認
- [ ] パフォーマンス測定の実行
- [ ] 本番環境での動作確認

---

💡 **ヒント**: 設定完了後、アプリケーションを再起動してキャッシュをクリアすることを推奨します。

🔗 **関連ファイル**:

- `docs/database/performance_functions.sql` - 実行する関数定義
- `docs/database/performance_indexes.sql` - 実行するインデックス定義
- `src/lib/supabase/performanceClient.ts` - 最適化されたクライアント実装
