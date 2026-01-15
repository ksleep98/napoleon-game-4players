-- ============================================
-- 🔒 本番環境 Supabase Security Advisor Warnings 修正スクリプト
-- ============================================
-- 実行日: 2026-01-09
-- 目的: 本番環境のSecurity Advisorで検出された警告を修正
--       - public.game_results
--       - public.game_rooms
--       - public.game_sessions (本番環境のみ)
--       - public.games
--       - public.players
--
-- 問題: USING (true) や WITH CHECK (true) による過度に寛容なポリシー
-- 解決: 適切な認証・認可チェックを実装
--
-- ⚠️ 警告: このスクリプトは本番データベースに直接影響します
-- ⚠️ 実行前に必ずバックアップを取得してください
--
-- 実行方法:
-- 1. Supabase Production Dashboard > SQL Editor を開く
-- 2. このスクリプト全体をコピー&ペースト
-- 3. "Run" をクリック
-- ============================================

BEGIN;

-- ============================================
-- 0. 全ての既存ポリシーを削除（クリーンアップ）
-- ============================================

-- game_results の全ポリシーを削除
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'game_results'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON game_results', pol.policyname);
  END LOOP;
END $$;

-- game_rooms の全ポリシーを削除
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'game_rooms'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON game_rooms', pol.policyname);
  END LOOP;
END $$;

-- game_sessions の全ポリシーを削除
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'game_sessions'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON game_sessions', pol.policyname);
  END LOOP;
END $$;

-- games の全ポリシーを削除
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'games'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON games', pol.policyname);
  END LOOP;
END $$;

-- players の全ポリシーを削除
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'players'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON players', pol.policyname);
  END LOOP;
END $$;

-- ============================================
-- 1. 必要な関数を作成/更新
-- ============================================

-- プレイヤーIDを取得する関数
CREATE OR REPLACE FUNCTION get_current_player_id()
RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.player_id', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ゲーム参加チェック関数（players配列からプレイヤーIDを検索）
CREATE OR REPLACE FUNCTION is_player_in_game(game_state JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  current_player_id TEXT;
  player_found BOOLEAN;
BEGIN
  current_player_id := get_current_player_id();

  -- Service Roleの場合は常に許可
  IF is_service_role_authenticated() THEN
    RETURN true;
  END IF;

  -- プレイヤーIDが設定されていない場合は拒否
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ゲームセッション参加チェック関数（players配列からプレイヤーIDを検索）
CREATE OR REPLACE FUNCTION is_player_in_session(players_array JSONB)
RETURNS BOOLEAN AS $$
DECLARE
  current_player_id TEXT;
  player_found BOOLEAN;
BEGIN
  current_player_id := get_current_player_id();

  -- Service Roleの場合は常に許可
  IF is_service_role_authenticated() THEN
    RETURN true;
  END IF;

  -- プレイヤーIDが設定されていない場合は拒否
  IF current_player_id IS NULL THEN
    RETURN false;
  END IF;

  -- JSON配列内でプレイヤーIDを検索（文字列配列の場合）
  SELECT EXISTS (
    SELECT 1
    FROM jsonb_array_elements_text(players_array) AS player_id
    WHERE player_id = current_player_id
  ) INTO player_found;

  RETURN player_found;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- ============================================
-- 2. 🔒 game_results テーブル - セキュアなポリシーに置き換え
-- ============================================

-- SELECT: 自分が参加したゲームの結果のみ閲覧可能
-- 本番環境スキーマ: player_scores, winner_id を使用
CREATE POLICY "game_results_select_policy" ON game_results
  FOR SELECT USING (
    is_service_role_authenticated()
    OR (
      get_current_player_id() IS NOT NULL
      AND (
        -- player_scoresに自分のIDが含まれているか確認
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(player_scores) AS score
          WHERE score->>'playerId' = get_current_player_id()
        )
        -- またはwinner_idが自分か確認
        OR winner_id = get_current_player_id()
      )
    )
  );

-- INSERT: Service Roleのみ（Server Actions経由のみ許可）
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
-- 3. 🔒 game_rooms テーブル - セキュアなポリシーに置き換え
-- ============================================

-- SELECT: 待機中のルームは全員閲覧可能、それ以外はホストのみ
CREATE POLICY "game_rooms_select_policy" ON game_rooms
  FOR SELECT USING (
    is_service_role_authenticated()
    OR status = 'waiting'
    OR (get_current_player_id() IS NOT NULL AND host_player_id = get_current_player_id())
  );

-- INSERT: 認証済みユーザーのみ（自分がホストのルームのみ作成可能）
CREATE POLICY "game_rooms_insert_policy" ON game_rooms
  FOR INSERT WITH CHECK (
    is_service_role_authenticated()
    OR (get_current_player_id() IS NOT NULL AND host_player_id = get_current_player_id())
  );

-- UPDATE: ホストまたはService Roleのみ
CREATE POLICY "game_rooms_update_policy" ON game_rooms
  FOR UPDATE USING (
    is_service_role_authenticated()
    OR (get_current_player_id() IS NOT NULL AND host_player_id = get_current_player_id())
  );

-- DELETE: ホストまたはService Roleのみ
CREATE POLICY "game_rooms_delete_policy" ON game_rooms
  FOR DELETE USING (
    is_service_role_authenticated()
    OR (get_current_player_id() IS NOT NULL AND host_player_id = get_current_player_id())
  );

