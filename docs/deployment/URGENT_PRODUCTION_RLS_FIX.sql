-- ⚠️ 2026-10: このファイルの set_config / is_service_role_authenticated / ポリシー定義は古い。
--    単独で流すと docs/supabase/rls-hardening-2026-10.sql で直した内容が元に戻る。
--    流した場合は、直後に必ず rls-hardening-2026-10.sql を流すこと。

-- ============================================
-- 🚨 緊急: 本番環境RLSポリシー修正スクリプト
-- ============================================
-- 実行日: 2025-10-25
-- 目的: 本番環境の重大なセキュリティ脆弱性を修正
--
-- ⚠️ 警告: このスクリプトは本番データベースに直接影響します
-- ⚠️ 実行前にバックアップを取得してください
--
-- 実行方法:
-- 1. Supabase Dashboard > SQL Editor を開く
-- 2. このスクリプト全体をコピー&ペースト
-- 3. "Run" をクリック
-- ============================================

BEGIN;

-- ============================================
-- 1. 必要な関数を作成/更新
-- ============================================

-- プレイヤーIDを取得する関数（既存の場合は更新）
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

-- Service Role認証を確認する関数（新API Keys対応）
CREATE OR REPLACE FUNCTION is_service_role_authenticated()
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- デバッグ用のRLSチェック関数（ゲーム用）
CREATE OR REPLACE FUNCTION debug_rls_check(game_state JSONB)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 2. players テーブル - セキュアなポリシーに置き換え
-- ============================================

-- 古いポリシーを削除
DROP POLICY IF EXISTS "players_select_policy" ON players;
DROP POLICY IF EXISTS "players_insert_policy" ON players;
DROP POLICY IF EXISTS "players_update_policy" ON players;
DROP POLICY IF EXISTS "players_delete_policy" ON players;

-- 新しいセキュアなポリシーを作成
CREATE POLICY "players_select_policy" ON players
  FOR SELECT USING (
    is_service_role_authenticated()
    OR id = get_current_player_id()
  );

CREATE POLICY "players_insert_policy" ON players
  FOR INSERT WITH CHECK (
    is_service_role_authenticated()
    OR id = get_current_player_id()
  );

CREATE POLICY "players_update_policy" ON players
  FOR UPDATE USING (
    is_service_role_authenticated()
    OR id = get_current_player_id()
  );

CREATE POLICY "players_delete_policy" ON players
  FOR DELETE USING (
    is_service_role_authenticated()
  );

-- ============================================
-- 3. games テーブル - セキュアなポリシーに置き換え
-- ============================================

-- 古いポリシーを削除
DROP POLICY IF EXISTS "games_select_policy" ON games;
DROP POLICY IF EXISTS "games_insert_policy" ON games;
DROP POLICY IF EXISTS "games_update_policy" ON games;
DROP POLICY IF EXISTS "games_delete_policy" ON games;

-- 新しいセキュアなポリシーを作成
CREATE POLICY "games_select_policy" ON games
  FOR SELECT USING (
    is_service_role_authenticated()
    OR debug_rls_check(state)
  );

CREATE POLICY "games_insert_policy" ON games
  FOR INSERT WITH CHECK (
    is_service_role_authenticated()
    OR debug_rls_check(state)
  );

CREATE POLICY "games_update_policy" ON games
  FOR UPDATE USING (
    is_service_role_authenticated()
    OR debug_rls_check(state)
  );

CREATE POLICY "games_delete_policy" ON games
  FOR DELETE USING (
    is_service_role_authenticated()
  );

-- ============================================
-- 4. game_rooms テーブル - セキュアなポリシーに置き換え
-- ============================================

-- 古いポリシーを削除
DROP POLICY IF EXISTS "game_rooms_select_policy" ON game_rooms;
DROP POLICY IF EXISTS "game_rooms_insert_policy" ON game_rooms;
DROP POLICY IF EXISTS "game_rooms_update_policy" ON game_rooms;
DROP POLICY IF EXISTS "game_rooms_delete_policy" ON game_rooms;

