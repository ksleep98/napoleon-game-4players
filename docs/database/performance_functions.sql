-- 💨 STEP 1: パフォーマンス関数（100ms以下を目指す）
-- 実行方法: SupabaseのSQL Editorで以下をすべて実行

-- 1. 利用可能ルーム検索（高頻度）
CREATE OR REPLACE FUNCTION get_available_rooms(room_limit INT DEFAULT 10)
RETURNS TABLE(
  id TEXT,
  name TEXT,
  player_count INT,
  max_players INT,
  status TEXT,
  host_player_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT id::TEXT, name, player_count, max_players, status, host_player_id::TEXT, created_at
  FROM game_rooms
  WHERE status = 'waiting' AND player_count < max_players
  ORDER BY created_at DESC
  LIMIT room_limit;
$$;

-- 2. 接続プレイヤー検索（高頻度）
CREATE OR REPLACE FUNCTION get_connected_players(search_term TEXT DEFAULT '', player_limit INT DEFAULT 20)
RETURNS TABLE(
  id TEXT,
  name TEXT,
  connected BOOLEAN,
  game_id TEXT,
  room_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT id::TEXT, name, connected, game_id::TEXT, room_id::TEXT, created_at
  FROM players
  WHERE connected = true
    AND (search_term = '' OR name ILIKE '%' || search_term || '%')
  ORDER BY name ASC
  LIMIT player_limit;
$$;

-- 3. プレイヤー統計計算（軽量版）
CREATE OR REPLACE FUNCTION get_player_stats_simple(player_uuid TEXT)
RETURNS TABLE(
  total_games BIGINT,
  napoleon_wins BIGINT,
  win_rate NUMERIC,
  last_played TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    COUNT(*) as total_games,
    COUNT(*) FILTER (WHERE napoleon_player_id = player_uuid AND napoleon_won = true) as napoleon_wins,
    CASE
      WHEN COUNT(*) FILTER (WHERE napoleon_player_id = player_uuid) > 0
      THEN ROUND((COUNT(*) FILTER (WHERE napoleon_player_id = player_uuid AND napoleon_won = true)::NUMERIC / COUNT(*) FILTER (WHERE napoleon_player_id = player_uuid)::NUMERIC) * 100, 1)
      ELSE 0
    END as win_rate,
    MAX(created_at) as last_played
  FROM game_results
  WHERE napoleon_player_id = player_uuid OR adjutant_player_id = player_uuid;
$$;

-- 4. 最近のゲーム結果（軽量版）
CREATE OR REPLACE FUNCTION get_recent_results(player_uuid TEXT, result_limit INT DEFAULT 10)
RETURNS TABLE(
  id TEXT,
  napoleon_won BOOLEAN,
  was_napoleon BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    id::TEXT,
    napoleon_won,
    (napoleon_player_id = player_uuid) as was_napoleon,
    created_at
  FROM game_results
  WHERE napoleon_player_id = player_uuid OR adjutant_player_id = player_uuid
  ORDER BY created_at DESC
  LIMIT result_limit;
$$;

-- パフォーマンス監視用のビュー（簡潔版）
-- NOTE: このビューは削除されました（2025-12-13）
-- 理由: SECURITY DEFINER セキュリティアラート対応 & 未使用のため
-- 必要な場合は SECURITY INVOKER で再作成すること
--
-- CREATE OR REPLACE VIEW perf_stats
-- WITH (security_invoker = true) AS
-- SELECT
--   'rooms' as type,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE status = 'waiting' AND player_count < max_players) as available
-- FROM game_rooms
-- UNION ALL
-- SELECT
--   'players' as type,
--   COUNT(*) as total,
--   COUNT(*) FILTER (WHERE connected = true) as available
-- FROM players;

-- 使用例:
-- SELECT * FROM get_available_rooms(10);
-- SELECT * FROM get_connected_players('', 20);
-- SELECT * FROM get_player_stats_simple('your-player-id');
-- SELECT * FROM get_recent_results('your-player-id', 5);
-- SELECT * FROM perf_stats;