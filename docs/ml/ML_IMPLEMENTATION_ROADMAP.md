# Machine Learning Implementation Roadmap

## 📋 プロジェクト概要

Napoleon GameのプレイデータをTypeScriptで収集し、Python機械学習モデルで訓練・推論を行うシステムの実装計画。

**目標**: 完全無料インフラでAI強化システムを構築

## 🏗️ アーキテクチャ

```
┌──────────────────────────────────────────────────┐
│  Frontend + Game Logic (Next.js + Vercel) 【無料】│
│  ┌───────────────────────────────────────────┐  │
│  │ TypeScript実装                             │  │
│  │ - ゲームUI・ルーム管理                     │  │
│  │ - 基本的なAI（MCTS）                       │  │
│  │ - ゲームプレイデータ収集 📊               │  │
│  └───────────────┬───────────────────────────┘  │
└──────────────────┼──────────────────────────────┘
                   │
                   │ プレイデータ蓄積
                   │
┌──────────────────▼──────────────────────────────┐
│  Database (Supabase PostgreSQL) 【無料500MB】   │
│  - game_sessions                                │
│  - game_moves (全プレイヤーの手・結果)         │
│  - player_stats                                 │
└──────────────────┬──────────────────────────────┘
                   │
                   │ データ取得・訓練
                   │
┌──────────────────▼──────────────────────────────┐
│  ML Training (Hugging Face Spaces) 【完全無料】 │
│  ┌───────────────────────────────────────────┐  │
│  │ Python + Fast API + Gradio                │  │
│  │ - 教師あり学習（プレイデータから学習）    │  │
│  │ - AIパラメータ最適化                      │  │
│  │ - 勝率予測モデル訓練                      │  │
│  └───────────────┬───────────────────────────┘  │
└──────────────────┼──────────────────────────────┘
                   │
                   │ REST API
                   │
┌──────────────────▼──────────────────────────────┐
│  ML Inference API (Hugging Face) 【完全無料】   │
│  - 学習済みモデルで推論                         │
│  - Next.jsから呼び出し                          │
└─────────────────────────────────────────────────┘
```

## 🎯 実装フェーズ

### ✅ Phase 0: 準備（完了）

- [x] TypeScriptバージョンアップ（6.0系）
- [x] 依存関係の最新化
- [x] ビルド・テスト確認

### ✅ Phase 1: データ収集基盤構築（完了）

**期間**: 1週間
**PR**: #237 (feature/ml-data-collection)

**実装内容**:

- [x] Supabase `ml_training_data` テーブル作成
- [x] TypeScript Server Actions実装
  - `recordGameMove()`: カードプレイ記録
  - `updateGameResult()`: ゲーム結果更新
  - `extractMLTrainingData()`: データ抽出ヘルパー
- [x] 既存ゲームロジックへの統合
  - `playCardAction()`: データ収集処理追加
  - `calculateGameResultAction()`: 結果更新処理追加
- [x] ドキュメント作成
  - SQLスキーマ
  - セットアップガイド
  - 使用方法ガイド

**成果物**:

- `docs/database/ml_training_data_schema.sql`
- `src/app/actions/mlDataCollectionActions.ts`
- `src/lib/ml/dataExtractor.ts`
- `docs/database/ML_DATA_COLLECTION.md`
- `docs/ml/DATA_COLLECTION_USAGE.md`

**次のアクション**:

1. PR #237をマージ
2. Supabaseでテーブル作成
3. ゲームプレイでデータ収集開始

---

### 🔄 Phase 2: 初期データ収集

**期間**: 1-2週間
**目標**: 100ゲーム（約4,800レコード）

**タスク**:

- [ ] Supabaseでテーブル作成（`ml_training_data_schema.sql`実行）
- [ ] データ収集の動作確認
- [ ] AI vs AI で自動的にゲームプレイ
- [ ] データ品質チェック
  - 各役割（napoleon/adjutant/allied）でバランス良く
  - AI難易度別でバランス良く
  - ゲーム結果の記録確認

**データ収集状況確認**:

```sql
-- 全体統計
SELECT * FROM ml_training_stats;

-- 役割別統計
SELECT * FROM ml_training_role_stats;

-- AI難易度別統計
SELECT * FROM ml_training_ai_stats;
```

**成功基準**:

- 100ゲーム以上のデータ蓄積
- 全役割で均等なデータ分布
- エラー率5%以下

---

### 🐍 Phase 3: Python機械学習基盤構築

**期間**: 1週間

#### 3.1 Hugging Face Spacesセットアップ

**タスク**:

