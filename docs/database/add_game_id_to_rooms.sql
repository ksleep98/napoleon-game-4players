-- ============================================
-- Add game_id column to game_rooms table
-- ============================================
-- 目的: ルームと実行中のゲームを関連付ける
-- 実行場所: Supabase Dashboard > SQL Editor
-- 対象環境: 開発環境・本番環境の両方で実行
-- ============================================

-- game_id カラムを追加（NULL許可 - まだゲームが開始されていない場合）
ALTER TABLE game_rooms
ADD COLUMN IF NOT EXISTS game_id TEXT;

-- game_id にインデックスを作成（高速検索用）
CREATE INDEX IF NOT EXISTS idx_game_rooms_game_id
ON game_rooms(game_id);

-- 確認用クエリ
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'game_rooms'
  AND column_name = 'game_id';
