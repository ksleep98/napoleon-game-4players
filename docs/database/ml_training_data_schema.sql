-- ========================================
-- Machine Learning Training Data Schema
-- ========================================
-- このテーブルは、Napoleon Gameのプレイデータを収集し、
-- 機械学習モデルの訓練データとして使用します。

-- ML訓練データテーブル
CREATE TABLE IF NOT EXISTS ml_training_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  trick_number INT NOT NULL CHECK (trick_number >= 0 AND trick_number <= 12),

  -- ゲーム状態（特徴量）
  hand JSONB NOT NULL,  -- プレイヤーの手札 (Card[])
  table_cards JSONB NOT NULL,  -- 場に出ているカード (Card[])
  current_suit TEXT,  -- 現在のスート（リードスート）
  trump_suit TEXT,  -- 切り札スート

  -- プレイヤーの行動（ラベル）
  selected_card JSONB NOT NULL,  -- 選択したカード (Card)

  -- ゲームコンテキスト
  game_phase TEXT NOT NULL CHECK (game_phase IN ('playing')),  -- 現在はplayingのみ
  role TEXT NOT NULL CHECK (role IN ('napoleon', 'adjutant', 'allied')),
  is_napoleon_team BOOLEAN NOT NULL,

  -- ゲーム結果（ゲーム終了後に更新）
  game_result TEXT CHECK (game_result IN ('napoleon_win', 'allied_win')),
  player_final_score INT,  -- プレイヤーの最終スコア

  -- メタデータ
  is_ai_player BOOLEAN DEFAULT FALSE,  -- AIプレイヤーかどうか
  ai_difficulty TEXT CHECK (ai_difficulty IN ('easy', 'medium', 'hard')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス作成（クエリ高速化）
CREATE INDEX IF NOT EXISTS idx_ml_training_game_id
  ON ml_training_data(game_id);

CREATE INDEX IF NOT EXISTS idx_ml_training_player_id
  ON ml_training_data(player_id);

CREATE INDEX IF NOT EXISTS idx_ml_training_created_at
  ON ml_training_data(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ml_training_role
  ON ml_training_data(role);

CREATE INDEX IF NOT EXISTS idx_ml_training_game_result
  ON ml_training_data(game_result);

-- 複合インデックス（ゲーム分析用）
CREATE INDEX IF NOT EXISTS idx_ml_training_game_trick
  ON ml_training_data(game_id, trick_number);

-- ========================================
-- 統計用ビュー
-- ========================================

-- データ収集統計ビュー
CREATE OR REPLACE VIEW ml_training_stats
WITH (security_invoker = true) AS
SELECT
  COUNT(*) as total_records,
  COUNT(DISTINCT game_id) as total_games,
  COUNT(DISTINCT player_id) as total_players,
  COUNT(CASE WHEN game_result IS NOT NULL THEN 1 END) as completed_games,
  COUNT(CASE WHEN is_ai_player = TRUE THEN 1 END) as ai_moves,
  COUNT(CASE WHEN is_ai_player = FALSE THEN 1 END) as human_moves,
  MIN(created_at) as first_record,
  MAX(created_at) as last_record
FROM ml_training_data;

-- 役割別統計ビュー
CREATE OR REPLACE VIEW ml_training_role_stats
WITH (security_invoker = true) AS
SELECT
  role,
  game_result,
  COUNT(*) as move_count,
  COUNT(DISTINCT game_id) as game_count,
  ROUND(AVG(player_final_score), 2) as avg_score
FROM ml_training_data
WHERE game_result IS NOT NULL
GROUP BY role, game_result
ORDER BY role, game_result;

-- AI難易度別統計ビュー
CREATE OR REPLACE VIEW ml_training_ai_stats
WITH (security_invoker = true) AS
SELECT
  ai_difficulty,
  COUNT(*) as move_count,
  COUNT(DISTINCT game_id) as game_count,
  COUNT(CASE WHEN game_result = 'napoleon_win' AND is_napoleon_team THEN 1
            WHEN game_result = 'allied_win' AND NOT is_napoleon_team THEN 1 END) as wins,
  COUNT(CASE WHEN game_result IS NOT NULL THEN 1 END) as completed
FROM ml_training_data
WHERE is_ai_player = TRUE AND game_result IS NOT NULL
GROUP BY ai_difficulty
ORDER BY ai_difficulty;

-- ========================================
-- RLS (Row Level Security) ポリシー
-- ========================================

-- RLSを有効化
ALTER TABLE ml_training_data ENABLE ROW LEVEL SECURITY;

-- 全ユーザーが自分のプレイデータを挿入可能
CREATE POLICY "Users can insert their own training data"
  ON ml_training_data
  FOR INSERT
  WITH CHECK (TRUE);  -- Server Actionsからの挿入を許可

-- 全ユーザーが訓練データを読み取り可能（機械学習用）
CREATE POLICY "Anyone can read training data"
  ON ml_training_data
  FOR SELECT
  USING (TRUE);

-- 更新を許可（ゲーム終了時の game_result / player_final_score 更新のため）
-- Server Actions 経由でのみ呼ばれるため、WITH CHECK (TRUE) で許可
CREATE POLICY "Server can update game results"
  ON ml_training_data
  FOR UPDATE
  USING (TRUE)
  WITH CHECK (TRUE);

-- 削除は管理者のみ（必要に応じて）
CREATE POLICY "No deletes allowed"
  ON ml_training_data
  FOR DELETE
  USING (FALSE);

-- ========================================
-- データクレンジング関数（オプション）
-- ========================================

-- 古いデータを削除する関数（ストレージ節約）
CREATE OR REPLACE FUNCTION cleanup_old_training_data(days_to_keep INT DEFAULT 90)
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM ml_training_data
  WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 重複データを削除する関数
CREATE OR REPLACE FUNCTION remove_duplicate_training_data()
RETURNS INT AS $$
DECLARE
  deleted_count INT;
BEGIN
  DELETE FROM ml_training_data a
  USING ml_training_data b
  WHERE a.id > b.id
    AND a.game_id = b.game_id
    AND a.player_id = b.player_id
    AND a.trick_number = b.trick_number;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ========================================
-- コメント
-- ========================================

COMMENT ON TABLE ml_training_data IS '機械学習モデル訓練用のゲームプレイデータ';
COMMENT ON COLUMN ml_training_data.hand IS 'プレイヤーの手札（JSON配列）';
COMMENT ON COLUMN ml_training_data.table_cards IS '場に出ているカード（JSON配列）';
COMMENT ON COLUMN ml_training_data.selected_card IS 'プレイヤーが選択したカード（JSON）';
COMMENT ON COLUMN ml_training_data.role IS 'プレイヤーの役割: napoleon, adjutant, allied';
COMMENT ON COLUMN ml_training_data.game_result IS 'ゲーム結果（ゲーム終了後に更新）';
