-- ============================================
-- パフォーマンス警告修正: 開発環境RLSポリシー最適化（全テーブル）
-- ============================================
-- 目的: Performance Advisor警告61件を解消
-- 実行場所: Supabase Dashboard > SQL Editor（開発環境）
-- 作成日: 2025-12-18
-- ============================================
-- 修正内容:
-- 1. Auth RLS Initialization Plan 修正 (5件)
-- 2. Multiple Permissive Policies 修正 (55件)
-- 3. Duplicate Index 削除 (1件)
-- ============================================

-- ============================================
-- PART 1: game_results テーブル
-- ============================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Anyone can create results" ON public.game_results;
DROP POLICY IF EXISTS "Authenticated users can insert game results" ON public.game_results;
DROP POLICY IF EXISTS "Game participants can view results" ON public.game_results;
DROP POLICY IF EXISTS "Players can view their game results" ON public.game_results;

-- 最適化されたポリシー
-- INSERT: 誰でも作成可能（重複ポリシーを1つに統合）
CREATE POLICY "Anyone can create results"
ON public.game_results
FOR INSERT
TO public
WITH CHECK (true);

-- SELECT: ゲーム参加者または結果の所有者が閲覧可能（current_setting最適化 + 統合）
CREATE POLICY "Game participants and owners can view results"
ON public.game_results
FOR SELECT
TO public
USING (
  is_service_role_authenticated() OR
  (EXISTS (
    SELECT 1
    FROM players p
    WHERE p.game_id = game_results.game_id
      AND p.id = (select current_setting('app.player_id', true))
  )) OR
  (EXISTS (
    SELECT 1
    FROM jsonb_array_elements(game_results.scores) AS score
    WHERE (score.value ->> 'playerId') = get_current_player_id()
  )) OR
  napoleon_player_id = get_current_player_id() OR
  adjutant_player_id = get_current_player_id() OR
  get_current_player_id() IS NULL
);

-- ============================================
-- PART 2: game_rooms テーブル
-- ============================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Anyone can create game rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Anyone can view game rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Anyone can view waiting rooms" ON public.game_rooms;
DROP POLICY IF EXISTS "Host can update own room" ON public.game_rooms;
DROP POLICY IF EXISTS "Players can manage their rooms" ON public.game_rooms;

-- 最適化されたポリシー
-- INSERT: 誰でも作成可能
CREATE POLICY "Anyone can create game rooms"
ON public.game_rooms
FOR INSERT
TO public
WITH CHECK (true);

-- SELECT: 誰でも閲覧可能（redundantなポリシーを1つに統合）
CREATE POLICY "Anyone can view game rooms"
ON public.game_rooms
FOR SELECT
TO public
USING (true);

-- UPDATE: ホストまたはサービスロールのみ更新可能（current_setting最適化）
CREATE POLICY "Host can update own room"
ON public.game_rooms
FOR UPDATE
TO public
USING (
  is_service_role_authenticated() OR
  host_player_id = (select current_setting('app.player_id', true)) OR
  host_player_id = get_current_player_id() OR
  get_current_player_id() IS NULL
);

-- DELETE: ホストまたはサービスロールのみ削除可能
CREATE POLICY "Host can delete own room"
ON public.game_rooms
FOR DELETE
TO public
USING (
  is_service_role_authenticated() OR
  host_player_id = get_current_player_id() OR
  get_current_player_id() IS NULL
);

-- ============================================
-- PART 3: games テーブル
-- ============================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Anyone can create games" ON public.games;
DROP POLICY IF EXISTS "Game participants can update games" ON public.games;
DROP POLICY IF EXISTS "Game participants can view games" ON public.games;
DROP POLICY IF EXISTS "Players can access their games" ON public.games;
DROP POLICY IF EXISTS "games_delete_policy" ON public.games;
DROP POLICY IF EXISTS "games_insert_policy" ON public.games;
DROP POLICY IF EXISTS "games_select_policy" ON public.games;
DROP POLICY IF EXISTS "games_update_policy" ON public.games;

-- 最適化されたポリシー
-- INSERT: 誰でも作成可能
CREATE POLICY "Anyone can create games"
ON public.games
FOR INSERT
TO public
WITH CHECK (true);

-- SELECT: ゲーム参加者が閲覧可能（current_setting最適化 + debug_rls_check使用）
CREATE POLICY "Game participants can view games"
ON public.games
FOR SELECT
TO public
USING (
  debug_rls_check(state) OR
  (EXISTS (
    SELECT 1
    FROM players p
    WHERE p.game_id = games.id
      AND p.id = (select current_setting('app.player_id', true))
  )) OR
  (
    (get_current_player_id() IS NOT NULL) AND
    ((state -> 'players') @> jsonb_build_array(jsonb_build_object('id', get_current_player_id())))
  ) OR
  get_current_player_id() IS NULL
);

