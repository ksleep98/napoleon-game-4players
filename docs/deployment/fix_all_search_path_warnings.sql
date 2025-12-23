-- ============================================
-- セキュリティ修正: 全Function Search Path Mutable対応
-- ============================================
-- 目的: 全14関数に SEARCH_PATH を追加してセキュリティリスクを軽減
-- 実行場所: Supabase Dashboard > SQL Editor
-- 対象環境: 本番環境（Production）
-- 作成日: 2025-12-17
-- ============================================

-- ====================================
-- パフォーマンス関数（4つ）
-- ====================================

-- 1. get_available_rooms - 利用可能ルーム検索
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
LANGUAGE SQL
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id::TEXT, name, player_count, max_players, status, host_player_id::TEXT, created_at
  FROM game_rooms
  WHERE status = 'waiting' AND player_count < max_players
  ORDER BY created_at DESC
  LIMIT room_limit;
$$;

-- 2. get_connected_players - 接続プレイヤー検索
CREATE OR REPLACE FUNCTION get_connected_players(search_term TEXT DEFAULT '', player_limit INT DEFAULT 20)
RETURNS TABLE(
  id TEXT,
  name TEXT,
  connected BOOLEAN,
  game_id TEXT,
  room_id TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT id::TEXT, name, connected, game_id::TEXT, room_id::TEXT, created_at
  FROM players
  WHERE connected = true
    AND (search_term = '' OR name ILIKE '%' || search_term || '%')
  ORDER BY name ASC
  LIMIT player_limit;
$$;

-- 3. get_player_stats_simple - プレイヤー統計計算
CREATE OR REPLACE FUNCTION get_player_stats_simple(player_uuid TEXT)
RETURNS TABLE(
  total_games BIGINT,
  napoleon_wins BIGINT,
  win_rate NUMERIC,
  last_played TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SET search_path = public, pg_temp
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

-- 4. get_recent_results - 最近のゲーム結果
CREATE OR REPLACE FUNCTION get_recent_results(player_uuid TEXT, result_limit INT DEFAULT 10)
RETURNS TABLE(
  id TEXT,
  napoleon_won BOOLEAN,
  was_napoleon BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE SQL
STABLE
SET search_path = public, pg_temp
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

-- ====================================
-- プレイヤーカウント管理関数（3つ）
-- ====================================

-- 5. increment_player_count - プレイヤー数増加
CREATE OR REPLACE FUNCTION increment_player_count(room_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = player_count + 1,
      updated_at = NOW()
  WHERE id = room_id;
END;
$$;

-- 6. decrement_player_count - プレイヤー数減少
CREATE OR REPLACE FUNCTION decrement_player_count(room_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = GREATEST(0, player_count - 1),
      updated_at = NOW()
  WHERE id = room_id;
END;
$$;

-- 7. update_games_updated_at - ゲーム更新時刻更新
CREATE OR REPLACE FUNCTION update_games_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ====================================
-- 確認クエリ
-- ====================================

-- 修正された全関数を確認
SELECT
  routine_name,
  routine_type,
  security_type,
  routine_definition LIKE '%search_path%' as has_search_path
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'get_available_rooms',
    'get_connected_players',
    'get_player_stats_simple',
    'get_recent_results',
    'increment_player_count',
    'decrement_player_count',
    'update_games_updated_at'
  )
ORDER BY routine_name;

-- ====================================
-- 期待される結果:
-- すべての関数で has_search_path = true
-- ====================================

-- 簡易テスト
SELECT * FROM get_available_rooms(5);
SELECT * FROM get_connected_players('', 5);

-- ====================================
-- 完了
-- ====================================
-- このスクリプト実行後、Supabase Security Advisorで
-- すべての"Function Search Path Mutable"警告が消えることを確認
-- ====================================
