# Supabase Security Advisor 警告修正ガイド

## 🚨 問題の概要

Supabase Security Advisorで以下の4つの警告が検出されました：

1. **`public.game_results`** - "Anyone can create results for INSERT"
2. **`public.game_rooms`** - RLSポリシーが過度に寛容
3. **`public.games`** - RLSポリシーが過度に寛容
4. **`public.players`** - RLSポリシーが過度に寛容

### 問題の原因

RLSポリシーで `USING (true)` や `WITH CHECK (true)` を使用しているため、実質的にセキュリティが無効化されています。

```sql
-- ❌ 問題のあるポリシー例
CREATE POLICY "Authenticated users can insert game results" ON game_results
FOR INSERT WITH CHECK (true);  -- 誰でもアクセス可能！
```

## 🔒 修正内容

### 修正スクリプト

`docs/supabase/fix-rls-security-warnings.sql` に修正スクリプトを作成しました。

### セキュリティ改善の詳細

#### 1. game_results テーブル

| 操作   | 修正前              | 修正後                                 |
| ------ | ------------------- | -------------------------------------- |
| SELECT | 制限なし            | 自分が参加したゲームの結果のみ         |
| INSERT | `WITH CHECK (true)` | Service Roleのみ（Server Actions経由） |
| UPDATE | 制限なし            | Service Roleのみ                       |
| DELETE | 制限なし            | Service Roleのみ                       |

#### 2. game_rooms テーブル

| 操作   | 修正前   | 修正後                                  |
| ------ | -------- | --------------------------------------- |
| SELECT | 制限緩い | waiting状態は全員、それ以外はホストのみ |
| INSERT | 制限緩い | 自分がホストのルームのみ作成可能        |
| UPDATE | 制限緩い | ホストまたはService Roleのみ            |
| DELETE | 制限緩い | ホストまたはService Roleのみ            |

#### 3. games テーブル

| 操作   | 修正前   | 修正後                       |
| ------ | -------- | ---------------------------- |
| SELECT | 制限緩い | 自分が参加しているゲームのみ |
| INSERT | 制限緩い | 自分が参加しているゲームのみ |
| UPDATE | 制限緩い | 自分が参加しているゲームのみ |
| DELETE | 制限緩い | Service Roleのみ             |

#### 4. players テーブル

| 操作   | 修正前   | 修正後                         |
| ------ | -------- | ------------------------------ |
| SELECT | 制限緩い | 自分のデータのみ               |
| INSERT | 制限緩い | 自分のデータまたはService Role |
| UPDATE | 制限緩い | 自分のデータまたはService Role |
| DELETE | 制限緩い | Service Roleのみ               |

## 📋 実行手順

### 開発環境の修正

#### ステップ 1: バックアップの取得

⚠️ **重要**: データベースを変更する前に、必ずバックアップを取得してください。

1. Supabase Dashboard を開く
2. **Settings** → **Backups** に移動
3. 最新のバックアップを確認または新規作成

#### ステップ 2: 修正スクリプトの実行

1. **Supabase Dashboard** を開く
2. **SQL Editor** を選択
3. 新しいクエリを作成
4. `docs/supabase/fix-rls-security-warnings.sql` の内容を全てコピー&ペースト
5. **Run** ボタンをクリック

### 本番環境の修正

#### ステップ 1: バックアップの取得（重要！）

⚠️ **必須**: 本番環境のデータベースを変更する前に、必ずバックアップを取得してください。

1. Supabase Production Dashboard を開く
2. **Settings** → **Backups** に移動
3. 最新のバックアップを確認または新規作成

#### ステップ 2: 本番環境用修正スクリプトの実行

1. **Supabase Production Dashboard** を開く
2. **SQL Editor** を選択
3. 新しいクエリを作成
4. `docs/supabase/fix-rls-security-warnings-production.sql` の内容を全てコピー&ペースト
5. **Run** ボタンをクリック

**本番環境では以下のテーブルが修正されます:**

- `game_results`
- `game_rooms`
- `game_sessions` ← 本番環境のみ
- `games`
- `players`

### ステップ 3: 実行結果の確認

スクリプト実行後、以下の確認クエリが自動的に実行されます：

#### RLSステータス確認

