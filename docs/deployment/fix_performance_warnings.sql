-- ============================================
-- パフォーマンス警告修正: game_sessions RLS ポリシー最適化
-- ============================================
-- 目的: Performance Advisor警告を解消
-- 実行場所: Supabase Dashboard > SQL Editor（本番環境）
-- 作成日: 2025-12-18
-- ============================================
-- 修正内容:
-- 1. Auth RLS Initialization Plan 修正: auth.uid() を (select auth.uid()) に変更
-- 2. Multiple Permissive Policies 修正: ポリシーを再構成して重複を解消
-- ============================================

-- 既存のポリシーを削除
DROP POLICY IF EXISTS "Anyone can create game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Session participants can access sessions" ON public.game_sessions;

-- ============================================
-- 最適化されたポリシー
-- ============================================

-- 1. INSERT専用ポリシー: 誰でもゲームセッション作成可能
CREATE POLICY "Anyone can create game sessions"
ON public.game_sessions
FOR INSERT
TO public
WITH CHECK (true);

-- 2. SELECT/UPDATE/DELETE専用ポリシー: 認証ユーザーのみアクセス可能
-- auth.uid() を (select auth.uid()) にラップしてInitPlan警告を解消
CREATE POLICY "Authenticated users can access sessions"
ON public.game_sessions
FOR SELECT
TO public
USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can update sessions"
ON public.game_sessions
FOR UPDATE
TO public
USING ((select auth.uid()) IS NOT NULL)
WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated users can delete sessions"
ON public.game_sessions
FOR DELETE
TO public
USING ((select auth.uid()) IS NOT NULL);

-- ============================================
-- 確認クエリ
-- ============================================

-- 更新されたポリシーを確認
SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'game_sessions'
ORDER BY cmd, policyname;

-- 期待される結果:
-- 1. "Anyone can create game sessions" - INSERT専用
-- 2. "Authenticated users can delete sessions" - DELETE専用
-- 3. "Authenticated users can access sessions" - SELECT専用
-- 4. "Authenticated users can update sessions" - UPDATE専用
-- 全て (select auth.uid()) 形式を使用

-- Performance Advisorで警告を再確認
-- https://supabase.com/dashboard/project/YOUR_PROJECT/advisors/performance

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ RLSポリシー最適化完了';
  RAISE NOTICE '📋 修正内容:';
  RAISE NOTICE '  1. auth.uid() を (select auth.uid()) に変更 → InitPlan警告解消';
  RAISE NOTICE '  2. INSERT専用ポリシーとSELECT/UPDATE/DELETE専用ポリシーに分離 → Multiple Policies警告解消';
  RAISE NOTICE '🔍 Performance Advisorで警告が消えたことを確認してください';
END $$;
