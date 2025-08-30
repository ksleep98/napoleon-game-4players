-- Napoleon Game RLS Policies
-- これらのポリシーはSupabaseダッシュボードまたはSQL Editorで実行してください

-- RLSを有効化
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- 設定関数を作成（プレイヤーセッション管理用）
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

-- set_config関数のラッパー（必要に応じて）
CREATE OR REPLACE FUNCTION set_config(setting_name TEXT, setting_value TEXT, is_local BOOLEAN)
RETURNS TEXT AS $$
BEGIN
  PERFORM set_config(setting_name, setting_value, is_local);
  RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ゲームテーブルのRLSポリシー
-- プレイヤーは自分が参加しているゲームのみアクセス可能
DROP POLICY IF EXISTS "Players can access their games" ON games;
CREATE POLICY "Players can access their games" ON games
FOR ALL USING (
  -- ゲーム状態の中にプレイヤーIDが含まれているかチェック
  state->>'players' LIKE '%' || get_current_player_id() || '%'
  OR get_current_player_id() IS NULL -- 開発環境では制限を緩和
);

-- ゲームルームテーブルのRLSポリシー
-- 全てのプレイヤーがルーム一覧を見ることができる（待機中のルームのみ）
DROP POLICY IF EXISTS "Anyone can view waiting rooms" ON game_rooms;
CREATE POLICY "Anyone can view waiting rooms" ON game_rooms
FOR SELECT USING (status = 'waiting');

-- プレイヤーは自分がホストのルームを管理できる
DROP POLICY IF EXISTS "Players can manage their rooms" ON game_rooms;
CREATE POLICY "Players can manage their rooms" ON game_rooms
FOR ALL USING (
  host_player_id = get_current_player_id()
  OR get_current_player_id() IS NULL -- 開発環境では制限を緩和
);

-- プレイヤーテーブルのRLSポリシー
-- プレイヤーは自分の情報のみアクセス可能
DROP POLICY IF EXISTS "Players can access their own data" ON players;
CREATE POLICY "Players can access their own data" ON players
FOR ALL USING (
  id = get_current_player_id()
  OR get_current_player_id() IS NULL -- 開発環境では制限を緩和
);

-- ゲーム結果テーブルのRLSポリシー
-- プレイヤーは自分が参加したゲームの結果のみ閲覧可能
DROP POLICY IF EXISTS "Players can view their game results" ON game_results;
CREATE POLICY "Players can view their game results" ON game_results
FOR SELECT USING (
  -- ゲーム結果のスコアに自分のプレイヤーIDが含まれているかチェック
  EXISTS (
    SELECT 1 FROM jsonb_array_elements(scores) AS score
    WHERE score->>'playerId' = get_current_player_id()
  )
  OR napoleon_player_id = get_current_player_id()
  OR adjutant_player_id = get_current_player_id()
  OR get_current_player_id() IS NULL -- 開発環境では制限を緩和
);

-- ゲーム結果の挿入は制限なし（サーバーアクション経由）
DROP POLICY IF EXISTS "Authenticated users can insert game results" ON game_results;
CREATE POLICY "Authenticated users can insert game results" ON game_results
FOR INSERT WITH CHECK (true);

-- プレイヤー数増加のための関数（ルーム参加時に使用）
CREATE OR REPLACE FUNCTION increment_player_count(room_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE game_rooms 
  SET player_count = player_count + 1, 
      updated_at = NOW()
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ユーティリティ: RLSポリシーの状態確認用ビュー
CREATE OR REPLACE VIEW rls_policy_status AS
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (
    SELECT count(*)
    FROM pg_policies
    WHERE schemaname = n.schemaname
    AND tablename = n.tablename
  ) as policy_count
FROM pg_tables n
WHERE schemaname = 'public'
ORDER BY tablename;

-- 確認クエリ
-- SELECT * FROM rls_policy_status;