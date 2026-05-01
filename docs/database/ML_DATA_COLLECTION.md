# Machine Learning Data Collection Setup

## 概要

Napoleon Gameのプレイデータを収集し、機械学習モデルの訓練に使用するためのセットアップガイドです。

## 📋 セットアップ手順

### 1. Supabaseでテーブルを作成

1. **Supabase Dashboardにアクセス**
   - https://supabase.com/dashboard/project/YOUR_PROJECT_ID

2. **SQL Editorを開く**
   - 左メニューから `SQL Editor` を選択

3. **SQLを実行**
   - `docs/database/ml_training_data_schema.sql` の内容をコピー
   - SQL Editorに貼り付け
   - `Run` ボタンをクリック

4. **テーブル作成確認**
   ```sql
   SELECT table_name
   FROM information_schema.tables
   WHERE table_schema = 'public'
     AND table_name = 'ml_training_data';
   ```

### 2. データ収集の確認

作成したビューで統計を確認：

```sql
-- 全体統計
SELECT * FROM ml_training_stats;

-- 役割別統計
SELECT * FROM ml_training_role_stats;

-- AI難易度別統計
SELECT * FROM ml_training_ai_stats;
```

## 📊 データスキーマ

### `ml_training_data` テーブル

| カラム名             | 型        | 説明                                  |
| -------------------- | --------- | ------------------------------------- |
| `id`                 | UUID      | 主キー                                |
| `game_id`            | UUID      | ゲームセッションID                    |
| `player_id`          | UUID      | プレイヤーID                          |
| `trick_number`       | INT       | トリック番号（0-12）                  |
| `hand`               | JSONB     | プレイヤーの手札                      |
| `table_cards`        | JSONB     | 場に出ているカード                    |
| `current_suit`       | TEXT      | 現在のスート                          |
| `trump_suit`         | TEXT      | 切り札スート                          |
| `selected_card`      | JSONB     | 選択したカード                        |
| `game_phase`         | TEXT      | ゲームフェーズ（PLAYING）             |
| `role`               | TEXT      | 役割（napoleon/adjutant/allied）      |
| `is_napoleon_team`   | BOOLEAN   | ナポレオン陣営か                      |
| `game_result`        | TEXT      | ゲーム結果（napoleon_win/allied_win） |
| `player_final_score` | INT       | プレイヤーの最終スコア                |
| `is_ai_player`       | BOOLEAN   | AIプレイヤーか                        |
| `ai_difficulty`      | TEXT      | AI難易度（easy/medium/hard）          |
| `created_at`         | TIMESTAMP | 作成日時                              |

### JSONBフォーマット例

**hand / table_cards:**

```json
[
  { "suit": "spade", "rank": "A" },
  { "suit": "heart", "rank": "K" },
  { "suit": "diamond", "rank": "Q" }
]
```

**selected_card:**

```json
{ "suit": "spade", "rank": "A" }
```

## 🔍 データ分析クエリ例

### 1. データ収集状況の確認

```sql
-- 直近のデータ収集状況
SELECT
  DATE(created_at) as date,
  COUNT(*) as moves,
  COUNT(DISTINCT game_id) as games
FROM ml_training_data
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### 2. 特定ゲームのプレイデータ取得

```sql
SELECT
  trick_number,
  role,
  selected_card,
  table_cards
FROM ml_training_data
WHERE game_id = 'YOUR_GAME_ID'
ORDER BY trick_number;
```

### 3. AI vs 人間のプレイスタイル比較

```sql
SELECT
  is_ai_player,
  role,
  COUNT(*) as total_moves,
  AVG(JSONB_ARRAY_LENGTH(hand)) as avg_hand_size
FROM ml_training_data
GROUP BY is_ai_player, role;
```

## 🧹 メンテナンス

### 古いデータの削除（90日以上前）

```sql
SELECT cleanup_old_training_data(90);
```

### 重複データの削除

```sql
SELECT remove_duplicate_training_data();
```

### ストレージ使用量の確認

```sql
SELECT
  pg_size_pretty(pg_total_relation_size('ml_training_data')) as total_size,
  COUNT(*) as record_count
FROM ml_training_data;
```

## 🚀 次のステップ

1. ✅ Supabaseテーブル作成完了
2. 🔄 TypeScriptでデータ収集実装 → `src/app/actions/mlDataCollectionActions.ts`
3. 🔄 ゲームロジックへの統合
4. 🔄 100ゲーム以上のデータ収集
5. ⏳ Python機械学習モデル構築

## 📝 注意事項

- **プライバシー**: 個人を特定できる情報は収集しません
- **ストレージ**: Supabase無料枠は500MBまで（定期的なクレンジング推奨）
- **パフォーマンス**: インデックスが適切に設定されているため、クエリは高速です

## 🐛 トラブルシューティング

### エラー: "permission denied for table ml_training_data"

RLSポリシーを確認：

```sql
SELECT * FROM pg_policies WHERE tablename = 'ml_training_data';
```

### データが保存されない

Server Actionsのエラーログを確認：

```typescript
console.error('ML data collection error:', error);
```
