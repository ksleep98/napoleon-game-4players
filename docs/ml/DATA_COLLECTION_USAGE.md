# Machine Learning Data Collection - 使用方法

## 📋 概要

Napoleon Gameのプレイデータを自動的に収集し、機械学習モデルの訓練に使用するシステムです。

## ✅ 実装完了項目

### 1. Supabaseテーブル

- ✅ `ml_training_data` テーブル作成
- ✅ インデックス設定（高速クエリ）
- ✅ RLSポリシー設定（セキュリティ）
- ✅ 統計ビュー作成

### 2. TypeScript実装

- ✅ Server Actions実装
  - `recordGameMove()` - カードプレイ記録
  - `updateGameResult()` - ゲーム結果更新
  - `extractMLTrainingData()` - データ抽出ヘルパー
- ✅ 既存ゲームロジックへの統合
  - `playCardAction()` にデータ収集処理追加
  - `calculateGameResultAction()` に結果更新処理追加

## 🎮 データ収集の仕組み

### 自動収集フロー

```
1. プレイヤーがカードを選択
   ↓
2. playCardAction() 実行
   ↓
3. カードプレイ前の状態を記録
   - プレイヤーの手札
   - 場に出ているカード
   - 現在のスート・切り札
   - プレイヤーの役割
   ↓
4. 選択したカードを記録
   ↓
5. MLデータベースに保存（非同期）
   ↓
6. ゲーム続行（データ収集エラーでも影響なし）

---

ゲーム終了時:

1. calculateGameResultAction() 実行
   ↓
2. ゲーム結果を計算
   - 勝者: ナポレオン陣営 or 連合軍
   - 各プレイヤーのスコア
   ↓
3. MLデータベースの全レコードを更新
   - game_result 列を更新
   - player_final_score 列を更新
   ↓
4. 機械学習の訓練データとして利用可能
```

## 📊 収集されるデータ

### ゲームプレイ中（各カードプレイ時）

| 項目            | 説明               | 例                                     |
| --------------- | ------------------ | -------------------------------------- |
| `game_id`       | ゲームセッションID | `uuid`                                 |
| `player_id`     | プレイヤーID       | `uuid`                                 |
| `trick_number`  | トリック番号       | `0-12`                                 |
| `hand`          | プレイヤーの手札   | `[{suit: "spade", rank: "A"}, ...]`    |
| `table_cards`   | 場に出ているカード | `[{suit: "heart", rank: "K"}, ...]`    |
| `current_suit`  | リードスート       | `"spade"`                              |
| `trump_suit`    | 切り札スート       | `"heart"`                              |
| `selected_card` | 選択したカード     | `{suit: "spade", rank: "A"}`           |
| `role`          | プレイヤーの役割   | `"napoleon"`, `"adjutant"`, `"allied"` |
| `is_ai_player`  | AIプレイヤーか     | `true/false`                           |
| `ai_difficulty` | AI難易度           | `"easy"`, `"medium"`, `"hard"`         |

### ゲーム終了後（結果更新）

| 項目                 | 説明                   | 例                               |
| -------------------- | ---------------------- | -------------------------------- |
| `game_result`        | ゲーム結果             | `"napoleon_win"`, `"allied_win"` |
| `player_final_score` | プレイヤーの最終スコア | `100`                            |

## 🔍 データ収集状況の確認

### Supabaseダッシュボードで確認

```sql
-- 全体統計
SELECT * FROM ml_training_stats;

-- 結果例:
-- total_records: 1200
-- total_games: 100
-- total_players: 400
-- completed_games: 100
-- ai_moves: 900
-- human_moves: 300
```

### 役割別統計

```sql
SELECT * FROM ml_training_role_stats;

-- 結果例:
-- role       | game_result    | move_count | game_count | avg_score
-- napoleon   | napoleon_win   | 300        | 25         | 120.50
-- napoleon   | allied_win     | 300        | 25         | 80.25
-- adjutant   | napoleon_win   | 300        | 25         | 90.75
-- allied     | allied_win     | 600        | 50         | 110.00
```