- [ ] Hugging Face アカウント作成
- [ ] 新しいSpaceを作成
  - Name: `napoleon-ml-trainer`
  - SDK: Gradio
  - Hardware: CPU (無料)
- [ ] 環境変数設定
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`

#### 3.2 Fast API + Gradio実装

**ファイル構成**:

```
napoleon-ml-trainer/  (Hugging Face Space)
├── app.py           # Gradio UI + Fast API
├── requirements.txt
├── model/
│   ├── train.py     # モデル訓練スクリプト
│   ├── predict.py   # 推論スクリプト
│   └── models/      # 学習済みモデル保存
└── data/
    └── fetch_data.py  # Supabaseからデータ取得
```

**requirements.txt**:

```txt
fastapi
gradio
uvicorn
supabase
pandas
numpy
scikit-learn
joblib
```

**app.py 実装内容**:

- Supabaseからデータ取得
- カード選択予測モデル訓練
- REST APIエンドポイント
- Gradio UI（訓練・推論テスト）

#### 3.3 機械学習モデル実装

**モデル1: カード選択予測**

**入力特徴量**:

- 手札の枚数
- 各スートの枚数（スペード、ハート、ダイヤ、クラブ）
- 高ランクカード（J,Q,K,A）の枚数
- 場に出ているカードの情報
- トリック番号
- 役割（napoleon/adjutant/allied）

**出力**:

- 選択すべきカード（52種類のいずれか）

**アルゴリズム**:

- Random Forest Classifier（初期実装）
- 理由: 高速、解釈可能、中程度のデータ量で高精度

**訓練スクリプト**:

```python
from sklearn.ensemble import RandomForestClassifier
import joblib

def train_card_prediction_model():
    # Supabaseからデータ取得
    df = fetch_training_data()

    # 特徴量エンジニアリング
    X, y = extract_features(df)

    # Random Forest訓練
    model = RandomForestClassifier(n_estimators=100, max_depth=10)
    model.fit(X, y)

    # モデル保存
    joblib.dump(model, "model/card_predictor.pkl")
```

**成功基準**:

- モデル精度50%以上（ランダムより良い）
- 推論速度100ms以下
- Gradio UIで訓練・推論が動作

---

### 🔗 Phase 4: Next.js統合

**期間**: 3-5日

#### 4.1 MLクライアント実装

**新ファイル**: `src/lib/ml/mlClient.ts`

```typescript
const ML_API_URL =
  process.env.NEXT_PUBLIC_ML_API_URL || 'https://YOUR_HF_SPACE.hf.space';

export async function predictBestCard(gameState: {
  hand: Card[];
  tableCards: Card[];
  trickNumber: number;
  role: 'napoleon' | 'adjutant' | 'allied';
}) {
  const response = await fetch(`${ML_API_URL}/api/predict-card`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(gameState),
  });

  return await response.json();
}
```

#### 4.2 AI対戦モードでML活用

**修正ファイル**: `src/lib/ai/aiStrategy.ts`

```typescript
export async function getMLEnhancedAIMove(
  gameState: GameState,
  playerId: string
): Promise<Card> {
  // MLモデルで予測
  const prediction = await predictBestCard({...})

  // 信頼度が低い場合は従来のMCTSにフォールバック
  if (prediction.confidence < 0.6) {
    return selectCardWithMCTS(gameState, playerId)
  }

  return prediction.predicted_card
}
```

**タスク**:

- [ ] `mlClient.ts` 実装
- [ ] 環境変数 `NEXT_PUBLIC_ML_API_URL` 追加
- [ ] AI戦略にML推論を統合
- [ ] フォールバックロジック実装（ML失敗時はMCTS）
- [ ] エラーハンドリング

**成功基準**:

- ML推論が動作（ネットワークエラー時も正常動作）
- レスポンスタイム500ms以下
- ゲームプレイに支障なし

---

### 📊 Phase 5: モデル評価・改善

**期間**: 1週間

#### 5.1 モデル精度評価

**評価指標**:

- **正解率（Accuracy）**: 正しいカードを選択した割合
- **Top-3正解率**: 上位3候補に正解が含まれる割合
- **役割別精度**: napoleon/adjutant/allied別の精度
- **AI難易度別精度**: easy/medium/hard別の精度

**評価スクリプト**:

```python
def evaluate_model():
    # テストデータで評価
    y_pred = model.predict(X_test)

    accuracy = accuracy_score(y_test, y_pred)
    top3_accuracy = top_k_accuracy_score(y_test, y_pred_proba, k=3)

    print(f"Accuracy: {accuracy:.2%}")
    print(f"Top-3 Accuracy: {top3_accuracy:.2%}")
