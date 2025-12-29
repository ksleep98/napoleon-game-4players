-- ============================================
-- セキュリティ修正: health_check関数のsearch_path設定
-- ============================================
-- 目的: Function Search Path Mutable警告を解消
-- 実行場所: Supabase Dashboard > SQL Editor
-- 対象環境: 開発環境・本番環境の両方で実行
-- ============================================

-- health_check関数を再作成（search_path設定を追加）
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
  -- シンプルに"OK"を返す
  -- データベース接続が確立されていれば成功
  RETURN 'OK';
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 公開アクセスを許可（既に設定済みだが念のため再実行）
GRANT EXECUTE ON FUNCTION health_check() TO anon;
GRANT EXECUTE ON FUNCTION health_check() TO authenticated;
GRANT EXECUTE ON FUNCTION health_check() TO service_role;

-- ============================================
-- 確認
-- ============================================

-- 関数定義を確認
SELECT pg_get_functiondef('health_check'::regproc);

-- 期待される結果: SET search_path が含まれていることを確認

-- 動作確認
SELECT health_check();
-- 期待される結果: "OK"

-- ============================================
-- 完了メッセージ
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ health_check関数のsearch_path設定完了';
  RAISE NOTICE '📋 Security Advisorで警告が消えたことを確認してください';
END $$;
