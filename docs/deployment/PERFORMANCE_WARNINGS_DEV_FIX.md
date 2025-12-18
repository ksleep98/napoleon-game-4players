# Performance Advisor Warnings Fix - Development Environment (All Tables)

## 概要

Supabase Performance Advisor（開発環境）で検出された**61件**の警告を全て解消します。

**実施日**: 2025-12-18
**対象環境**: 開発環境（Development）
**対象テーブル**: `games`, `game_results`, `game_rooms`, `players`

## 検出された警告（61件）

### 1. Auth RLS Initialization Plan (5件)

| テーブル     | ポリシー名                         | 問題                                 |
| ------------ | ---------------------------------- | ------------------------------------ |
| games        | Game participants can update games | `current_setting` が各行ごとに再評価 |
| games        | Game participants can view games   | `current_setting` が各行ごとに再評価 |
| game_results | Game participants can view results | `current_setting` が各行ごとに再評価 |
| game_rooms   | Host can update own room           | `current_setting` が各行ごとに再評価 |
| players      | Players can update own record      | `current_setting` が各行ごとに再評価 |

### 2. Multiple Permissive Policies (55件)

#### game_results (8件)

- **INSERT**: 2つの重複ポリシー
  - "Anyone can create results" (with_check: true)
  - "Authenticated users can insert game results" (with_check: true)
  - → 実質的に同じ内容で冗長

- **SELECT**: 2つのポリシー（統合可能）
  - "Game participants can view results"
  - "Players can view their game results"

#### game_rooms (12件)

- **INSERT**: 2つのポリシー（重複）
- **SELECT**: 3つのポリシー（冗長）
  - "Anyone can view game rooms" (true - 全て許可)
  - "Anyone can view waiting rooms" (status条件)
  - "Players can manage their rooms" (FOR ALL)
  - → 最初のポリシーで全てカバー

- **UPDATE**: 2つのポリシー（重複）

#### games (16件)

- **DELETE**: 2つのポリシー
- **INSERT**: 3つのポリシー（重複）
- **SELECT**: 3つのポリシー
- **UPDATE**: 3つのポリシー

#### players (16件)

- **DELETE**: 2つのポリシー
- **INSERT**: 3つのポリシー（重複）
  - "Anyone can create player" (with_check: true)
  - "Players can access their own data" (FOR ALL)
  - players_insert_policy
  - → 最初のポリシーで全てカバー

- **SELECT**: 3つのポリシー（冗長）
  - "Anyone can view players" (true - 全て許可)
  - 他2つのポリシー
  - → 最初のポリシーで全てカバー

- **UPDATE**: 3つのポリシー

### 3. Duplicate Index (1件)

- **game_results** テーブル
  - `idx_game_results_napoleon_created` と `idx_game_results_napoleon_fast` が重複
  - → `idx_game_results_napoleon_created` を削除

## 修正戦略

### 1. Auth Function 最適化

**Before**:

```sql
current_setting('app.player_id', true)
```

**After**:

```sql
(select current_setting('app.player_id', true))
```

**効果**: クエリごとに1回のみ評価 → パフォーマンス向上

### 2. ポリシー統合

#### パターン1: 完全重複の削除

```sql
-- Before: 2つの重複ポリシー
CREATE POLICY "Policy 1" FOR INSERT WITH CHECK (true);
CREATE POLICY "Policy 2" FOR INSERT WITH CHECK (true);

-- After: 1つに統合
CREATE POLICY "Policy 1" FOR INSERT WITH CHECK (true);
```

#### パターン2: 冗長ポリシーの統合

```sql
-- Before: 全て許可するポリシーと条件付きポリシー
CREATE POLICY "Anyone" FOR SELECT USING (true);
CREATE POLICY "Specific" FOR SELECT USING (condition);

-- After: 全て許可するポリシーのみ
CREATE POLICY "Anyone" FOR SELECT USING (true);
```

#### パターン3: FOR ALL ポリシーの分離

```sql
-- Before: FOR ALLで全操作を1つのポリシーで処理
CREATE POLICY "Policy" FOR ALL USING (condition);

-- After: 操作ごとに分離
CREATE POLICY "Policy SELECT" FOR SELECT USING (condition);
CREATE POLICY "Policy UPDATE" FOR UPDATE USING (condition);
CREATE POLICY "Policy DELETE" FOR DELETE USING (condition);
```

## 修正後のポリシー構成

### game_results

| 操作   | ポリシー名                                    | 条件                                            |
| ------ | --------------------------------------------- | ----------------------------------------------- |
| INSERT | Anyone can create results                     | 誰でも可能                                      |
| SELECT | Game participants and owners can view results | 参加者または所有者のみ（current_setting最適化） |

**削減**: 4ポリシー → 2ポリシー

### game_rooms

| 操作   | ポリシー名                   | 条件                                |
| ------ | ---------------------------- | ----------------------------------- |
| INSERT | Anyone can create game rooms | 誰でも可能                          |
| SELECT | Anyone can view game rooms   | 誰でも可能                          |
| UPDATE | Host can update own room     | ホストのみ（current_setting最適化） |
| DELETE | Host can delete own room     | ホストのみ                          |

**削減**: 5ポリシー → 4ポリシー

### games

| 操作   | ポリシー名                         | 条件                                |
| ------ | ---------------------------------- | ----------------------------------- |
| INSERT | Anyone can create games            | 誰でも可能                          |
| SELECT | Game participants can view games   | 参加者のみ（current_setting最適化） |
| UPDATE | Game participants can update games | 参加者のみ（current_setting最適化） |
| DELETE | Game participants can delete games | 参加者のみ                          |

**削減**: 8ポリシー → 4ポリシー

