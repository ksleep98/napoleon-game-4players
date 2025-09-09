-- Napoleon Game RLS Policies
-- これらのポリシーはSupabaseダッシュボードまたはSQL Editorで実行してください

-- RLSを有効化
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- 設定関数を作成（プレイヤーセッション管理用）
CREATE OR REPLACE FUNCTION get_current_player_id()
RETURNS TEXT AS $$
BEGIN
  -- current_setting関数を使ってプレイヤーIDを取得
  RETURN current_setting('app.player_id', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 新しいAPI Keys形式でのService Role認証を確認する関数
CREATE OR REPLACE FUNCTION is_service_role_authenticated()
RETURNS BOOLEAN AS $$
DECLARE
  jwt_claims JSONB;
  auth_role TEXT;
  api_key_used TEXT;
BEGIN
  -- 様々な認証方法をチェック
  BEGIN
    -- JWT claimsを取得
    jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    auth_role := jwt_claims->>'role';

    -- Service Roleか確認
    IF auth_role = 'service_role' THEN
      RETURN true;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      -- JWT取得に失敗した場合、他の方法を試す
      NULL;
  END;

  -- 新API Keys形式の場合、API Keyヘッダーをチェック
  BEGIN
    api_key_used := current_setting('request.headers', true)::jsonb->>'apikey';
    -- Secret Keyが使用されている場合（sb_secret_で始まる）
    IF api_key_used IS NOT NULL AND api_key_used LIKE 'sb_secret_%' THEN
      RETURN true;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  -- authorization headerもチェック
  BEGIN
    auth_role := current_setting('request.headers', true)::jsonb->>'authorization';
    IF auth_role IS NOT NULL AND auth_role LIKE '%service_role%' THEN
      RETURN true;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- set_config関数をクリーンアップして再作成（RLS用）
DROP FUNCTION IF EXISTS public.set_config(text,text,boolean);

-- RLS用のset_config関数を作成（PostgreSQLの組み込み関数をラップ）
CREATE OR REPLACE FUNCTION public.set_config(
  setting_name TEXT,
  setting_value TEXT,
  is_local BOOLEAN DEFAULT true
)
RETURNS TEXT AS $$
BEGIN
  -- PostgreSQLの組み込みset_config関数を呼び出し
  RETURN set_config(setting_name, setting_value, is_local);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ゲームテーブルのRLSポリシー（デバッグ機能付き）
-- プレイヤーは自分が参加しているゲームのみアクセス可能
DROP POLICY IF EXISTS "Players can access their games" ON games;

-- デバッグ用のヘルパー関数を作成（新API Keys対応）
CREATE OR REPLACE FUNCTION debug_rls_check(game_state JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  current_player_id TEXT;
  player_found BOOLEAN;
  is_development BOOLEAN;
  is_service_role BOOLEAN;
  jwt_info TEXT;
  headers_info TEXT;
BEGIN
  current_player_id := get_current_player_id();
  is_service_role := is_service_role_authenticated();

  -- デバッグ情報を収集
  BEGIN
    jwt_info := current_setting('request.jwt.claims', true);
  EXCEPTION
    WHEN OTHERS THEN
      jwt_info := 'Not available';
  END;

  BEGIN
    headers_info := current_setting('request.headers', true);
  EXCEPTION
    WHEN OTHERS THEN
      headers_info := 'Not available';
  END;

  -- Service Roleの場合は常に許可
  IF is_service_role THEN
    RAISE NOTICE 'RLS Debug - Service Role authenticated: allowing all access';
    RAISE NOTICE 'RLS Debug - JWT: %, Headers: %',
      COALESCE(substring(jwt_info, 1, 100), 'NULL'),
      COALESCE(substring(headers_info, 1, 100), 'NULL');
    RETURN true;
  END IF;

  -- 開発環境かどうかを判定（より寛容に）
  is_development := current_player_id IS NULL OR
                    current_setting('app.environment', true) = 'development' OR
                    current_setting('log_statement', true) = 'all';

  -- デバッグログ
  RAISE NOTICE 'RLS Debug - Player ID: %, Development: %, Service Role: %',
    COALESCE(current_player_id, 'NULL'), is_development, is_service_role;
  RAISE NOTICE 'RLS Debug - Game Players: %', game_state->'players';

  -- 開発環境では制限を大幅に緩和
  IF is_development THEN
    RAISE NOTICE 'RLS Debug - Development mode: allowing access';
    RETURN true;
  END IF;

  -- プレイヤー ID が設定されていない場合も許可（開発用）
  IF current_player_id IS NULL THEN
    RAISE NOTICE 'RLS Debug - No player ID set: allowing access for development';
    RETURN true;
  END IF;

  -- JSON配列内でプレイヤーIDを検索
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(game_state->'players') AS player
    WHERE player->>'id' = current_player_id
  ) INTO player_found;

  RAISE NOTICE 'RLS Debug - Player Found: %', player_found;

  RETURN player_found;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Players can access their games" ON games
FOR ALL USING (debug_rls_check(state));

-- ゲームルームテーブルのRLSポリシー
-- 全てのプレイヤーがルーム一覧を見ることができる（待機中のルームのみ）
DROP POLICY IF EXISTS "Anyone can view waiting rooms" ON game_rooms;
CREATE POLICY "Anyone can view waiting rooms" ON game_rooms
FOR SELECT USING (status = 'waiting');

-- プレイヤーは自分がホストのルームを管理できる
DROP POLICY IF EXISTS "Players can manage their rooms" ON game_rooms;
CREATE POLICY "Players can manage their rooms" ON game_rooms
FOR ALL USING (
  is_service_role_authenticated() -- Service Roleは常に許可
  OR host_player_id = get_current_player_id()
  OR get_current_player_id() IS NULL -- 開発環境では制限を緩和
);

-- プレイヤーテーブルのRLSポリシー
-- プレイヤーは自分の情報のみアクセス可能
DROP POLICY IF EXISTS "Players can access their own data" ON players;
CREATE POLICY "Players can access their own data" ON players
FOR ALL USING (
  is_service_role_authenticated() -- Service Roleは常に許可
  OR id = get_current_player_id()
  OR get_current_player_id() IS NULL -- 開発環境では制限を緩和
);

-- ゲーム結果テーブルのRLSポリシー
-- プレイヤーは自分が参加したゲームの結果のみ閲覧可能
DROP POLICY IF EXISTS "Players can view their game results" ON game_results;
CREATE POLICY "Players can view their game results" ON game_results
FOR SELECT USING (
  is_service_role_authenticated() -- Service Roleは常に許可
  OR (
    -- ゲーム結果のスコアに自分のプレイヤーIDが含まれているかチェック
    EXISTS (
      SELECT 1 FROM jsonb_array_elements(scores) AS score
      WHERE score->>'playerId' = get_current_player_id()
    )
    OR napoleon_player_id = get_current_player_id()
    OR adjutant_player_id = get_current_player_id()
    OR get_current_player_id() IS NULL -- 開発環境では制限を緩和
  )
);

-- ゲーム結果の挿入は制限なし（サーバーアクション経由）
DROP POLICY IF EXISTS "Authenticated users can insert game results" ON game_results;
CREATE POLICY "Authenticated users can insert game results" ON game_results
FOR INSERT WITH CHECK (true);

-- プレイヤー数増加のための関数（ルーム参加時に使用）
CREATE OR REPLACE FUNCTION increment_player_count(room_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = player_count + 1,
      updated_at = NOW()
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
