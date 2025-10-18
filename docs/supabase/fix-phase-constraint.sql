-- ゲームフェーズ制約の修正
-- Supabaseダッシュボードまたはpsqlで実行してください

-- 既存の制約を削除
ALTER TABLE games DROP CONSTRAINT IF EXISTS games_phase_check;

-- 新しい制約を追加（card_exchangeを含む）
ALTER TABLE games ADD CONSTRAINT games_phase_check
CHECK (phase IN ('setup', 'dealing', 'napoleon', 'adjutant', 'card_exchange', 'playing', 'finished'));

-- 制約の確認
SELECT conname, consrc FROM pg_constraint
WHERE conrelid = 'games'::regclass AND contype = 'c';