```
tablename     | rls_status
--------------+-------------
games         | ✅ Enabled
game_results  | ✅ Enabled
game_rooms    | ✅ Enabled
players       | ✅ Enabled
```

#### ポリシー確認

各テーブルのポリシーが `✅ SECURE` と表示されることを確認してください。

`⚠️ POTENTIAL ISSUE` が表示された場合は、該当するポリシーを再確認してください。

### ステップ 4: Security Advisor での確認

1. **Supabase Dashboard** → **Advisors** → **Security Advisor**
2. **Refresh** ボタンをクリック
3. 4つの警告が消えていることを確認

### ステップ 5: アプリケーションの動作確認

修正後、以下の動作を確認してください：

#### ✅ 正常に動作すべき機能

- [ ] Quick Start（4人対戦開始）
- [ ] ゲーム状態の保存
- [ ] ゲーム状態の読み込み
- [ ] ゲーム結果の保存
- [ ] プレイヤー作成
- [ ] マルチプレイヤールームの作成・参加

#### ❌ エラーになるべき操作

- [ ] 他人のプレイヤーデータへのアクセス
- [ ] 参加していないゲームへのアクセス
- [ ] 他人がホストのルームの削除

## 🐛 トラブルシューティング

### 問題 1: "Player session not found" エラー

**原因**: プレイヤーセッションが設定されていない

**解決方法**:

```typescript
import { setPlayerSession } from '@/lib/supabase/client';

// プレイヤーIDをセッションに設定
await setPlayerSession(playerId);
```

### 問題 2: "new row violates row-level security policy" エラー

**原因**: Service Role Keyが正しく設定されていない、またはクライアントから直接データベースにアクセスしている

**解決方法**:

1. `.env.local` で `SUPABASE_SERVICE_ROLE_KEY` が設定されているか確認
2. データベース操作がServer Actions経由で実行されているか確認

### 問題 3: 既存のゲームにアクセスできない

**原因**: プレイヤーセッションが正しく設定されていない、またはゲームデータのフォーマットが古い

**解決方法**:

1. ページをリロードしてセッションをリセット
2. ゲームデータの `state.players` 配列に正しくプレイヤーIDが含まれているか確認

## 📊 セキュリティレベル比較

| 項目             | 修正前    | 修正後  |
| ---------------- | --------- | ------- |
| 認証チェック     | ❌ なし   | ✅ あり |
| 認可チェック     | ❌ なし   | ✅ あり |
| Service Role検証 | ⚠️ 部分的 | ✅ 完全 |
| プレイヤーID検証 | ⚠️ 緩い   | ✅ 厳格 |
| データ隔離       | ❌ なし   | ✅ 完全 |

## 🔐 セキュリティベストプラクティス

### 1. Service Role Key の管理

```bash
# ❌ 悪い例: .envファイルをGitにコミット
git add .env

# ✅ 良い例: 環境変数をVercelで管理
# Vercel Dashboard → Settings → Environment Variables
```

### 2. Server Actions の使用

```typescript
// ❌ 悪い例: クライアントから直接データベースにアクセス
const { data } = await supabase.from('game_results').insert({ ... });

// ✅ 良い例: Server Actions経由でアクセス
const result = await saveGameResultAction(gameResult);
```

### 3. プレイヤーセッションの設定

```typescript
// ✅ 必ずプレイヤーセッションを設定
useEffect(() => {
  if (playerId) {
    setPlayerSession(playerId);
  }
}, [playerId]);
```

## 📝 参考資料

- [Supabase RLS Documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [プロジェクトのRLS設定ガイド](./RLS_SETUP.md)
- [開発環境セキュリティ](./DEVELOPMENT_SECURITY.md)

## ✅ チェックリスト

実行前の確認：

- [ ] バックアップを取得した
- [ ] `.env.local` に `SUPABASE_SERVICE_ROLE_KEY` が設定されている
- [ ] 本番環境であることを確認した

実行後の確認：

- [ ] スクリプトがエラーなく完了した
- [ ] RLSが全テーブルで有効になっている
- [ ] Security Advisorの警告が消えた
- [ ] アプリケーションが正常に動作する

---

**最終更新**: 2026-01-09
**バージョン**: 1.0.0