```

#### 5.2 データ拡充

**目標**: 500ゲーム（約24,000レコード）

**タスク**:

- [ ] さらにゲームプレイでデータ収集
- [ ] データバランス確認
- [ ] 異常データのクレンジング
- [ ] モデル再訓練

#### 5.3 ハイパーパラメータチューニング

```python
from sklearn.model_selection import GridSearchCV

param_grid = {
    'n_estimators': [50, 100, 200],
    'max_depth': [5, 10, 15],
    'min_samples_split': [2, 5, 10]
}

grid_search = GridSearchCV(RandomForestClassifier(), param_grid, cv=5)
grid_search.fit(X_train, y_train)
```

**成功基準**:

- モデル精度60%以上
- Top-3精度85%以上
- 全役割で平均的な精度

---

### 🚀 Phase 6: 高度な機能実装（オプション）

**期間**: 2-3週間

#### 6.1 勝率予測モデル

**目的**: 現在のゲーム状態から勝率を予測

**入力**:

- 現在の手札
- 取得済み絵札数
- 残りトリック数
- 役割

**出力**:

- ナポレオン陣営の勝率（0-1）

**活用方法**:

- UIに勝率表示
- AI戦略の最適化

#### 6.2 プレイヤースキル推定

**目的**: プレイヤーの実力を推定

**手法**:

- Eloレーティングシステム
- 機械学習による特徴抽出

**活用方法**:

- マッチメイキング
- AI難易度の自動調整

#### 6.3 ディープラーニングモデル

**より高精度なモデルへの移行**:

- TensorFlow/PyTorch実装
- ニューラルネットワーク
- 特徴量自動学習

**注意**: 計算リソース増加の可能性

---

## 💰 コスト見積もり

| サービス            | 無料枠    | 予想コスト |
| ------------------- | --------- | ---------- |
| Vercel              | 100GB転送 | $0（既存） |
| Supabase            | 500MB DB  | $0（既存） |
| Hugging Face Spaces | 完全無料  | $0         |
| **合計**            | -         | **$0**     |

**ストレージ見積もり**:

- 1レコード: 約1KB
- 100ゲーム: 約4.8MB
- 1,000ゲーム: 約48MB
- 500MB = 約10,000ゲーム分

---

## 📋 チェックリスト

### Phase 1: データ収集基盤 ✅

- [x] Supabaseテーブル設計
- [x] TypeScript実装
- [x] ドキュメント作成
- [x] PR作成・レビュー

### Phase 2: 初期データ収集

- [ ] Supabaseセットアップ
- [ ] データ収集開始
- [ ] 100ゲーム達成
- [ ] データ品質確認

### Phase 3: Python ML基盤

- [ ] Hugging Face Spacesセットアップ
- [ ] Fast API + Gradio実装
- [ ] カード予測モデル訓練
- [ ] REST API動作確認

### Phase 4: Next.js統合

- [ ] MLクライアント実装
- [ ] AI戦略への統合
- [ ] エラーハンドリング
- [ ] E2Eテスト

### Phase 5: モデル評価・改善

- [ ] 精度評価
- [ ] データ拡充（500ゲーム）
- [ ] ハイパーパラメータチューニング
- [ ] モデル再訓練

### Phase 6: 高度な機能（オプション）

- [ ] 勝率予測モデル
- [ ] スキル推定
- [ ] ディープラーニング

---

## 🔧 トラブルシューティング

### よくある問題

**1. Hugging Face Spacesがスリープする**

- **症状**: 5分間アクセスがないとスリープ
- **対策**: 初回リクエストは遅い（10-15秒）が正常動作
- **解決策**: ローディング表示を追加

**2. モデル精度が低い**

- **原因**: データ量不足
- **対策**: 最低500ゲーム以上のデータ収集
- **解決策**: データバランスを確認

**3. Supabase容量不足**

- **原因**: 500MB上限
- **対策**: 定期的なクレンジング
- **解決策**: 古いデータ削除（90日以上）

---

## 📚 関連ドキュメント

- [ML_DATA_COLLECTION.md](../database/ML_DATA_COLLECTION.md) - データベース詳細
- [DATA_COLLECTION_USAGE.md](./DATA_COLLECTION_USAGE.md) - 使用方法
- [ml_training_data_schema.sql](../database/ml_training_data_schema.sql) - SQLスキーマ

---

## 📝 更新履歴

- 2026-04-03: 初版作成（Phase 1完了時点）
- Phase 2開始時に更新予定
