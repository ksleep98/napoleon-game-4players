# 🚨 本番環境RLSポリシー修正 - 実行チェックリスト

## 📋 実行前チェックリスト

### 1. バックアップの取得 ✅

**必須**: データベースのバックアップを取得してください

Supabase Dashboardで:

```
Settings > Database > Backups
```

または手動でバックアップ:

```sql
-- 各テーブルのポリシー設定をバックアップ
COPY (
  SELECT *
  FROM pg_policies
  WHERE schemaname = 'public'
) TO '/tmp/rls_policies_backup.csv' WITH CSV HEADER;
```

### 2. 影響範囲の確認 ✅

以下のテーブルのRLSポリシーが変更されます:

- ✅ `players`
- ✅ `games`
- ✅ `game_rooms`
- ✅ `game_results`

### 3. メンテナンス通知（推奨）

ユーザーに短時間のメンテナンスを通知することを推奨:

- 予想所要時間: **30秒〜1分**
- 影響: SQLの実行中のみ（通常は数秒）

---

## 🚀 実行手順

### Step 1: Supabase Dashboardにログイン

1. https://supabase.com/dashboard にアクセス
2. 本番環境のプロジェクトを選択
3. **SQL Editor** を開く

### Step 2: SQLスクリプトを実行

1. `docs/deployment/URGENT_PRODUCTION_RLS_FIX.sql` を開く
2. **全内容をコピー**
3. SQL Editorに**ペースト**
4. **Run** をクリック

### Step 3: 実行結果の確認

以下のような出力が表示されることを確認:

```
✅ RLSポリシーの修正が完了しました

修正内容:
1. players - 自分のデータのみアクセス可能
2. games - 参加しているゲームのみアクセス可能
3. game_rooms - waiting状態は全員閲覧可、管理はホストのみ
4. game_results - 自分が参加した結果のみ閲覧可能
```

ポリシー一覧テーブルに **"⚠️ INSECURE: true"** が表示されていないことを確認

---

## ✅ 実行後の検証

### 1. RLSステータスの確認

SQL Editorで以下を実行:

```sql
-- RLSが有効か確認
SELECT
  tablename,
  CASE
    WHEN rowsecurity THEN '✅ Enabled'
    ELSE '❌ Disabled'
  END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('players', 'games', 'game_rooms', 'game_results')
ORDER BY tablename;
```

**期待される結果**: 全テーブルで `✅ Enabled`

### 2. ポリシーの確認

```sql
-- 危険なポリシーがないか確認
SELECT
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('players', 'games', 'game_rooms', 'game_results')
  AND qual = 'true'  -- 危険なポリシー
ORDER BY tablename;
```

**期待される結果**: **0件** (空の結果)

### 3. アプリケーション動作確認

以下の機能をテストしてください:

#### ✅ 基本機能

- [ ] プレイヤー作成・ログイン
- [ ] ゲームルーム作成
- [ ] ゲームルーム一覧表示
- [ ] ゲーム開始
- [ ] ゲームプレイ（カード配布・プレイ）
- [ ] ゲーム結果表示

#### ✅ セキュリティ確認

- [ ] 他人のプレイヤーデータが見えない
- [ ] 他人のゲームが見えない（参加していない場合）
- [ ] 他人のルームを編集できない
- [ ] 他人のゲーム結果が見えない

### 4. エラーログの確認

Supabase Dashboard:

```
Logs > Database Logs
```

以下のようなエラーがないか確認:

- `permission denied for table`
- `new row violates row-level security policy`

**想定されるエラー**: なし（正常動作）

---

## 🔧 トラブルシューティング

### 問題: アプリケーションが動作しない

#### 症状1: "permission denied" エラー

**原因**: Server Actionsが`service_role_key`を使っていない

**解決方法**:

```typescript
// src/app/actions/gameActions.ts で確認
import { createClient } from '@/lib/supabase/server';

// Service Role Keyを使用していることを確認
const supabase = createClient(); // これがservice_role_keyを使っているか確認
```

#### 症状2: ゲームルームが表示されない

**原因**: ルームのstatusが'waiting'以外

**確認方法**:

```sql
SELECT room_id, status FROM game_rooms LIMIT 10;
```

**解決方法**: statusを'waiting'に設定

```sql
UPDATE game_rooms SET status = 'waiting' WHERE status != 'waiting';
```

#### 症状3: ゲーム結果が表示されない

**原因**: `player_scores`のJSON構造が想定と異なる

**確認方法**:

```sql
SELECT player_scores FROM game_results LIMIT 1;
```

**期待される構造**:

```json
[
  { "playerId": "player_1", "score": 100 },
  { "playerId": "player_2", "score": 50 }
]
```

---

## 🔙 ロールバック手順（必要な場合のみ）

もし問題が発生した場合、以下のSQLで元に戻せます:

```sql
BEGIN;

-- players
DROP POLICY IF EXISTS "players_select_policy" ON players;
CREATE POLICY "players_select_policy" ON players
  FOR SELECT USING (
    (id = get_current_player_id()) OR (get_current_player_id() IS NOT NULL)
  );

-- games
DROP POLICY IF EXISTS "games_select_policy" ON games;
CREATE POLICY "games_select_policy" ON games
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "games_update_policy" ON games;
CREATE POLICY "games_update_policy" ON games
  FOR UPDATE USING (true);

-- game_rooms
DROP POLICY IF EXISTS "game_rooms_select_policy" ON game_rooms;
CREATE POLICY "game_rooms_select_policy" ON game_rooms
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "game_rooms_update_policy" ON game_rooms;
CREATE POLICY "game_rooms_update_policy" ON game_rooms
  FOR UPDATE USING (true);

-- game_results
DROP POLICY IF EXISTS "game_results_select_policy" ON game_results;
CREATE POLICY "game_results_select_policy" ON game_results
  FOR SELECT USING (true);

COMMIT;
```

⚠️ **注意**: ロールバックするとセキュリティ脆弱性が復活します

---

## 📞 サポート

問題が解決しない場合:

1. エラーメッセージをコピー
2. 実行したSQLをコピー
3. `pg_policies`の出力をコピー
4. 開発チームに報告

---

## ✅ 完了チェック

実行完了後、以下を確認してチェックを付けてください:

- [ ] SQLスクリプト実行完了（エラーなし）
- [ ] RLSステータス確認完了（全テーブルEnabled）
- [ ] 危険なポリシーなし確認完了（qual='true'が0件）
- [ ] アプリケーション動作確認完了
- [ ] エラーログ確認完了（エラーなし）

**全てチェック完了**: 🎉 修正完了！

---

**実行日**: **\*\***\_\_\_**\*\***
**実行者**: **\*\***\_\_\_**\*\***
**所要時間**: **\*\***\_\_\_**\*\***
