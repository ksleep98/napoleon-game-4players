-- Napoleon Game - Core Database Indexes (Supabase Safe)
-- 必須インデックスのみ（trigramエラー回避版）

-- ============================================
-- 高優先度インデックス（必須）
-- ============================================

-- 1. プレイヤールーム検索（最重要）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_room_connected
ON players (room_id, connected)
WHERE room_id IS NOT NULL AND connected = true;

-- 2. ゲーム統計検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_results_napoleon_created
ON game_results (napoleon_player_id, created_at DESC);

-- 3. ゲーム状態検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_phase_updated
ON games (phase, updated_at DESC)
WHERE phase IS NOT NULL;

-- ============================================
-- 中優先度インデックス（推奨）
-- ============================================

-- 4. ルーム一覧表示
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_rooms_status_created
ON game_rooms (status, created_at DESC);

-- 5. JSON検索（スコア）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_results_scores_gin
ON game_results USING gin (scores);

-- 6. プレイヤー名検索（通常のB-tree）
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_name
ON players (name);

-- ============================================
-- 基本インデックス
-- ============================================

-- ゲームID検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_game_id
ON players (game_id)
WHERE game_id IS NOT NULL;

-- ルームID検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_room_id
ON players (room_id)
WHERE room_id IS NOT NULL;

-- ゲーム結果検索
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_game_results_game_id
ON game_results (game_id);

-- 統計更新（実行推奨）
ANALYZE games;
ANALYZE game_rooms;
ANALYZE players;
ANALYZE game_results;