### players

| 操作   | ポリシー名                    | 条件                                        |
| ------ | ----------------------------- | ------------------------------------------- |
| INSERT | Anyone can create player      | 誰でも可能                                  |
| SELECT | Anyone can view players       | 誰でも可能                                  |
| UPDATE | Players can update own record | 自分のレコードのみ（current_setting最適化） |
| DELETE | Players can delete own record | 自分のレコードのみ                          |

**削減**: 8ポリシー → 4ポリシー

## パフォーマンス改善効果

### Before (修正前)

- **Auth function calls**: 各行ごとに評価（5箇所）
- **Policy evaluation**: 複数の重複ポリシーを毎回評価
- **Index**: 重複インデックスがストレージを消費

### After (修正後)

- **Auth function calls**: クエリごとに1回のみ評価
- **Policy evaluation**: 最小限のポリシーのみ評価
- **Index**: 最適化された1つのインデックスのみ

**改善見込み**:

- 大量データ（1000+行）のクエリで顕著な改善
- 各操作のパフォーマンス向上
- データベースCPU使用率の削減
- ストレージ効率の向上

## セキュリティへの影響

**重要**: 各テーブルの操作権限は修正前後で**変更なし**

### game_results

| 操作   | 修正前                 | 修正後                 | 変更 |
| ------ | ---------------------- | ---------------------- | ---- |
| INSERT | 誰でも可能             | 誰でも可能             | なし |
| SELECT | 参加者または所有者のみ | 参加者または所有者のみ | なし |

### game_rooms

| 操作   | 修正前     | 修正後     | 変更 |
| ------ | ---------- | ---------- | ---- |
| INSERT | 誰でも可能 | 誰でも可能 | なし |
| SELECT | 誰でも可能 | 誰でも可能 | なし |
| UPDATE | ホストのみ | ホストのみ | なし |
| DELETE | ホストのみ | ホストのみ | なし |

### games

| 操作   | 修正前     | 修正後     | 変更 |
| ------ | ---------- | ---------- | ---- |
| INSERT | 誰でも可能 | 誰でも可能 | なし |
| SELECT | 参加者のみ | 参加者のみ | なし |
| UPDATE | 参加者のみ | 参加者のみ | なし |
| DELETE | 参加者のみ | 参加者のみ | なし |

### players

| 操作   | 修正前             | 修正後             | 変更 |
| ------ | ------------------ | ------------------ | ---- |
| INSERT | 誰でも可能         | 誰でも可能         | なし |
| SELECT | 誰でも可能         | 誰でも可能         | なし |
| UPDATE | 自分のレコードのみ | 自分のレコードのみ | なし |
| DELETE | 自分のレコードのみ | 自分のレコードのみ | なし |

## 実行手順

### 1. バックアップ（推奨）

```sql
-- 現在のポリシーをバックアップ（結果を保存）
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('games', 'game_results', 'game_rooms', 'players');
```

### 2. 修正スクリプト実行

1. Supabase Dashboard（開発環境） → SQL Editor
2. `docs/deployment/fix_all_performance_warnings_dev.sql` の内容をコピー&ペースト
3. スクリプトを実行（約30秒）

### 3. 確認

スクリプト内の確認クエリが自動実行されます：

```sql
-- ポリシーの最適化確認
SELECT tablename, policyname, cmd, auth_optimized
FROM ... -- 結果で全て 'OK ✅' を確認

-- インデックス確認
SELECT indexname FROM ... -- idx_game_results_napoleon_fast のみ存在を確認
```

### 4. Performance Advisor再確認

1. Supabase Dashboard → Advisors → Performance Advisor
2. Refresh ボタンをクリック
3. 警告が消えていることを確認

**期待される結果**: 61件 → 0件 ✅

## ロールバック手順（万が一の場合）

バックアップした元のポリシー定義を使用して復元できます。

```sql
-- 例: game_results テーブルのロールバック
DROP POLICY IF EXISTS "Anyone can create results" ON public.game_results;
DROP POLICY IF EXISTS "Game participants and owners can view results" ON public.game_results;

-- 元のポリシーを再作成（バックアップから復元）
CREATE POLICY "Anyone can create results" ON public.game_results ...
CREATE POLICY "Authenticated users can insert game results" ON public.game_results ...
-- etc.
```

## トラブルシューティング

### エラー1: ポリシーが削除できない

```
ERROR: policy "..." for table "..." does not exist
```

**解決**: そのポリシーは既に削除されているため、スクリプトを続行可能

### エラー2: インデックスが削除できない

```
ERROR: index "idx_game_results_napoleon_created" does not exist
```

**解決**: インデックスは既に削除されているため、問題なし

## 参考資料

- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Auth RLS InitPlan Lint Rule](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [Multiple Permissive Policies Lint Rule](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [Duplicate Index Lint Rule](https://supabase.com/docs/guides/database/database-linter?lint=0009_duplicate_index)

## 今後の推奨事項

1. **定期的なPerformance Advisorチェック**: 月次で確認
2. **新規ポリシー作成時のベストプラクティス**:
   - `current_setting()` は常に `(select current_setting())` でラップ
   - 操作ごとにポリシーを分離（FOR INSERT, FOR SELECT, etc.）
   - 同じ操作に対する複数のPERMISSIVEポリシーを避ける
   - 全て許可するポリシーがあれば、条件付きポリシーは不要
3. **インデックス管理**: 重複インデックスを定期的にチェック
4. **パフォーマンステスト**: 大量データでのクエリパフォーマンスを定期的に測定

---

**完了日**: 2025-12-18
**作成者**: Claude Code
**ステータス**: ✅ 修正スクリプト作成完了（61件の警告を解消）
