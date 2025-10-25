-- ============================================
-- Supabase Keep-Alive用 health_check 関数
-- ============================================
-- 目的: RLSの影響を受けないヘルスチェックエンドポイント
-- 実行場所: Supabase Dashboard > SQL Editor
-- 対象環境: 開発環境・本番環境の両方で実行
-- ============================================

-- ヘルスチェック関数を作成
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
  -- シンプルに"OK"を返す
  -- データベース接続が確立されていれば成功
  RETURN 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 公開アクセスを許可（RLS関係なくアクセス可能）
GRANT EXECUTE ON FUNCTION health_check() TO anon;
GRANT EXECUTE ON FUNCTION health_check() TO authenticated;
GRANT EXECUTE ON FUNCTION health_check() TO service_role;

-- ============================================
-- 動作確認
-- ============================================

-- ローカルでテスト（SQLエディタで実行）
SELECT health_check();
-- 期待される結果: "OK"

-- ============================================
-- REST APIでのテスト方法
-- ============================================

-- curlでテスト（ターミナルで実行）
-- curl -H "apikey: YOUR_ANON_KEY" \
--   -H "Authorization: Bearer YOUR_ANON_KEY" \
--   "YOUR_SUPABASE_URL/rest/v1/rpc/health_check"
--
-- 期待される結果: "OK"
-- HTTPステータス: 200

-- ============================================
-- 関数の確認
-- ============================================

SELECT
  routine_name,
  routine_type,
  security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name = 'health_check';

-- 期待される結果:
-- routine_name | routine_type | security_type
-- health_check | FUNCTION     | DEFINER
