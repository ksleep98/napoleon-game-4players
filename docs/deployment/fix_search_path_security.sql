-- ============================================
-- セキュリティ修正: Function Search Path Mutable対応
-- ============================================
-- 目的: 全関数に SEARCH_PATH を追加してセキュリティリスクを軽減
-- 実行場所: Supabase Dashboard > SQL Editor
-- 対象環境: 本番環境（Production）
-- 作成日: 2025-12-17
-- ============================================
-- 影響を受ける関数: 7つ
-- 1. health_check
-- 2. is_service_role_authenticated
-- 3. debug_rls_check
-- 4. get_current_player_id
-- 5. set_config
-- 6. get_game_state
-- 7. update_player_status
-- ============================================

-- 1. health_check - ヘルスチェック関数
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- シンプルに"OK"を返す
  -- データベース接続が確立されていれば成功
  RETURN 'OK';
END;
$$;

-- 権限を維持
GRANT EXECUTE ON FUNCTION health_check() TO anon;
GRANT EXECUTE ON FUNCTION health_check() TO authenticated;
GRANT EXECUTE ON FUNCTION health_check() TO service_role;

-- 2. is_service_role_authenticated - Service Role認証確認関数
CREATE OR REPLACE FUNCTION is_service_role_authenticated()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  jwt_claims JSONB;
  auth_role TEXT;
  api_key_used TEXT;
BEGIN
  -- JWT claimsをチェック
  BEGIN
    jwt_claims := current_setting('request.jwt.claims', true)::jsonb;
    auth_role := jwt_claims->>'role';

    IF auth_role = 'service_role' THEN
      RETURN true;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  -- 新API Keys形式のチェック（sb_secret_で始まる）
  BEGIN
    api_key_used := current_setting('request.headers', true)::jsonb->>'apikey';
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
$$;

-- 3. debug_rls_check - デバッグ用RLSチェック関数
CREATE OR REPLACE FUNCTION debug_rls_check(game_state JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  current_player_id TEXT;
  player_found BOOLEAN;
  is_service_role BOOLEAN;
BEGIN
  current_player_id := get_current_player_id();
  is_service_role := is_service_role_authenticated();

  -- Service Roleの場合は常に許可
  IF is_service_role THEN
    RETURN true;
  END IF;

  -- プレイヤーIDが設定されていない場合は拒否（本番環境では厳格に）
  IF current_player_id IS NULL THEN
    RETURN false;
  END IF;

  -- JSON配列内でプレイヤーIDを検索
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(game_state->'players') AS player
    WHERE player->>'id' = current_player_id
  ) INTO player_found;

  RETURN player_found;
END;
$$;

-- 4. get_current_player_id - プレイヤーID取得関数
CREATE OR REPLACE FUNCTION get_current_player_id()
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT nullif(current_setting('app.player_id', true), '');
$$;

-- 5. set_config - プレイヤーセッション設定関数
CREATE OR REPLACE FUNCTION set_config(
  setting_name text,
  setting_value text,
  is_local boolean default false
) RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- PostgreSQLの組み込みset_config関数を呼び出し
  RETURN set_config(setting_name, setting_value, is_local);
END;
$$;

-- 6. get_game_state - ゲーム状態取得関数
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
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    g.id::text as game_id,
    g.session_id::text,
    g.state,
    g.phase,
    g.updated_at
  FROM games g
  WHERE g.id = p_game_id::uuid;
END;
$$;

-- 7. update_player_status - プレイヤーステータス更新関数
CREATE OR REPLACE FUNCTION update_player_status(
  p_player_id text,
  p_connected boolean
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO players (id, name, connected, last_seen, updated_at)
  VALUES (p_player_id, 'Player', p_connected, now(), now())
  ON CONFLICT (id)
  DO UPDATE SET
    connected = EXCLUDED.connected,
    last_seen = EXCLUDED.last_seen,
    updated_at = EXCLUDED.updated_at;
END;
$$;

-- ============================================
-- 修正確認クエリ
-- ============================================
SELECT
  routine_name,
  routine_type,
  security_type,
  routine_definition LIKE '%search_path%' as has_search_path
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'health_check',
    'is_service_role_authenticated',
    'debug_rls_check',
    'get_current_player_id',
    'set_config',
    'get_game_state',
    'update_player_status'
  )
ORDER BY routine_name;

-- ============================================
-- 期待される結果:
-- すべての関数で has_search_path = true になるはず
-- ============================================

-- 簡易テスト
SELECT health_check() as health;
SELECT get_current_player_id() as player_id;

-- ============================================
-- 完了
-- ============================================
-- このスクリプト実行後、Supabase Security Advisorで
-- "Function Search Path Mutable" 警告が消えることを確認してください
-- ============================================