### AI難易度別統計

```sql
SELECT * FROM ml_training_ai_stats;

-- 結果例:
-- ai_difficulty | move_count | game_count | wins | completed
-- easy          | 300        | 25         | 10   | 25
-- medium        | 300        | 25         | 15   | 25
-- hard          | 300        | 25         | 20   | 25
```

## 🎯 データ収集目標

### Phase 1: 初期データ収集（1-2週間）

- **目標**: 100ゲーム（約4,800レコード）
- **内訳**:
  - AI vs AI: 50ゲーム
  - 人間 vs AI: 50ゲーム
- **用途**: 基本的なカード選択モデルの訓練

### Phase 2: データ拡充（2-4週間）

- **目標**: 500ゲーム（約24,000レコード）
- **内訳**:
  - 各AI難易度でバランス良く
  - 各役割（ナポレオン、副官、連合軍）でバランス良く
- **用途**: 高精度な予測モデルの訓練

### Phase 3: 本番データ収集（継続）

- **目標**: 1,000ゲーム以上
- **用途**: モデルの継続的改善

## 🚀 次のステップ

### 1. Supabaseセットアップ（すぐに実行）

```bash
# 1. Supabase Dashboardにアクセス
# https://supabase.com/dashboard/project/YOUR_PROJECT_ID

# 2. SQL Editorを開く

# 3. docs/database/ml_training_data_schema.sql の内容を実行
```

### 2. 動作確認

```bash
# 開発サーバー起動
pnpm dev

# ゲームをプレイしてデータ収集をテスト
# 1. Quick Start でゲーム開始
# 2. 数回カードをプレイ
# 3. Supabaseで確認:

SELECT COUNT(*) FROM ml_training_data;
# → 0より大きい数字が返ればOK
```

### 3. データ収集開始

```bash
# 複数回ゲームをプレイして100ゲーム以上を目指す
# AI vs AI なら自動的に進むので効率的
```

### 4. Python機械学習実装（次フェーズ）

- Hugging Face Spacesセットアップ
- Gradio + Fast API実装
- モデル訓練スクリプト作成
- Next.jsからの呼び出し実装

## ⚠️ 注意事項

### パフォーマンス

- **非同期実行**: データ収集は非同期で実行されるため、ゲームプレイに影響なし
- **エラーハンドリング**: データ収集エラーでもゲームは続行

### プライバシー

- **匿名データ**: プレイヤーIDはUUIDのため個人特定不可
- **ゲームデータのみ**: 個人情報は一切収集しません

### ストレージ管理

- **Supabase無料枠**: 500MBまで
- **1レコード**: 約1KB
- **500MBで約50万レコード** = 約10,000ゲーム分

定期的にクレンジング推奨:

```sql
-- 90日以上前のデータを削除
SELECT cleanup_old_training_data(90);
```

## 🐛 トラブルシューティング

### データが保存されない

**確認1: RLSポリシー**

```sql
SELECT * FROM pg_policies WHERE tablename = 'ml_training_data';
```

**確認2: テーブル存在**

```sql
SELECT * FROM information_schema.tables
WHERE table_name = 'ml_training_data';
```

**確認3: エラーログ**
ブラウザのコンソールで `[ML Data Collection]` を検索

### データ収集が遅い

- **非同期実行**: 通常のゲームプレイには影響なし
- **インデックス**: 既に最適化済み
- **ストレージ**: 500MB上限に注意

## 📖 関連ドキュメント

- [ML_DATA_COLLECTION.md](../database/ML_DATA_COLLECTION.md) - データベース詳細
- [ml_training_data_schema.sql](../database/ml_training_data_schema.sql) - SQLスキーマ
- [mlDataCollectionActions.ts](../../src/app/actions/mlDataCollectionActions.ts) - TypeScript実装
