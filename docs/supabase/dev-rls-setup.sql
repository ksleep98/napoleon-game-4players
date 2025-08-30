-- 開発環境用 RLS セットアップスクリプト
-- Supabase ダッシュボードの SQL Editor で実行してください

-- 1. set_config関数を作成（プレイヤーセッション設定用）
CREATE OR REPLACE FUNCTION set_config(
  setting_name text,
  setting_value text,
  is_local boolean default false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- PostgreSQLの組み込みset_config関数を呼び出し
  RETURN set_config(setting_name, setting_value, is_local);
END;
$$;

-- 2. プレイヤーIDを取得する関数
CREATE OR REPLACE FUNCTION get_current_player_id() 
RETURNS text 
LANGUAGE sql 
STABLE
AS $$
  SELECT nullif(current_setting('app.player_id', true), '');
$$;

-- 3. RLS ポリシーを有効化（既に有効でない場合）
ALTER TABLE IF EXISTS games ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS players ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS game_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS game_rooms ENABLE ROW LEVEL SECURITY;

-- 4. games テーブルのポリシー
DO $$
BEGIN
  -- 既存のポリシーを削除（エラーを無視）
  DROP POLICY IF EXISTS "games_select_policy" ON games;
  DROP POLICY IF EXISTS "games_insert_policy" ON games;
  DROP POLICY IF EXISTS "games_update_policy" ON games;
  DROP POLICY IF EXISTS "games_delete_policy" ON games;

  -- 新しいポリシーを作成
  CREATE POLICY "games_select_policy" ON games
    FOR SELECT USING (
      get_current_player_id() IS NOT NULL AND (
        -- プレイヤーがゲームに参加している場合のみアクセス可能
        (state->'players') @> json_build_array(json_build_object('id', get_current_player_id()))::jsonb
        OR get_current_player_id() IS NULL  -- 開発環境での緩和措置
      )
    );

  CREATE POLICY "games_insert_policy" ON games
    FOR INSERT WITH CHECK (
      get_current_player_id() IS NOT NULL AND (
        -- プレイヤーがゲームに参加している場合のみ挿入可能
        (state->'players') @> json_build_array(json_build_object('id', get_current_player_id()))::jsonb
        OR get_current_player_id() IS NULL  -- 開発環境での緩和措置
      )
    );

  CREATE POLICY "games_update_policy" ON games
    FOR UPDATE USING (
      get_current_player_id() IS NOT NULL AND (
        -- プレイヤーがゲームに参加している場合のみ更新可能
        (state->'players') @> json_build_array(json_build_object('id', get_current_player_id()))::jsonb
        OR get_current_player_id() IS NULL  -- 開発環境での緩和措置
      )
    );

  CREATE POLICY "games_delete_policy" ON games
    FOR DELETE USING (
      get_current_player_id() IS NOT NULL AND (
        -- プレイヤーがゲームに参加している場合のみ削除可能
        (state->'players') @> json_build_array(json_build_object('id', get_current_player_id()))::jsonb
        OR get_current_player_id() IS NULL  -- 開発環境での緩和措置
      )
    );
END;
$$;

-- 5. players テーブルのポリシー
DO $$
BEGIN
  DROP POLICY IF EXISTS "players_select_policy" ON players;
  DROP POLICY IF EXISTS "players_insert_policy" ON players;
  DROP POLICY IF EXISTS "players_update_policy" ON players;
  DROP POLICY IF EXISTS "players_delete_policy" ON players;

  CREATE POLICY "players_select_policy" ON players
    FOR SELECT USING (
      id = get_current_player_id() OR get_current_player_id() IS NULL
    );

  CREATE POLICY "players_insert_policy" ON players
    FOR INSERT WITH CHECK (
      id = get_current_player_id() OR get_current_player_id() IS NULL
    );

  CREATE POLICY "players_update_policy" ON players
    FOR UPDATE USING (
      id = get_current_player_id() OR get_current_player_id() IS NULL
    );

  CREATE POLICY "players_delete_policy" ON players
    FOR DELETE USING (
      id = get_current_player_id() OR get_current_player_id() IS NULL
    );
END;
$$;

-- 6. 設定確認クエリ
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname;

-- プレイヤーセッション設定テスト
SELECT set_config('app.player_id', 'test_player_1', true);
SELECT get_current_player_id();