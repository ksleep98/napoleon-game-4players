-- Napoleon Game Database Index Optimization
-- パフォーマンス向上のためのインデックス最適化SQL

-- ============================================
-- 1. ゲームテーブル最適化
-- ============================================

-- ゲーム状態検索の高速化（phase別検索）
CREATE INDEX IF NOT EXISTS idx_games_phase
ON games (phase)
WHERE phase IS NOT NULL;

-- 更新日時での検索最適化
CREATE INDEX IF NOT EXISTS idx_games_updated_at
ON games (updated_at DESC);

-- 勝利チーム検索の最適化
CREATE INDEX IF NOT EXISTS idx_games_winner_team
ON games (winner_team)
WHERE winner_team IS NOT NULL;

-- 複合インデックス: フェーズと更新日時
CREATE INDEX IF NOT EXISTS idx_games_phase_updated
ON games (phase, updated_at DESC)
WHERE phase IS NOT NULL;

-- ============================================
-- 2. ゲームルームテーブル最適化
-- ============================================

-- ステータス別検索の高速化
CREATE INDEX IF NOT EXISTS idx_game_rooms_status
ON game_rooms (status);

-- ホストプレイヤー検索の最適化
CREATE INDEX IF NOT EXISTS idx_game_rooms_host
ON game_rooms (host_player_id);

-- プレイヤー数での検索最適化
CREATE INDEX IF NOT EXISTS idx_game_rooms_player_count
ON game_rooms (player_count, max_players);

-- 複合インデックス: ステータスと作成日時
CREATE INDEX IF NOT EXISTS idx_game_rooms_status_created
ON game_rooms (status, created_at DESC);

-- ============================================
-- 3. プレイヤーテーブル最適化
-- ============================================

-- ゲームID検索の高速化
CREATE INDEX IF NOT EXISTS idx_players_game_id
ON players (game_id)
WHERE game_id IS NOT NULL;

-- ルームID検索の高速化
CREATE INDEX IF NOT EXISTS idx_players_room_id
ON players (room_id)
WHERE room_id IS NOT NULL;

-- 接続状態検索の最適化
CREATE INDEX IF NOT EXISTS idx_players_connected
ON players (connected)
WHERE connected = true;

-- 複合インデックス: ルームIDと接続状態
CREATE INDEX IF NOT EXISTS idx_players_room_connected
ON players (room_id, connected)
WHERE room_id IS NOT NULL AND connected = true;

-- 複合インデックス: ゲームIDと接続状態
CREATE INDEX IF NOT EXISTS idx_players_game_connected
ON players (game_id, connected)
WHERE game_id IS NOT NULL;

-- 名前検索の最適化（部分一致対応）
CREATE INDEX IF NOT EXISTS idx_players_name_trgm
ON players USING gin (name gin_trgm_ops);

-- ============================================
-- 4. ゲーム結果テーブル最適化
-- ============================================

-- ゲームID検索の高速化
CREATE INDEX IF NOT EXISTS idx_game_results_game_id
ON game_results (game_id);

-- ナポレオンプレイヤー検索の最適化
CREATE INDEX IF NOT EXISTS idx_game_results_napoleon
ON game_results (napoleon_player_id);

-- 副官プレイヤー検索の最適化
CREATE INDEX IF NOT EXISTS idx_game_results_adjutant
ON game_results (adjutant_player_id)
WHERE adjutant_player_id IS NOT NULL;

-- 勝利状況検索の最適化
CREATE INDEX IF NOT EXISTS idx_game_results_napoleon_won
ON game_results (napoleon_won);

-- 作成日時での検索最適化（統計用）
CREATE INDEX IF NOT EXISTS idx_game_results_created_at
ON game_results (created_at DESC);

-- スコアJSONでの検索最適化（GINインデックス）
CREATE INDEX IF NOT EXISTS idx_game_results_scores_gin
ON game_results USING gin (scores);

-- 複合インデックス: ナポレオンプレイヤーと作成日時
CREATE INDEX IF NOT EXISTS idx_game_results_napoleon_created
ON game_results (napoleon_player_id, created_at DESC);

-- ============================================
-- 5. パフォーマンス統計用ビュー
-- ============================================

-- プレイヤー統計ビューの作成
CREATE OR REPLACE VIEW player_statistics AS
SELECT
    p.id,
    p.name,
    COUNT(gr.id) as total_games,
    COUNT(CASE WHEN gr.napoleon_player_id = p.id THEN 1 END) as napoleon_games,
    COUNT(CASE WHEN gr.napoleon_player_id = p.id AND gr.napoleon_won THEN 1 END) as napoleon_wins,
    COUNT(CASE WHEN gr.adjutant_player_id = p.id THEN 1 END) as adjutant_games,
    AVG(CASE WHEN gr.napoleon_player_id = p.id THEN gr.face_cards_won END) as avg_face_cards_as_napoleon,
    MAX(gr.created_at) as last_game_date
FROM players p
LEFT JOIN game_results gr ON (
    gr.napoleon_player_id = p.id
    OR gr.adjutant_player_id = p.id
    OR gr.scores @> jsonb_build_array(jsonb_build_object('playerId', p.id))
)
GROUP BY p.id, p.name;

-- ゲーム統計ビューの作成
CREATE OR REPLACE VIEW game_statistics AS
SELECT
    DATE(gr.created_at) as game_date,
    COUNT(*) as total_games,
    COUNT(CASE WHEN gr.napoleon_won THEN 1 END) as napoleon_wins,
    COUNT(CASE WHEN NOT gr.napoleon_won THEN 1 END) as allied_wins,
    AVG(gr.face_cards_won) as avg_face_cards,
    MIN(gr.created_at) as first_game_time,
    MAX(gr.created_at) as last_game_time
FROM game_results gr
GROUP BY DATE(gr.created_at)
ORDER BY game_date DESC;

-- ============================================
-- 6. パフォーマンス監視用関数
-- ============================================

-- インデックス使用状況確認関数
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

-- クエリパフォーマンス統計関数
CREATE OR REPLACE FUNCTION get_query_performance()
RETURNS TABLE(
    query text,
    calls bigint,
    total_time double precision,
    mean_time double precision,
    rows bigint
)
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT
        query,
        calls,
        total_exec_time as total_time,
        mean_exec_time as mean_time,
        rows
    FROM pg_stat_statements
    WHERE query LIKE '%games%' OR query LIKE '%players%' OR query LIKE '%game_results%'
    ORDER BY mean_exec_time DESC
    LIMIT 20;
$$;

-- ============================================
-- 7. 定期メンテナンス推奨事項
-- ============================================

-- インデックス再構築（月次実行推奨）
-- REINDEX INDEX CONCURRENTLY idx_game_results_scores_gin;
-- REINDEX INDEX CONCURRENTLY idx_players_name_trgm;

-- 統計情報更新（週次実行推奨）
-- ANALYZE games;
-- ANALYZE game_rooms;
-- ANALYZE players;
-- ANALYZE game_results;

-- 不要データクリーンアップ（月次実行推奨）
-- DELETE FROM players WHERE connected = false AND created_at < NOW() - INTERVAL '30 days';
-- DELETE FROM game_rooms WHERE status = 'finished' AND created_at < NOW() - INTERVAL '7 days';