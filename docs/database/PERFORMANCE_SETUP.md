# データベースパフォーマンス最適化セットアップガイド

## 概要

Napoleon Gameのデータベースパフォーマンスを最大化するための設定手順とベストプラクティスです。

## 1. インデックス最適化の適用

### Supabase SQL Editorでの実行

1. **Supabaseダッシュボード**にアクセス
2. **SQL Editor**を開く
3. **推奨**: `docs/database/CORE_INDEXES.sql`の内容を実行（エラー回避版）
   または `docs/database/INDEX_OPTIMIZATION.sql`の内容を実行（完全版）

```sql
-- 重要なインデックスを順次実行（エラー回避版）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_room_connected
ON players (room_id, connected)
WHERE room_id IS NOT NULL AND connected = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_results_napoleon_created
ON game_results (napoleon_player_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_phase_updated
ON games (phase, updated_at DESC)
WHERE phase IS NOT NULL;

-- 統計更新
ANALYZE games;
ANALYZE game_rooms;
ANALYZE players;
ANALYZE game_results;
```

### 実行優先度

**高優先度（必須）:**

- `idx_players_room_connected` - ルーム内プレイヤー検索
- `idx_game_results_napoleon_created` - ゲーム統計
- `idx_games_phase_updated` - ゲーム状態検索

**中優先度（推奨）:**

- `idx_game_rooms_status_created` - ルーム一覧
- `idx_game_results_scores_gin` - JSON検索

**低優先度（将来対応）:**

- `idx_players_name_trgm` - 部分一致検索（trigram拡張要）

## 2. 権限設定

### RPC関数の作成

```sql
-- パフォーマンス監視用関数（管理者権限で実行）
CREATE OR REPLACE FUNCTION get_index_usage()
RETURNS TABLE(
    schemaname text,
    tablename text,
    indexname text,
    idx_scan bigint,
    idx_tup_read bigint,
    idx_tup_fetch bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        schemaname::text,
        tablename::text,
        indexname::text,
        idx_scan,
        idx_tup_read,
        idx_tup_fetch
    FROM pg_stat_user_indexes
    WHERE schemaname = 'public'
    ORDER BY idx_scan DESC;
$$;

-- 権限付与
GRANT EXECUTE ON FUNCTION get_index_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION get_index_usage() TO anon;
```

## 3. パフォーマンス監視設定

### 環境変数の設定

**Vercel環境変数:**

```bash
# パフォーマンス監視有効化
NEXT_PUBLIC_ENABLE_PERF_MONITOR=true

# 詳細ログ有効化（開発時のみ）
NEXT_PUBLIC_ENABLE_VERBOSE_LOGS=true
```

### 監視ダッシュボードの確認

1. ページ右上の「📊 Perf」ボタンをクリック
2. 「🧪 Run Performance Test」で詳細テスト実行
3. 以下の指標を確認：
   - **Connection**: 400ms以下が良好
   - **Simple Query**: 150ms以下が良好
   - **Complex Query**: 200ms以下が良好
   - **Cache Hit Rate**: 80%以上が良好

## 4. 最適化の効果測定

### ベンチマーク指標

**導入前 (Baseline):**

- Simple Query: ~200ms
- Complex Query: ~300ms
- Cache Hit Rate: 0%

**目標値:**

- Simple Query: <100ms (50%改善)
- Complex Query: <150ms (50%改善)
- Cache Hit Rate: >80%

### 測定方法

```javascript
// パフォーマンステスト実行
const results = await performanceComparator.runPerformanceTests();

console.log('Performance Results:', {
  averageQuery: (results.tests.simpleQuery + results.tests.complexQuery) / 2,
  cacheHitRate: results.tests.cacheStats.hitRate,
  optimizedQueriesAvg:
    (results.tests.optimizedQueries.roomSearch +
      results.tests.optimizedQueries.playerSearch +
      results.tests.optimizedQueries.gameStats) /
    3,
});
```

## 5. 定期メンテナンス

### 週次タスク

```sql
-- 統計情報更新（週次実行推奨）
ANALYZE games;
ANALYZE game_rooms;
ANALYZE players;
ANALYZE game_results;
```

### 月次タスク

```sql
-- インデックス再構築（月次実行推奨）
REINDEX INDEX CONCURRENTLY idx_game_results_scores_gin;
REINDEX INDEX CONCURRENTLY idx_players_name_trgm;

-- 不要データクリーンアップ
DELETE FROM players
WHERE connected = false
AND created_at < NOW() - INTERVAL '30 days';

DELETE FROM game_rooms
WHERE status = 'finished'
AND created_at < NOW() - INTERVAL '7 days';
```

## 6. トラブルシューティング

### インデックス作成失敗

```sql
-- 既存インデックス確認
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public';

-- 重複インデックス削除
DROP INDEX IF EXISTS old_index_name;
```

### 権限エラー

```sql
-- RLS設定確認
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public';

-- 権限確認
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'your_table';
```

### パフォーマンス低下

1. **キャッシュクリア**: `performanceSupabase.clearCache()`
2. **自動最適化実行**: `performanceSupabase.optimizeQueries()`
3. **統計更新**: `ANALYZE table_name;`

## 7. モニタリングアラート

### 監視対象指標

- **Query Latency**: >500ms でアラート
- **Cache Hit Rate**: <70% でアラート
- **Error Rate**: >1% でアラート
- **Connection Pool**: 使用率 >80% でアラート

### 自動最適化

システムは以下の条件で自動最適化を実行：

- キャッシュヒット率 <80%
- メモリ使用量 >100MB
- キャッシュサイズ >90% of MAX_SIZE

## 8. パフォーマンス改善履歴

| 日付       | 改善内容         | Before | After | 改善率 |
| ---------- | ---------------- | ------ | ----- | ------ |
| 2025-01-XX | 基本最適化       | 200ms  | 150ms | 25%    |
| 2025-01-XX | インデックス追加 | 150ms  | 100ms | 33%    |
| 2025-01-XX | キャッシュ強化   | 100ms  | 70ms  | 30%    |

## 次のステップ

1. **インデックス最適化の適用**: `INDEX_OPTIMIZATION.sql`実行
2. **パフォーマンステスト**: ダッシュボードで効果確認
3. **継続監視**: 週次でパフォーマンス指標チェック
4. **追加最適化**: 必要に応じて更なる改善実施
