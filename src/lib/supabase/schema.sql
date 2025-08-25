-- Supabaseで実行するSQL
-- Napoleon Game用のテーブル構成

-- ゲームルームテーブル
CREATE TABLE IF NOT EXISTS game_rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    player_count INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 4,
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'playing', 'finished')),
    host_player_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- プレイヤーテーブル
CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    game_id TEXT DEFAULT NULL,
    room_id TEXT DEFAULT NULL,
    connected BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (room_id) REFERENCES game_rooms(id) ON DELETE SET NULL
);

-- ゲーム状態テーブル
CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    state JSONB NOT NULL, -- ゲームの状態全体をJSONで保存
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    phase TEXT NOT NULL CHECK (phase IN ('setup', 'dealing', 'napoleon', 'adjutant', 'playing', 'finished')),
    winner_team TEXT DEFAULT NULL CHECK (winner_team IN ('napoleon', 'citizen') OR winner_team IS NULL)
);

-- ゲーム結果テーブル
CREATE TABLE IF NOT EXISTS game_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_id TEXT NOT NULL,
    napoleon_won BOOLEAN NOT NULL,
    napoleon_player_id TEXT NOT NULL,
    adjutant_player_id TEXT DEFAULT NULL,
    tricks_won INTEGER NOT NULL,
    scores JSONB NOT NULL, -- PlayerScore[] をJSONで保存
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);

-- インデックスの作成
CREATE INDEX IF NOT EXISTS idx_game_rooms_status ON game_rooms(status);
CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
CREATE INDEX IF NOT EXISTS idx_players_game_id ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_games_phase ON games(phase);
CREATE INDEX IF NOT EXISTS idx_game_results_game_id ON game_results(game_id);

-- プレイヤー数をインクリメントする関数
CREATE OR REPLACE FUNCTION increment_player_count(room_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE game_rooms 
    SET player_count = player_count + 1 
    WHERE id = room_id;
END;
$$ LANGUAGE plpgsql;

-- プレイヤー数をデクリメントする関数  
CREATE OR REPLACE FUNCTION decrement_player_count(room_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE game_rooms 
    SET player_count = GREATEST(0, player_count - 1)
    WHERE id = room_id;
END;
$$ LANGUAGE plpgsql;

-- ゲームの更新時刻を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_games_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER games_updated_at_trigger
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_games_updated_at();

-- Realtime設定（リアルタイム更新のため）
ALTER PUBLICATION supabase_realtime ADD TABLE game_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE players;  
ALTER PUBLICATION supabase_realtime ADD TABLE games;
ALTER PUBLICATION supabase_realtime ADD TABLE game_results;

-- Row Level Security (RLS) の設定
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- セキュアなRLSポリシー
-- ゲームルーム: 全員が読み取り可能、作成可能
CREATE POLICY "Anyone can view game rooms" ON game_rooms FOR SELECT USING (true);
CREATE POLICY "Anyone can create game rooms" ON game_rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Host can update own room" ON game_rooms FOR UPDATE USING (host_player_id = current_setting('app.player_id', true));

-- プレイヤー: 全員が読み取り可能、自分のレコードのみ更新可能
CREATE POLICY "Anyone can view players" ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can create player" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Players can update own record" ON players FOR UPDATE USING (id = current_setting('app.player_id', true));

-- ゲーム: ゲーム参加者のみアクセス可能
CREATE POLICY "Game participants can view games" ON games FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM players p 
    WHERE p.game_id = games.id 
    AND p.id = current_setting('app.player_id', true)
  )
);
CREATE POLICY "Anyone can create games" ON games FOR INSERT WITH CHECK (true);
CREATE POLICY "Game participants can update games" ON games FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM players p 
    WHERE p.game_id = games.id 
    AND p.id = current_setting('app.player_id', true)
  )
);

-- ゲーム結果: 参加者のみ閲覧可能
CREATE POLICY "Game participants can view results" ON game_results FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM players p 
    WHERE p.game_id = game_results.game_id 
    AND p.id = current_setting('app.player_id', true)
  )
);
CREATE POLICY "Anyone can create results" ON game_results FOR INSERT WITH CHECK (true);

-- セッション設定用の関数（RLSポリシーで使用）
CREATE OR REPLACE FUNCTION set_config(setting_name TEXT, setting_value TEXT, is_local BOOLEAN DEFAULT FALSE)
RETURNS TEXT AS $$
BEGIN
  PERFORM pg_catalog.set_config(setting_name, setting_value, is_local);
  RETURN setting_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 開発環境用：RLSを無効化（本番では削除）
-- ALTER TABLE games DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_rooms DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE players DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE game_results DISABLE ROW LEVEL SECURITY;

-- 環境変数設定のヒント
-- NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key