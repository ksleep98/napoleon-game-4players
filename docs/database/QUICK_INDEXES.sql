-- Napoleon Game - クイックインデックス（最重要のみ）
-- 最小限の必須インデックスで即座にパフォーマンス向上

-- 1. プレイヤールーム検索（最重要・最頻繁）
CREATE INDEX IF NOT EXISTS idx_players_room_connected
ON players (room_id, connected)
WHERE room_id IS NOT NULL AND connected = true;

-- 2. ゲーム統計検索（統計表示で使用）
CREATE INDEX IF NOT EXISTS idx_game_results_napoleon_created
ON game_results (napoleon_player_id, created_at DESC);

-- 3. ゲーム状態検索（ゲーム進行管理）
CREATE INDEX IF NOT EXISTS idx_games_phase_updated
ON games (phase, updated_at DESC)
WHERE phase IS NOT NULL;

-- 統計更新
ANALYZE games;
ANALYZE players;
ANALYZE game_results;