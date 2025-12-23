# Performance Advisor Warnings Fix - game_sessions RLS

## 概要

Supabase Performance Advisorで検出された`game_sessions`テーブルのRLSポリシーに関する5つの警告を解消します。

**実施日**: 2025-12-18
**対象環境**: 本番環境（Production）
**対象テーブル**: `public.game_sessions`

## 検出された警告

### 1. Auth RLS Initialization Plan (1件)

**警告**: `Session participants can access sessions` ポリシーで `auth.uid()` が各行ごとに再評価されている

**問題**:

```sql
-- 問題のあるコード
USING (auth.uid() IS NOT NULL)
```

`auth.uid()` が各行のチェックごとに呼び出されるため、大量のデータがある場合にパフォーマンスが低下します。

**解決策**:

```sql
-- 最適化されたコード
USING ((select auth.uid()) IS NOT NULL)
```

`SELECT`でラップすることで、クエリごとに1回だけ評価されるようになります。

**参考**: [Supabase Docs - Call functions with select](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)

### 2. Multiple Permissive Policies (4件)

**警告**: INSERT操作に対して複数のPERMISSIVEポリシーが存在

**問題のあるポリシー構成**:

1. `Anyone can create game sessions` (INSERT, with_check: true)
2. `Session participants can access sessions` (ALL operations)

両方のポリシーがINSERT操作に適用されるため、各INSERTクエリで両方のポリシーが評価されます。

**影響を受けるロール**:

- `anon`
- `authenticated`
- `authenticator`
- `dashboard_user`

**問題の詳細**:

- Policy 1: 全てのINSERTを許可 (`with_check: true`)
- Policy 2: 認証ユーザーのみINSERT可能 (`auth.uid() IS NOT NULL`)

Policy 1が既に全てのINSERTを許可しているため、Policy 2のINSERT部分は冗長です。

**解決策**:

ポリシーを操作ごとに分離：

1. INSERT専用ポリシー（誰でも作成可能）
2. SELECT専用ポリシー（認証ユーザーのみ）
3. UPDATE専用ポリシー（認証ユーザーのみ）
4. DELETE専用ポリシー（認証ユーザーのみ）

**参考**: [Supabase Docs - Multiple Permissive Policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

## 修正前のポリシー構成

```sql
-- Policy 1: INSERT専用（実質的に）
CREATE POLICY "Anyone can create game sessions"
ON public.game_sessions
FOR INSERT
TO public
WITH CHECK (true);

-- Policy 2: ALL操作（問題あり）
CREATE POLICY "Session participants can access sessions"
ON public.game_sessions
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);
```

**問題点**:

1. `auth.uid()` が最適化されていない（各行ごとに評価）
2. INSERT操作に対して2つのポリシーが重複
3. ALL操作を1つのポリシーで処理（操作ごとに分離した方が効率的）

## 修正後のポリシー構成

```sql
-- Policy 1: INSERT専用
CREATE POLICY "Anyone can create game sessions"
ON public.game_sessions
FOR INSERT
TO public
WITH CHECK (true);

-- Policy 2: SELECT専用（auth.uid()最適化済み）
CREATE POLICY "Authenticated users can access sessions"
ON public.game_sessions
FOR SELECT
TO public
USING ((select auth.uid()) IS NOT NULL);

-- Policy 3: UPDATE専用（auth.uid()最適化済み）
CREATE POLICY "Authenticated users can update sessions"
ON public.game_sessions
FOR UPDATE
TO public
USING ((select auth.uid()) IS NOT NULL)
WITH CHECK ((select auth.uid()) IS NOT NULL);

-- Policy 4: DELETE専用（auth.uid()最適化済み）
CREATE POLICY "Authenticated users can delete sessions"
ON public.game_sessions
FOR DELETE
TO public
USING ((select auth.uid()) IS NOT NULL);
```

**改善点**:

1. ✅ `auth.uid()` を `(select auth.uid())` に変更 → InitPlan警告解消
2. ✅ INSERT専用ポリシーとその他の操作を分離 → Multiple Policies警告解消
3. ✅ 各操作に対して明示的なポリシーを定義 → パフォーマンス向上

## パフォーマンス改善効果

### Before (修正前)

- **Auth function calls**: 各行ごとに `auth.uid()` を評価
- **Policy evaluation**: INSERT時に2つのポリシーを評価

### After (修正後)

- **Auth function calls**: クエリごとに1回のみ `auth.uid()` を評価
- **Policy evaluation**: INSERT時に1つのポリシーのみ評価

**改善見込み**:

- 大量データ（1000+行）のクエリで顕著な改善
- INSERT操作のパフォーマンス向上
- データベースCPU使用率の削減

## 実行手順

### 1. バックアップ（推奨）

```sql
-- 現在のポリシーをバックアップ（コピー保存）
SELECT
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'game_sessions';
```

### 2. 修正スクリプト実行

1. Supabase Dashboard → SQL Editor
2. `docs/deployment/fix_performance_warnings.sql` の内容をコピー&ペースト
3. スクリプトを実行

### 3. 確認

```sql
-- ポリシーが正しく更新されたことを確認
SELECT
    policyname,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'game_sessions'
ORDER BY cmd, policyname;
```

### 4. Performance Advisor再確認

1. Supabase Dashboard → Advisors → Performance Advisor
2. Refresh ボタンをクリック
3. `game_sessions` 関連の警告が消えていることを確認

**期待される結果**: 5つの警告 → 0つの警告 ✅

## セキュリティへの影響

### 変更前後の動作比較

| 操作   | 修正前           | 修正後           | 変更 |
| ------ | ---------------- | ---------------- | ---- |
| INSERT | 誰でも可能       | 誰でも可能       | なし |
| SELECT | 認証ユーザーのみ | 認証ユーザーのみ | なし |
| UPDATE | 認証ユーザーのみ | 認証ユーザーのみ | なし |
| DELETE | 認証ユーザーのみ | 認証ユーザーのみ | なし |

**結論**: セキュリティレベルは変更なし。パフォーマンスのみ改善。

## ロールバック手順（万が一の場合）

```sql
-- 修正後のポリシーを削除
DROP POLICY IF EXISTS "Anyone can create game sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Authenticated users can access sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Authenticated users can update sessions" ON public.game_sessions;
DROP POLICY IF EXISTS "Authenticated users can delete sessions" ON public.game_sessions;

-- 元のポリシーを復元
CREATE POLICY "Anyone can create game sessions"
ON public.game_sessions
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Session participants can access sessions"
ON public.game_sessions
FOR ALL
TO public
USING (auth.uid() IS NOT NULL);
```

## 参考資料

- [Supabase RLS Performance Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Auth RLS InitPlan Lint Rule](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)
- [Multiple Permissive Policies Lint Rule](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)

## 今後の推奨事項

1. **定期的なPerformance Advisorチェック**: 月次で確認
2. **新規ポリシー作成時のベストプラクティス**:
   - `auth.<function>()` は常に `(select auth.<function>())` でラップ
   - 操作ごとにポリシーを分離（FOR INSERT, FOR SELECT, etc.）
   - 同じ操作に対する複数のPERMISSIVEポリシーを避ける
3. **パフォーマンステスト**: 大量データでのクエリパフォーマンスを定期的に測定

---

**完了日**: 2025-12-18
**作成者**: Claude Code
**ステータス**: ✅ 修正スクリプト作成完了
