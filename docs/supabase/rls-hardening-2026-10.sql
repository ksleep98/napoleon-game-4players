-- ============================================
-- RLS 強化（2026-10）
-- ============================================
-- 対象: 本番・開発の両方。どちらで流しても安全なように、存在しない関数や
--       ポリシーは自動で飛ばす。全体を 1 トランザクションで実行する。
--
-- 実行順（2 段階）:
--   A. 今すぐ流してよい（アプリの動作に依存しない）: このファイルの BEGIN〜COMMIT
--   B. setPlayerSession を削除したコードが本番にデプロイされた後に流す:
--      末尾の「B」ブロック（set_config の剥奪 → API 接続の張り直し）
--      先に set_config を剥奪すると、旧コードは本番で permission denied を例外にして
--      プレイヤー初期化が失敗する（src/hooks/useSupabase.ts の旧 setPlayerSession 呼び出し）。
--
-- 何を直すか（2026-10-26 に pg_policies / pg_proc の実物を確認）:
--   1. anon が実行できる SECURITY DEFINER 関数を、アプリが使うものだけに絞る
--   2. is_service_role_authenticated() を JWT の role 判定だけにする
--   3. 【開発のみ】誰でも通すポリシー（USING (true) 等）を削除し、本番に揃える
--
-- アプリの書き込みはすべて Server Actions の supabaseAdmin（service_role）経由なので、
-- 以下で anon / authenticated から外す権限をアプリは使っていない。
-- ============================================

BEGIN;

-- --------------------------------------------
-- 1. 危険な関数の実行権限を anon / authenticated から外す（set_config は B で行う）
-- --------------------------------------------
DO $do$
DECLARE
  fn text;
  -- service_role からのみ使う、またはアプリから使わない関数
  fns text[] := ARRAY[
    'public.increment_player_count(text)',
    'public.decrement_player_count(text)',
    'public.cleanup_old_training_data(integer)',
    'public.remove_duplicate_training_data()',
    -- 旧ポリシー用のデバッグ関数。現行ポリシーからは参照されていない
    -- （参照されている get_current_player_id / is_player_in_game / is_player_in_session は
    --   ポリシー評価に必要なので anon の実行権限を残す）
    'public.debug_rls_check(jsonb)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    IF to_regprocedure(fn) IS NULL THEN
      RAISE NOTICE 'skip (not found): %', fn;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    -- 所有者以外が REVOKE すると WARNING だけで何も外れないことがある。
    -- 外れていなければトランザクションごと巻き戻す
    IF has_function_privilege('anon', fn::regprocedure, 'EXECUTE')
       OR has_function_privilege('authenticated', fn::regprocedure, 'EXECUTE') THEN
      RAISE EXCEPTION 'REVOKE did not take effect for % (owner: %)',
        fn, (SELECT proowner::regrole FROM pg_proc WHERE oid = fn::regprocedure);
    END IF;
    RAISE NOTICE 'revoked from anon/authenticated: %', fn;
  END LOOP;

  -- Server Actions（gameActions.ts）が supabaseAdmin.rpc で呼ぶものは service_role に残す
  FOREACH fn IN ARRAY ARRAY[
    'public.increment_player_count(text)',
    'public.decrement_player_count(text)'
  ] LOOP
    IF to_regprocedure(fn) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
    END IF;
  END LOOP;
END $do$;

-- --------------------------------------------
-- 2. service_role 判定を JWT の role だけに絞る
-- --------------------------------------------
-- request.jwt.claims は PostgREST が検証済みの JWT から毎リクエスト設定する値。
-- リクエストヘッダは検証されない値なので判定に使わない。service_role は BYPASSRLS
-- なので、ポリシー評価はこの関数に依存しない。SECURITY DEFINER も不要なので外す。
CREATE OR REPLACE FUNCTION public.is_service_role_authenticated()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role';
$fn$;

-- --------------------------------------------
-- 3. 誰でも通すポリシーを削除する（本番には無いので開発でのみ効く）
-- --------------------------------------------
DO $do$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        -- 全ゲーム状態（全員の手札）を anon に見せていた（FOR ALL の形も含める）
        (tablename = 'games' AND cmd IN ('SELECT', 'ALL') AND qual = 'true')
        -- 学習データの捏造・改ざんを許していた（書き込みは service_role のみ）
        OR (tablename = 'ml_training_data' AND cmd IN ('INSERT', 'UPDATE')
            AND (coalesce(qual, 'true') = 'true' AND coalesce(with_check, 'true') = 'true'))
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
    RAISE NOTICE 'dropped policy % on % (%)', p.policyname, p.tablename, p.cmd;
  END LOOP;

  -- 関数呼び出しを含まない（= 誰でも通しうる）ポリシーが残っていれば人の目で確認する。
  -- ml_training_data の SELECT true と DELETE false は意図どおりなので除外
  FOR p IN
    SELECT tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND coalesce(qual, '') NOT LIKE '%(%' AND coalesce(with_check, '') NOT LIKE '%(%'
      AND NOT (tablename = 'ml_training_data' AND cmd IN ('SELECT', 'DELETE'))
  LOOP
    RAISE WARNING 'review policy % on % (%): using=% check=%',
      p.policyname, p.tablename, p.cmd, p.qual, p.with_check;
  END LOOP;
END $do$;

COMMIT;

-- ============================================
-- B. コードのデプロイ後に流す: set_config の剥奪 → API 接続の張り直し
-- ============================================
-- B-1（これだけ選択して実行）
-- REVOKE EXECUTE ON FUNCTION public.set_config(text, text, boolean) FROM PUBLIC, anon, authenticated;
--
-- B-2（B-1 の後、単独で実行）
-- セッション単位の設定値は接続が閉じるまで残るので、API 用の接続を張り直させる。
-- permission denied になる場合は Dashboard > Project Settings > General >
-- Restart project で代替する（数十秒 API が止まる）。
-- select pg_terminate_backend(pid)
-- from pg_stat_activity
-- where usename = 'authenticator' and pid <> pg_backend_pid();

-- ============================================
-- 4. 確認（実行後にそれぞれ単独で流す。SQL Editor は最後の文の結果しか出さない）
-- ============================================

-- 4-1. anon が実行できる危険な関数が残っていないこと（B の後は 0 行。A だけなら set_config の 1 行）
-- select p.proname
-- from pg_proc p join pg_namespace n on n.oid = p.pronamespace
-- where n.nspname = 'public'
--   and p.proname in ('set_config', 'increment_player_count', 'decrement_player_count',
--                     'cleanup_old_training_data', 'remove_duplicate_training_data',
--                     'debug_rls_check')
--   and (has_function_privilege('anon', p.oid, 'EXECUTE')
--        or has_function_privilege('authenticated', p.oid, 'EXECUTE'));

-- 4-2. anon から games が見えないこと（0 になる。巻き戻すので何も変えない）
-- begin; set local role anon; select count(*) as games_visible_to_anon from games; rollback;

-- 4-3. anon が set_config を呼べないこと（B の後。permission denied になれば成功）
-- begin; set local role anon; select public.set_config('app.player_id', 'x', true); rollback;

-- 4-4. 学習データの読み取りは anon に残っていること（Space が使う。開発のみ。1 以上になる）
-- begin; set local role anon; select count(*) from ml_training_data; rollback;
