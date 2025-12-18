-- ============================================
-- セキュリティ修正: 最後の2関数を確実に修正
-- ============================================
-- 対象: increment_player_count, decrement_player_count
-- 実行場所: Supabase Dashboard > SQL Editor（開発環境）
-- 作成日: 2025-12-17
-- ============================================
-- 問題: 各関数にTEXT版とUUID版の2つのバージョンが存在
--       UUID版は正しく設定済み、TEXT版に警告あり
-- 解決策: 古いTEXT版を削除、UUID版のみを残す
-- ============================================

-- 古いTEXT引数版の関数を削除（UUID版は既に正しく設定済み）
DROP FUNCTION IF EXISTS public.increment_player_count(text);
DROP FUNCTION IF EXISTS public.decrement_player_count(text);

-- 確認: UUID版のみが残っていることを確認
SELECT
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS arguments,
    CASE
        WHEN pg_get_functiondef(p.oid) LIKE '%search_path%' THEN 'YES ✅'
        ELSE 'NO ❌'
    END AS has_search_path,
    CASE
        WHEN pg_get_functiondef(p.oid) LIKE '%SECURITY DEFINER%' THEN 'YES ✅'
        ELSE 'NO ❌'
    END AS has_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN ('increment_player_count', 'decrement_player_count')
ORDER BY p.proname;

-- 期待される結果:
-- 両関数ともUUID版のみが表示される
-- arguments = 'room_id uuid'
-- has_search_path = 'YES ✅'
-- has_security_definer = 'YES ✅'

-- 完了メッセージ
DO $$
BEGIN
  RAISE NOTICE '✅ 関数修正完了: 古いTEXT版を削除、UUID版のみ残存';
  RAISE NOTICE '📋 Security Advisorで警告が消えたことを確認してください';
  RAISE NOTICE '⚠️  残りの警告: PostgreSQL version セキュリティパッチ（メンテナンスウィンドウで対応推奨）';
END $$;
