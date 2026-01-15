-- ============================================
-- Room Player Count Management Functions
-- ============================================
-- 目的: ゲームルームのプレイヤー数を安全に増減する
-- 実行場所: Supabase Dashboard > SQL Editor
-- 対象環境: 開発環境・本番環境の両方で実行
-- ============================================

-- プレイヤー数を増やす関数
CREATE OR REPLACE FUNCTION increment_player_count(room_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = player_count + 1
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- プレイヤー数を減らす関数
CREATE OR REPLACE FUNCTION decrement_player_count(room_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = GREATEST(player_count - 1, 0)
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- 関数にアクセス権限を付与
GRANT EXECUTE ON FUNCTION increment_player_count(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION decrement_player_count(TEXT) TO service_role;

-- ============================================
-- 動作確認
-- ============================================

-- 関数の存在確認
SELECT routine_name, routine_type, security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('increment_player_count', 'decrement_player_count');

-- 期待される結果:
-- increment_player_count | FUNCTION | DEFINER
-- decrement_player_count | FUNCTION | DEFINER
