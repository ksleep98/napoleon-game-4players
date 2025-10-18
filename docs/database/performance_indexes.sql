-- 💨 STEP 2: パフォーマンスインデックス（個別実行）
-- 実行方法: SupabaseのSQL Editorで1つずつ実行

-- 注意: 各インデックスを個別に実行してください（一括実行不可）

-- インデックス1: ゲームルーム検索用
CREATE INDEX IF NOT EXISTS idx_game_rooms_waiting_fast
ON game_rooms (status, created_at DESC)
WHERE status = 'waiting' AND player_count < max_players;

-- インデックス2: プレイヤー検索用
CREATE INDEX IF NOT EXISTS idx_players_connected_search
ON players (connected, name)
WHERE connected = true;

-- インデックス3: ナポレオンゲーム結果用
CREATE INDEX IF NOT EXISTS idx_game_results_napoleon_fast
ON game_results (napoleon_player_id, created_at DESC);

-- インデックス4: アジュタントゲーム結果用
CREATE INDEX IF NOT EXISTS idx_game_results_adjutant_fast
ON game_results (adjutant_player_id, created_at DESC)
WHERE adjutant_player_id IS NOT NULL;

-- 実行確認:
-- SELECT indexname, tablename FROM pg_indexes WHERE indexname LIKE '%_fast';