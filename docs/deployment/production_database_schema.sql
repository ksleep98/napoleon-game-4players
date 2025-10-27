-- Napoleon Game Production Database Schema
-- Supabase Production Dashboard の SQL Editor で実行してください

-- ============================================
-- 1. テーブル作成
-- ============================================

-- Players テーブル（プレイヤー管理）
CREATE TABLE IF NOT EXISTS players (
  id text PRIMARY KEY,
  name text NOT NULL,
  connected boolean DEFAULT false,
  last_seen timestamp with time zone DEFAULT timezone('utc'::text, now()),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Games テーブル（ゲーム状態管理）
CREATE TABLE IF NOT EXISTS games (
  id text PRIMARY KEY,
  session_id text,
  state jsonb NOT NULL DEFAULT '{}',
  phase text NOT NULL DEFAULT 'waiting',
  winner_team text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Game Rooms テーブル（ルーム管理）
CREATE TABLE IF NOT EXISTS game_rooms (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id text UNIQUE NOT NULL,
  host_player_id text REFERENCES players(id) ON DELETE CASCADE,
  players jsonb NOT NULL DEFAULT '[]',
  status text NOT NULL DEFAULT 'waiting',
  max_players integer DEFAULT 4,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Game Results テーブル（結果保存）
CREATE TABLE IF NOT EXISTS game_results (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id text REFERENCES games(id) ON DELETE CASCADE,
  player_scores jsonb NOT NULL DEFAULT '[]',
  winner_id text,
  finished_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================
-- 2. インデックス作成
-- ============================================

-- Players テーブル
CREATE INDEX IF NOT EXISTS idx_players_connected ON players(connected);
CREATE INDEX IF NOT EXISTS idx_players_created_at ON players(created_at);

-- Games テーブル
CREATE INDEX IF NOT EXISTS idx_games_id ON games(id);
CREATE INDEX IF NOT EXISTS idx_games_phase ON games(phase);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_games_winner_team ON games(winner_team);

-- Game Rooms テーブル
CREATE INDEX IF NOT EXISTS idx_game_rooms_room_id ON game_rooms(room_id);
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_game_rooms_host_player_id ON game_rooms(host_player_id);

-- Game Results テーブル
CREATE INDEX IF NOT EXISTS idx_game_results_game_id ON game_results(game_id);
CREATE INDEX IF NOT EXISTS idx_game_results_winner_id ON game_results(winner_id);

-- ============================================
-- 3. RLS 関数作成
-- ============================================

-- set_config関数（プレイヤーセッション設定用）
CREATE OR REPLACE FUNCTION set_config(
  setting_name text,
  setting_value text,
  is_local boolean default false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN set_config(setting_name, setting_value, is_local);
END;
$$;

-- プレイヤーIDを取得する関数
CREATE OR REPLACE FUNCTION get_current_player_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('app.player_id', true), '');
$$;

-- ============================================
-- 4. RLS ポリシー設定
-- ============================================

-- RLS 有効化
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- Players テーブルのポリシー
DROP POLICY IF EXISTS "players_select_policy" ON players;
DROP POLICY IF EXISTS "players_insert_policy" ON players;
DROP POLICY IF EXISTS "players_update_policy" ON players;

CREATE POLICY "players_select_policy" ON players
  FOR SELECT USING (
    id = get_current_player_id() OR get_current_player_id() IS NOT NULL
  );

CREATE POLICY "players_insert_policy" ON players
  FOR INSERT WITH CHECK (true);

CREATE POLICY "players_update_policy" ON players
  FOR UPDATE USING (
    id = get_current_player_id() OR get_current_player_id() IS NOT NULL
  );

-- Games テーブルのポリシー
DROP POLICY IF EXISTS "games_select_policy" ON games;
DROP POLICY IF EXISTS "games_insert_policy" ON games;
DROP POLICY IF EXISTS "games_update_policy" ON games;

CREATE POLICY "games_select_policy" ON games
  FOR SELECT USING (true);

CREATE POLICY "games_insert_policy" ON games
  FOR INSERT WITH CHECK (true);

CREATE POLICY "games_update_policy" ON games
  FOR UPDATE USING (true);

-- Game Rooms テーブルのポリシー
DROP POLICY IF EXISTS "game_rooms_select_policy" ON game_rooms;
DROP POLICY IF EXISTS "game_rooms_insert_policy" ON game_rooms;
DROP POLICY IF EXISTS "game_rooms_update_policy" ON game_rooms;

CREATE POLICY "game_rooms_select_policy" ON game_rooms
  FOR SELECT USING (true);

CREATE POLICY "game_rooms_insert_policy" ON game_rooms
  FOR INSERT WITH CHECK (true);

CREATE POLICY "game_rooms_update_policy" ON game_rooms
  FOR UPDATE USING (true);

-- Game Results テーブルのポリシー
DROP POLICY IF EXISTS "game_results_select_policy" ON game_results;
DROP POLICY IF EXISTS "game_results_insert_policy" ON game_results;

CREATE POLICY "game_results_select_policy" ON game_results
  FOR SELECT USING (true);

CREATE POLICY "game_results_insert_policy" ON game_results
  FOR INSERT WITH CHECK (true);

-- ============================================
-- 5. パフォーマンス最適化関数（オプション）
-- ============================================

-- 既存の関数を削除（署名が異なる場合のため）
DROP FUNCTION IF EXISTS get_game_state(text);
DROP FUNCTION IF EXISTS update_player_status(text, boolean);

-- ゲーム状態を高速に取得する関数
CREATE OR REPLACE FUNCTION get_game_state(p_game_id text)
RETURNS TABLE (
  game_id text,
  session_id text,
  state jsonb,
  phase text,
  updated_at timestamptz
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id,
    g.session_id,
    g.state,
    g.phase,
    g.updated_at
  FROM games g
  WHERE g.id = p_game_id;
END;
$$;

-- プレイヤー状態を高速に更新する関数
CREATE OR REPLACE FUNCTION update_player_status(
  p_player_id text,
  p_connected boolean
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO players (id, name, connected, last_seen, updated_at)
  VALUES (p_player_id, 'Player', p_connected, now(), now())
  ON CONFLICT (id)
  DO UPDATE SET
    connected = p_connected,
    last_seen = now(),
    updated_at = now();
END;
$$;

-- ============================================
-- 6. 確認クエリ
-- ============================================

-- テーブル一覧確認
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- RLS ポリシー確認
SELECT
  tablename,
  policyname,
  permissive,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 関数確認
SELECT
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('set_config', 'get_current_player_id', 'get_game_state', 'update_player_status')
ORDER BY routine_name;