-- 新しいセキュアなポリシーを作成

-- SELECT: 待機中のルームは全員閲覧可能、それ以外はホストのみ
CREATE POLICY "game_rooms_select_policy" ON game_rooms
  FOR SELECT USING (
    is_service_role_authenticated()
    OR status = 'waiting'
    OR host_player_id = get_current_player_id()
  );

-- INSERT: 認証済みユーザーのみ（自分がホストのルームのみ作成可能）
CREATE POLICY "game_rooms_insert_policy" ON game_rooms
  FOR INSERT WITH CHECK (
    is_service_role_authenticated()
    OR host_player_id = get_current_player_id()
  );

-- UPDATE: ホストまたはService Roleのみ
CREATE POLICY "game_rooms_update_policy" ON game_rooms
  FOR UPDATE USING (
    is_service_role_authenticated()
    OR host_player_id = get_current_player_id()
  );

-- DELETE: ホストまたはService Roleのみ
CREATE POLICY "game_rooms_delete_policy" ON game_rooms
  FOR DELETE USING (
    is_service_role_authenticated()
    OR host_player_id = get_current_player_id()
  );

-- ============================================
-- 5. game_results テーブル - セキュアなポリシーに置き換え
-- ============================================

-- 古いポリシーを削除
DROP POLICY IF EXISTS "game_results_select_policy" ON game_results;
DROP POLICY IF EXISTS "game_results_insert_policy" ON game_results;
DROP POLICY IF EXISTS "game_results_update_policy" ON game_results;
DROP POLICY IF EXISTS "game_results_delete_policy" ON game_results;

-- 新しいセキュアなポリシーを作成

-- SELECT: 自分が参加したゲームの結果のみ閲覧可能
CREATE POLICY "game_results_select_policy" ON game_results
  FOR SELECT USING (
    is_service_role_authenticated()
    OR EXISTS (
      SELECT 1
      FROM jsonb_array_elements(player_scores) AS score
      WHERE score->>'playerId' = get_current_player_id()
    )
    OR winner_id = get_current_player_id()
  );

-- INSERT: Service Roleのみ（Server Actions経由）
CREATE POLICY "game_results_insert_policy" ON game_results
  FOR INSERT WITH CHECK (
    is_service_role_authenticated()
  );

-- UPDATE: Service Roleのみ
CREATE POLICY "game_results_update_policy" ON game_results
  FOR UPDATE USING (
    is_service_role_authenticated()
  );

-- DELETE: Service Roleのみ
CREATE POLICY "game_results_delete_policy" ON game_results
  FOR DELETE USING (
    is_service_role_authenticated()
  );

-- ============================================
-- 6. RLSが有効になっていることを確認
-- ============================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. 確認クエリ（実行結果を確認）
-- ============================================

-- 適用されたポリシーを確認
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE
    WHEN qual = 'true' THEN '⚠️ INSECURE: true'
    WHEN qual IS NULL THEN 'N/A'
    ELSE '✅ ' || left(qual, 50)
  END as policy_condition
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('players', 'games', 'game_rooms', 'game_results')
ORDER BY tablename, cmd, policyname;

-- RLSが有効になっているか確認
SELECT
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ Enabled'
    ELSE '❌ Disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('players', 'games', 'game_rooms', 'game_results')
ORDER BY tablename;

COMMIT;

-- ============================================
-- 実行完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ RLSポリシーの修正が完了しました';
  RAISE NOTICE '';
  RAISE NOTICE '修正内容:';
  RAISE NOTICE '1. players - 自分のデータのみアクセス可能';
  RAISE NOTICE '2. games - 参加しているゲームのみアクセス可能';
  RAISE NOTICE '3. game_rooms - waiting状態は全員閲覧可、管理はホストのみ';
  RAISE NOTICE '4. game_results - 自分が参加した結果のみ閲覧可能';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ アプリケーションの動作確認を行ってください';
END $$;