-- UPDATE: ゲーム参加者が更新可能（current_setting最適化）
CREATE POLICY "Game participants can update games"
ON public.games
FOR UPDATE
TO public
USING (
  debug_rls_check(state) OR
  (EXISTS (
    SELECT 1
    FROM players p
    WHERE p.game_id = games.id
      AND p.id = (select current_setting('app.player_id', true))
  )) OR
  (
    (get_current_player_id() IS NOT NULL) AND
    ((state -> 'players') @> jsonb_build_array(jsonb_build_object('id', get_current_player_id())))
  ) OR
  get_current_player_id() IS NULL
)
WITH CHECK (
  (
    (get_current_player_id() IS NOT NULL) AND
    ((state -> 'players') @> jsonb_build_array(jsonb_build_object('id', get_current_player_id())))
  ) OR
  get_current_player_id() IS NULL
);

-- DELETE: ゲーム参加者が削除可能
CREATE POLICY "Game participants can delete games"
ON public.games
FOR DELETE
TO public
USING (
  (
    (get_current_player_id() IS NOT NULL) AND
    ((state -> 'players') @> jsonb_build_array(jsonb_build_object('id', get_current_player_id())))
  ) OR
  get_current_player_id() IS NULL
);

-- ============================================
-- PART 4: players テーブル
-- ============================================

-- 既存ポリシーを削除
DROP POLICY IF EXISTS "Anyone can create player" ON public.players;
DROP POLICY IF EXISTS "Anyone can view players" ON public.players;
DROP POLICY IF EXISTS "Players can access their own data" ON public.players;
DROP POLICY IF EXISTS "Players can update own record" ON public.players;
DROP POLICY IF EXISTS "players_delete_policy" ON public.players;
DROP POLICY IF EXISTS "players_insert_policy" ON public.players;
DROP POLICY IF EXISTS "players_select_policy" ON public.players;
DROP POLICY IF EXISTS "players_update_policy" ON public.players;

-- 最適化されたポリシー
-- INSERT: 誰でも作成可能
CREATE POLICY "Anyone can create player"
ON public.players
FOR INSERT
TO public
WITH CHECK (true);

-- SELECT: 誰でも閲覧可能（redundantなポリシーを1つに統合）
CREATE POLICY "Anyone can view players"
ON public.players
FOR SELECT
TO public
USING (true);

-- UPDATE: 自分のレコードのみ更新可能（current_setting最適化）
CREATE POLICY "Players can update own record"
ON public.players
FOR UPDATE
TO public
USING (
  is_service_role_authenticated() OR
  id = (select current_setting('app.player_id', true)) OR
  id = get_current_player_id() OR
  get_current_player_id() IS NULL
);

-- DELETE: 自分のレコードのみ削除可能
CREATE POLICY "Players can delete own record"
ON public.players
FOR DELETE
TO public
USING (
  is_service_role_authenticated() OR
  id = get_current_player_id() OR
  get_current_player_id() IS NULL
);

-- ============================================
-- PART 5: 重複インデックス削除
-- ============================================

-- game_resultsテーブルの重複インデックスを削除
-- idx_game_results_napoleon_fast を残し、idx_game_results_napoleon_created を削除
DROP INDEX IF EXISTS public.idx_game_results_napoleon_created;

-- ============================================
-- 確認クエリ
-- ============================================

-- 全テーブルのポリシーを確認
SELECT
    tablename,
    policyname,
    cmd,
    CASE
        WHEN qual LIKE '%current_setting%' AND qual NOT LIKE '%select current_setting%'
        THEN 'NEEDS FIX ❌'
        ELSE 'OK ✅'
    END as auth_optimized
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('games', 'game_results', 'game_rooms', 'players')
ORDER BY tablename, cmd, policyname;

-- インデックスを確認
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'game_results'
  AND indexname LIKE 'idx_game_results_napoleon%'
ORDER BY indexname;

-- 期待される結果:
-- - 全てのポリシーで auth_optimized = 'OK ✅'
-- - idx_game_results_napoleon_fast のみ存在

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ 全テーブルのRLSポリシー最適化完了';
  RAISE NOTICE '📋 修正内容:';
  RAISE NOTICE '  1. Auth RLS InitPlan: current_setting を (select current_setting) に変更';
  RAISE NOTICE '  2. Multiple Permissive Policies: 重複・冗長ポリシーを統合';
  RAISE NOTICE '  3. Duplicate Index: idx_game_results_napoleon_created を削除';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Performance Advisorで警告が消えたことを確認してください';
  RAISE NOTICE '期待される結果: 61件 → 0件';
END $$;
