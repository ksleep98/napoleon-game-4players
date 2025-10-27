# Supabase Keep-Alive ワークフローへの影響分析

## 📊 RLS修正前後の比較

### 修正前（脆弱なポリシー）

```sql
-- players テーブル
CREATE POLICY "players_select_policy" ON players
  FOR SELECT USING (
    (id = get_current_player_id()) OR (get_current_player_id() IS NOT NULL)
  );
```

**Keep-Aliveクエリ**: `SELECT id FROM players LIMIT 1`

- ✅ 動作: 成功（`get_current_player_id() IS NOT NULL` で匿名アクセス可能）
- ⚠️ セキュリティ: 脆弱（認証済みなら誰のデータでも閲覧可能）

---

### 修正後（セキュアなポリシー）

```sql
-- players テーブル
CREATE POLICY "players_select_policy" ON players
  FOR SELECT USING (
    is_service_role_authenticated()
    OR id = get_current_player_id()
  );
```

**Keep-Aliveクエリ**: `SELECT id FROM players LIMIT 1`

- ❌ 動作: **失敗する可能性あり**
- 理由: `get_current_player_id()` が NULL の場合、アクセス拒否
- ✅ セキュリティ: セキュア（自分のデータのみ）

---

## 🔧 Keep-Aliveワークフローの修正が必要

### 現在のワークフロー

```yaml
# .github/workflows/supabase-keep-alive.yml
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "apikey: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  -H "Authorization: Bearer ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  "${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}/rest/v1/players?select=id&limit=1")
```

**問題**: `anon_key` では `get_current_player_id()` が NULL → アクセス拒否

---

## ✅ 推奨される修正方法

### Option A: game_rooms テーブルを使用（推奨）

```yaml
# waiting状態のルームは全員が閲覧可能（新RLSポリシー）
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "apikey: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  -H "Authorization: Bearer ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  "${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}/rest/v1/game_rooms?select=id&status=eq.waiting&limit=1")
```

**メリット**:

- ✅ RLSポリシーに準拠（waiting状態は全員閲覧可）
- ✅ `anon_key` で動作
- ✅ セキュア

**デメリット**:

- ⚠️ waiting状態のルームがない場合、空の配列を返す（HTTP 200だが、データなし）

---

### Option B: RPC関数を使用

新しいRPC関数を作成:

```sql
-- Supabaseで実行
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
  RETURN 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 公開アクセスを許可
GRANT EXECUTE ON FUNCTION health_check() TO anon;
```

ワークフローを更新:

```yaml
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "apikey: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  -H "Authorization: Bearer ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  "${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}/rest/v1/rpc/health_check")
```

**メリット**:

- ✅ RLSの影響を受けない
- ✅ 軽量（テーブルアクセス不要）
- ✅ 確実にインスタンスを起動

**デメリット**:

- 新しい関数の作成が必要

---

### Option C: REST API root endpoint（現在使用中の開発環境）

```yaml
# OpenAPI仕様を返す（常に成功）
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "apikey: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  -H "Authorization: Bearer ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  "${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}/rest/v1/")
```

**メリット**:

- ✅ RLSの影響を受けない
- ✅ テーブルアクセス不要
- ✅ 常に成功（HTTP 200）

**デメリット**:

- ⚠️ 開発環境では401エラー（過去の経緯）
- 本番環境では成功（確認済み）

---

## 🎯 推奨: Option B（health_check関数）

最もシンプルで確実な方法です。

### 実装手順

#### 1. Supabaseで関数を作成

```sql
-- Supabase Dashboard > SQL Editor で実行
CREATE OR REPLACE FUNCTION health_check()
RETURNS TEXT AS $$
BEGIN
  RETURN 'OK';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 公開アクセスを許可
GRANT EXECUTE ON FUNCTION health_check() TO anon;
GRANT EXECUTE ON FUNCTION health_check() TO authenticated;
```

#### 2. ワークフローを更新

```yaml
# .github/workflows/supabase-keep-alive.yml

# 開発環境
- name: Health Check Development Database
  continue-on-error: true
  run: |
    echo "Health checking development database..."

    RESPONSE=$(curl -s -w "\n%{http_code}" \
      -H "apikey: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
      -H "Authorization: Bearer ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
      "${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}/rest/v1/rpc/health_check")

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    echo "Response code: $HTTP_CODE"
    echo "Response: $BODY"

    if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
      echo "✅ Development database health check successful"
    else
      echo "⚠️ Development database health check returned status $HTTP_CODE"
      exit 1
    fi

# 本番環境も同様に更新
```

#### 3. テスト

```bash
# ローカルでテスト
curl -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  "YOUR_SUPABASE_URL/rest/v1/rpc/health_check"

# 期待される結果: "OK"
```

---

## 📝 実装チェックリスト

- [ ] `health_check()` 関数を開発環境に作成
- [ ] `health_check()` 関数を本番環境に作成
- [ ] ワークフローファイルを更新
- [ ] ローカルでテスト実行
- [ ] GitHub Actionsで手動実行テスト
- [ ] ドキュメント更新

---

## ⏱️ 実装タイミング

**RLS修正と同時に実行することを推奨**

理由:

1. RLS修正後、現在のkeep-aliveが失敗する可能性
2. 同時に修正すれば、ダウンタイムなし
3. テストも一度に完了

---

## 🔄 代替案: game_roomsを使う場合の注意点

もし `game_rooms` を使用する場合:

```yaml
# waiting状態のルームがない場合の対策
RESPONSE=$(curl -s -w "\n%{http_code}" \
  -H "apikey: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  -H "Authorization: Bearer ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}" \
  "${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}/rest/v1/game_rooms?select=id&limit=1")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

# HTTP 200でも、空配列 "[]" の場合は成功と見なす
if [ "$HTTP_CODE" -ge 200 ] && [ "$HTTP_CODE" -lt 300 ]; then
  echo "✅ Database health check successful"
else
  echo "⚠️ Database health check failed"
  exit 1
fi
```

データの有無に関わらず、HTTP 200であればインスタンスは起動します。
