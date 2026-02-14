# Database Migration Skill

## 目的

Supabaseデータベースのマイグレーション作成・適用・ロールバックを安全に実行するスキル。

## 前提条件

- Supabase CLIがインストール済み
- Supabaseプロジェクトにリンク済み
- 適切な権限が設定されている

## マイグレーションフロー

### 1. マイグレーション作成

```bash
# 新しいマイグレーションファイル作成
supabase migration new <migration_name>

# 例: テーブル追加
supabase migration new add_statistics_table
```

### 2. マイグレーションSQL記述

```sql
-- supabase/migrations/20260215000000_add_statistics_table.sql

-- 統計テーブル作成
CREATE TABLE IF NOT EXISTS public.statistics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  napoleon_wins INTEGER DEFAULT 0,
  adjutant_wins INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLSポリシー設定
ALTER TABLE public.statistics ENABLE ROW LEVEL SECURITY;

-- 読み取り権限（自分の統計のみ）
CREATE POLICY "Users can view their own statistics"
  ON public.statistics
  FOR SELECT
  USING (auth.uid() = player_id);

-- 更新権限（自分の統計のみ）
CREATE POLICY "Users can update their own statistics"
  ON public.statistics
  FOR UPDATE
  USING (auth.uid() = player_id);

-- インデックス作成
CREATE INDEX idx_statistics_player_id ON public.statistics(player_id);

-- トリガー（更新日時自動更新）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_statistics_updated_at
  BEFORE UPDATE ON public.statistics
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### 3. ローカルで適用・テスト

```bash
# ローカルSupabaseを起動
supabase start

# マイグレーション適用
supabase db reset

# または
supabase migration up

# 動作確認（psql接続）
supabase db shell
```

### 4. 本番環境に適用

```bash
# マイグレーション確認
supabase migration list

# 本番環境にプッシュ
supabase db push

# または
supabase migration push
```

## マイグレーションのベストプラクティス

### 1. 命名規則

```bash
# 良い例
supabase migration new add_statistics_table
supabase migration new add_player_email_column
supabase migration new fix_rls_policy_games

# 悪い例
supabase migration new update
supabase migration new fix
```

### 2. 冪等性（何度実行しても同じ結果）

```sql
-- ✅ 良い例
CREATE TABLE IF NOT EXISTS public.statistics (...);
DROP INDEX IF EXISTS idx_statistics_player_id;

-- ❌ 悪い例
CREATE TABLE public.statistics (...);
DROP INDEX idx_statistics_player_id;
```

### 3. RLSポリシーは必須

```sql
-- 必ずRLSを有効化
ALTER TABLE public.statistics ENABLE ROW LEVEL SECURITY;

-- 適切なポリシーを設定
CREATE POLICY "..." ON public.statistics ...;
```

### 4. インデックス追加

```sql
-- 頻繁に検索されるカラムにインデックス
CREATE INDEX idx_statistics_player_id ON public.statistics(player_id);
CREATE INDEX idx_games_created_at ON public.games(created_at);
```

## ロールバック

### 手動ロールバック

```sql
-- 作成したテーブル削除
DROP TABLE IF EXISTS public.statistics CASCADE;

-- 作成したインデックス削除
DROP INDEX IF EXISTS idx_statistics_player_id;

-- 作成したポリシー削除
DROP POLICY IF EXISTS "Users can view their own statistics" ON public.statistics;
```

### マイグレーションファイルでロールバック

```bash
# down.sqlファイル作成（ロールバック用）
# supabase/migrations/20260215000000_add_statistics_table.down.sql

DROP TABLE IF EXISTS public.statistics CASCADE;
```

## チェックリスト

マイグレーション前に確認：

- [ ] マイグレーション名が明確
- [ ] `IF NOT EXISTS` / `IF EXISTS` で冪等性確保
- [ ] RLSポリシーが正しく設定されている
- [ ] インデックスが適切に追加されている
- [ ] ローカル環境でテスト済み
- [ ] ロールバック手順を準備
- [ ] 本番データのバックアップ確認

マイグレーション後に確認：

- [ ] テーブルが正しく作成された
- [ ] RLSポリシーが動作している
- [ ] インデックスが作成された
- [ ] アプリケーションが正常動作
- [ ] パフォーマンス問題なし

## トラブルシューティング

### マイグレーション失敗

```bash
# エラーログ確認
supabase migration repair

# 手動でロールバック
supabase db shell
```

### RLSポリシーエラー

```sql
-- 既存のポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'statistics';

-- ポリシー削除
DROP POLICY IF EXISTS "policy_name" ON public.statistics;
```

### インデックス作成失敗

```sql
-- 既存のインデックス確認
\d+ statistics

-- インデックス削除
DROP INDEX IF EXISTS idx_statistics_player_id;
```

## 参考リンク

- [Supabase Migration Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [PostgreSQL Best Practices](https://wiki.postgresql.org/wiki/Don%27t_Do_This)
- [RLS Setup Guide](../docs/security/RLS_SETUP.md)
- [Database Performance Guide](../docs/database/DATABASE_PERFORMANCE_SETUP.md)
