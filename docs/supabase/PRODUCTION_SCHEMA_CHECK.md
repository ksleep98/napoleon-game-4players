# 本番環境スキーマ確認ガイド

## 🔍 本番環境の `game_results` テーブルスキーマを確認する

RLS修正スクリプトを実行する前に、本番環境の実際のテーブルスキーマを確認する必要があります。

### ステップ 1: スキーマ確認クエリの実行

1. **Supabase Production Dashboard** を開く
2. **SQL Editor** を選択
3. 以下のクエリを実行:

```sql
-- game_results テーブルのカラム一覧を確認
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'game_results'
  AND table_schema = 'public'
ORDER BY ordinal_position;
```

### ステップ 2: スキーマパターンの判定

実行結果から、どちらのスキーマパターンかを判定してください：

#### パターンA（古いスキーマ）

以下のカラムが存在する場合：

- ✅ `napoleon_player_id` (text)
- ✅ `adjutant_player_id` (text)
- ✅ `scores` (jsonb)
- ✅ `napoleon_won` (boolean)
- ✅ `face_cards_won` (integer)

**→ パターンA用のスクリプトをそのまま使用してください**

#### パターンB（新しいスキーマ）

以下のカラムが存在する場合：

- ✅ `player_scores` (jsonb)
- ✅ `winner_id` (text)
- ❌ `napoleon_player_id` (存在しない)
- ❌ `adjutant_player_id` (存在しない)

**→ スクリプト内のコメントアウトされたパターンBを使用してください**

### ステップ 3: スクリプトの調整

#### パターンAの場合（そのまま実行）

`fix-rls-security-warnings-production.sql` をそのまま実行してください。

#### パターンBの場合（スクリプトを編集）

1. `fix-rls-security-warnings-production.sql` を開く
2. 以下の部分を探す：

```sql
-- パターンA（古いスキーマ用）
CREATE POLICY "game_results_select_policy" ON game_results
  FOR SELECT USING (
    ...
  );
```

3. パターンAの部分をコメントアウト：

```sql
/*
-- パターンA（古いスキーマ用）
CREATE POLICY "game_results_select_policy" ON game_results
  FOR SELECT USING (
    ...
  );
*/
```

4. パターンBのコメントを外す：

```sql
-- パターンB（新しいスキーマ用）
CREATE POLICY "game_results_select_policy" ON game_results
  FOR SELECT USING (
    is_service_role_authenticated()
    OR (
      get_current_player_id() IS NOT NULL
      AND (
        -- player_scoresに自分のIDが含まれているか確認
        EXISTS (
          SELECT 1
          FROM jsonb_array_elements(player_scores) AS score
          WHERE score->>'playerId' = get_current_player_id()
        )
        -- またはwinner_idが自分か確認
        OR winner_id = get_current_player_id()
      )
    )
  );
```

### ステップ 4: スクリプトの実行

調整したスクリプトを実行してください。

## 🔧 トラブルシューティング

### エラー: column "scores" does not exist

**原因**: パターンBのスキーマなのに、パターンAのスクリプトを実行した

**解決策**: 上記のステップ3に従って、パターンBに切り替えて再実行

### エラー: column "player_scores" does not exist

**原因**: パターンAのスキーマなのに、パターンBのスクリプトを実行した

**解決策**: パターンAのスクリプト（デフォルト）を使用して再実行

### エラー: column "napoleon_player_id" does not exist

**原因**: パターンBのスキーマなのに、パターンAのスクリプトを実行した

**解決策**: 上記のステップ3に従って、パターンBに切り替えて再実行

## 📊 スキーマ差異の理由

### なぜ2つのパターンが存在するのか？

1. **パターンA（古いスキーマ）**
   - 初期のアプリケーションコードで使用されている
   - Napoleon Game固有のカラム名
   - より詳細なゲーム情報を保存

2. **パターンB（新しいスキーマ）**
   - `production_database_schema.sql` で定義されている
   - より汎用的なカラム名
   - シンプルな構造

### どちらを使うべきか？

**現在の本番環境のスキーマに合わせてください。**

本番環境でアプリケーションが正常に動作している場合、そのスキーマが正しいスキーマです。

## ✅ 確認チェックリスト

スクリプト実行前：

- [ ] 本番環境のバックアップを取得した
- [ ] `game_results` テーブルのスキーマを確認した
- [ ] 正しいパターン（A or B）を選択した
- [ ] スクリプトを適切に調整した（パターンBの場合）

スクリプト実行後：

- [ ] エラーなく完了した
- [ ] Security Advisorの警告が消えた
- [ ] 確認クエリの結果を確認した
- [ ] アプリケーションが正常に動作する

---

**最終更新**: 2026-01-09
