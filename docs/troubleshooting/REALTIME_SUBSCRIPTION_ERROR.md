# Supabase Realtime Subscription エラー対処法

## エラー内容

```
❌ Subscription failed with status: CLOSED
```

ゲームは進行できるが、リアルタイム更新（WebSocket）が機能していない状態です。

## 原因

Supabaseのリアルタイム機能が正しく設定されていない可能性があります。

## 診断手順

### 1. Replication確認

Supabase SQL Editorで以下のSQLを実行：

```sql
-- games テーブルのレプリケーション設定を確認
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'games';
```

**期待される結果**: `rowsecurity` が `true` であること

---

### 2. Publication確認

```sql
-- supabase_realtime パブリケーションに games テーブルが含まれているか確認
SELECT * FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename = 'games';
```

**期待される結果**: `games` テーブルが含まれている

**結果が空の場合の修正**:

```sql
-- games テーブルをリアルタイムパブリケーションに追加
ALTER PUBLICATION supabase_realtime ADD TABLE games;
```

---

### 3. Supabaseダッシュボードで確認

**Database → Replication** で `games` テーブルの設定を確認：

- ✅ `games` テーブルにチェックが入っている
- ✅ `Source` が "Realtime" になっている

**有効化方法**:

1. Database → Replication に移動
2. `games` テーブルを検索
3. トグルスイッチをONにする

---

### 4. RLSポリシー確認

```sql
-- games テーブルのRLSポリシーを確認
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE tablename = 'games';
```

**必要なポリシー**:

- `SELECT` 権限のポリシーが存在すること
- `authenticated` ロールまたは `anon` ロールに対して許可されていること

**ポリシーがない場合の作成**:

```sql
-- 認証済みユーザーが全てのゲームを読み取れるようにする
CREATE POLICY "Allow authenticated users to select games"
ON games
FOR SELECT
TO authenticated
USING (true);

-- 匿名ユーザーも読み取れるようにする（開発環境のみ推奨）
CREATE POLICY "Allow anon users to select games"
ON games
FOR SELECT
TO anon
USING (true);
```

---

## 修正後の確認

1. ブラウザのコンソールを開く
2. ゲームを開始
3. 以下のログが表示されることを確認：

```
✅ Successfully subscribed to game updates
```

**エラーが出る場合**:

```
❌ Subscription error details: [詳細なエラーメッセージ]
```

このメッセージを確認して、具体的な原因を特定してください。

---

## よくあるエラーと対処法

### エラー1: "permission denied for table games"

**原因**: RLSポリシーでSELECT権限がない

**対処法**: 上記「4. RLSポリシー確認」のSQLを実行してポリシーを作成

---

### エラー2: "relation \"games\" is not in publication \"supabase_realtime\""

**原因**: `games` テーブルがリアルタイムパブリケーションに含まれていない

**対処法**: 上記「2. Publication確認」のSQLを実行してテーブルを追加

---

### エラー3: Connection timeout / TIMED_OUT

**原因**: ネットワーク接続の問題

**対処法**:

- インターネット接続を確認
- VPN使用時は一時的に無効化して試す
- Supabaseプロジェクトのステータスを確認（https://status.supabase.com/）

---

## 開発環境での一時的な回避策

リアルタイム更新が機能しなくても、ゲームは進行できます。ただし、以下の機能が制限されます：

- マルチプレイヤーでの自動更新（手動リロードが必要）
- リアルタイムの状態同期

**本番環境では必ず修正してください。**

---

## 参考リンク

- [Supabase Realtime Documentation](https://supabase.com/docs/guides/realtime)
- [Row Level Security Policies](https://supabase.com/docs/guides/auth/row-level-security)
- [Database Replication](https://supabase.com/docs/guides/database/replication)

---

**更新履歴**:

- 2026-04-03: 初版作成