-- ============================================
-- 4. 🔒 game_sessions テーブル - セキュアなポリシーに置き換え
-- ============================================

-- SELECT: 自分が参加しているセッションのみ閲覧可能
CREATE POLICY "game_sessions_select_policy" ON game_sessions
  FOR SELECT USING (
    is_service_role_authenticated()
    OR is_player_in_session(players)
  );

-- INSERT: 自分が参加しているセッションのみ作成可能
CREATE POLICY "game_sessions_insert_policy" ON game_sessions
  FOR INSERT WITH CHECK (
    is_service_role_authenticated()
    OR is_player_in_session(players)
  );

-- UPDATE: 自分が参加しているセッションのみ更新可能
CREATE POLICY "game_sessions_update_policy" ON game_sessions
  FOR UPDATE USING (
    is_service_role_authenticated()
    OR is_player_in_session(players)
  );

-- DELETE: Service Roleのみ
CREATE POLICY "game_sessions_delete_policy" ON game_sessions
  FOR DELETE USING (
    is_service_role_authenticated()
  );

-- ============================================
-- 5. 🔒 games テーブル - セキュアなポリシーに置き換え
-- ============================================

-- SELECT: 自分が参加しているゲームのみ閲覧可能
CREATE POLICY "games_select_policy" ON games
  FOR SELECT USING (
    is_service_role_authenticated()
    OR is_player_in_game(state)
  );

-- INSERT: 自分が参加しているゲームのみ作成可能
CREATE POLICY "games_insert_policy" ON games
  FOR INSERT WITH CHECK (
    is_service_role_authenticated()
    OR is_player_in_game(state)
  );

-- UPDATE: 自分が参加しているゲームのみ更新可能
CREATE POLICY "games_update_policy" ON games
  FOR UPDATE USING (
    is_service_role_authenticated()
    OR is_player_in_game(state)
  );

-- DELETE: Service Roleのみ
CREATE POLICY "games_delete_policy" ON games
  FOR DELETE USING (
    is_service_role_authenticated()
  );

-- ============================================
-- 6. 🔒 players テーブル - セキュアなポリシーに置き換え
-- ============================================

-- SELECT: 自分のデータのみ閲覧可能
CREATE POLICY "players_select_policy" ON players
  FOR SELECT USING (
    is_service_role_authenticated()
    OR (get_current_player_id() IS NOT NULL AND id = get_current_player_id())
  );

-- INSERT: 自分のデータのみ作成可能またはService Role
CREATE POLICY "players_insert_policy" ON players
  FOR INSERT WITH CHECK (
    is_service_role_authenticated()
    OR (get_current_player_id() IS NOT NULL AND id = get_current_player_id())
  );

-- UPDATE: 自分のデータのみ更新可能
CREATE POLICY "players_update_policy" ON players
  FOR UPDATE USING (
    is_service_role_authenticated()
    OR (get_current_player_id() IS NOT NULL AND id = get_current_player_id())
  );

-- DELETE: Service Roleのみ
CREATE POLICY "players_delete_policy" ON players
  FOR DELETE USING (
    is_service_role_authenticated()
  );

-- ============================================
-- 7. RLSが有効になっていることを確認
-- ============================================

ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. 確認クエリ（実行結果を確認）
-- ============================================

-- 適用されたポリシーを確認
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  CASE
    WHEN qual LIKE '%true%' AND qual NOT LIKE '%is_service_role%' THEN '⚠️ POTENTIAL ISSUE'
    WHEN with_check LIKE '%true%' AND with_check NOT LIKE '%is_service_role%' THEN '⚠️ POTENTIAL ISSUE'
    WHEN qual IS NULL THEN 'N/A'
    ELSE '✅ SECURE'
  END as security_status,
  left(COALESCE(qual, with_check, 'N/A'), 80) as policy_snippet
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('players', 'games', 'game_rooms', 'game_sessions', 'game_results')
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
  AND tablename IN ('players', 'games', 'game_rooms', 'game_sessions', 'game_results')
ORDER BY tablename;

COMMIT;

-- ============================================
-- 実行完了メッセージ
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '✅ 本番環境 RLSセキュリティ警告の修正が完了しました';
  RAISE NOTICE '✅ ========================================';
  RAISE NOTICE '';
  RAISE NOTICE '修正内容:';
  RAISE NOTICE '  1. game_results - Service Roleのみ作成可、参加者のみ閲覧可';
  RAISE NOTICE '  2. game_rooms - waiting状態は全員閲覧可、管理はホストのみ';
  RAISE NOTICE '  3. game_sessions - 参加者のみアクセス可能';
  RAISE NOTICE '  4. games - 参加しているゲームのみアクセス可能';
  RAISE NOTICE '  5. players - 自分のデータのみアクセス可能';
  RAISE NOTICE '';
  RAISE NOTICE 'セキュリティ改善:';
  RAISE NOTICE '  ❌ 修正前: WITH CHECK (true) - 無制限アクセス';
  RAISE NOTICE '  ✅ 修正後: 適切な認証・認可チェック実装';
  RAISE NOTICE '';
  RAISE NOTICE '次のステップ:';
  RAISE NOTICE '  1. 上記の確認クエリ結果を確認';
  RAISE NOTICE '  2. Security Advisorで警告が消えたか確認';
  RAISE NOTICE '  3. 本番アプリケーションの動作確認を実施';
  RAISE NOTICE '';
END $$;
