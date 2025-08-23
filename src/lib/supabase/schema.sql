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

-- Row Level Security (RLS) の設定
ALTER TABLE game_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;

-- 基本的なポリシー（全員がread/writeできる - 本番環境では調整が必要）
CREATE POLICY "Allow all operations on game_rooms" ON game_rooms FOR ALL USING (true);
CREATE POLICY "Allow all operations on players" ON players FOR ALL USING (true);  
CREATE POLICY "Allow all operations on games" ON games FOR ALL USING (true);
CREATE POLICY "Allow all operations on game_results" ON game_results FOR ALL USING (true);

-- 環境変数設定のヒント
-- NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
-- NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key