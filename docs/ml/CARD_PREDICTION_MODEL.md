# カード選択モデルの作り直し（52クラス分類 → 候補スコアリング）

**日付**: 2026-08-01
**対象**: `python/model/features.py`, `python/model/train.py`, `python/app.py`
**データ**: `ml_training_data` 34,840 行 / 903 ゲーム（`game_result` 確定済みのみ）

## 要約

52 クラス分類（カード52枚のどれかを当てる）を、**合法手 1 枚ごとの 2 値分類**に
組み替えた。同じデータ・同じ分割（ゲーム単位 GroupShuffleSplit, seed=42）で、
実プレイと同じ「合法手の中での argmax」を測ると **57.28% → 66.04%**。
top-1 confidence の中央値は **0.219 → 0.588** になり、confidence が「合法手の中で
この手が選ばれる確率」という意味を取り戻した。

## なぜ学習が進まなかったのか

### 1. 特徴量が「どのカードを持っているか」を一切表現していなかった（最重要）

旧 `python/model/features.py:45-113`（`_row_features`）が作る 30 次元は、
手札について **スート別枚数・J/Q/K/A の枚数・最大値・最小値** しか持たない。
一方でラベルは `python/model/features.py:139` の通り「選んだカードの 0..51 の
クラス番号」。

つまり **♠7 と ♠3 を区別する情報が入力に存在しないのに、♠7 か ♠3 かを当てろ**
という問題設定になっていた。ターゲットが入力の関数になっていないので、木がどれだけ
増えてもここは埋まらない。`python/README.md:94-100` に記録された「27,664 行でも
27.94%、526 ゲーム時点の 26% からほとんど動かなかった」という観測は、データ不足では
なくこの構造的欠陥の帰結である。

再現（本作業で確認、34,840 行）: accuracy 27.12% / top-3 51.96%。

### 2. 推論時に確率を再正規化していなかった

旧 `python/app.py:128-144` は 52 枚分の確率のうち手札にあるカードだけを抜き出して
**そのまま**返していた。確率質量の大半（手札にない 42 枚分）は捨てられるので、
返る confidence は必ず小さくなる。実プレイの top-1 confidence が 0.10〜0.25 に
張り付いていた直接の原因はこれで、モデルの不確かさとは別物だった。

`src/lib/ai/aiStrategy.ts` の `ML_CONFIDENCE_THRESHOLD` を 0.6 → 0.2 に下げていたのは、
この「正規化し忘れ」に閾値側で辻褄を合わせていたということになる。

### 3. 評価指標が実運用とズレていた

旧 `python/model/train.py:94-105` は 52 クラス上の argmax で accuracy を出していた。
実プレイでは `src/lib/ai/aiStrategy.ts:278-302` が合法手だけを採用するので、
非合法カードへの誤りは実害がない。指標が実態より悲観的に出ていた。

参考までに、同じ旧モデルに合法手マスク＋再正規化をかけるだけで
**27.12% → 57.28%**、confidence 中央値 0.219 → 0.587 になる。旧モデルの
「性能」の大半は、測り方と返し方の問題だった。

### 4. 5 ゲーム未満のときの行単位分割はリークだった

旧 `python/model/train.py:52-63` は、ゲームが 5 未満だと行単位 `train_test_split` に
フォールバックしていた（警告付き）。同一ゲームの手が train/test 両側に入るため
リークになる。今回は「2 ゲーム未満なら学習しない」に変更した。
**ゲームが十分ある本番データではこの経路は通っていないので、上記 26〜28% の数字が
このリークで歪んでいたわけではない。**

### 5. `trump_suit` が NaN の行でクラッシュしうる

Supabase の NULL は pandas 上 `float('nan')` になる。裏スート（`COUNTER_SUITS`）の
ような dict 参照に素で渡すと `KeyError: nan` になる。実データにも該当行があった
（`python/model/features.py` の `normalize_suit` で一元的に潰した）。

## 何を変えたか

### `python/model/features.py`

- 旧 52 クラス用 API（`build_feature_matrix` ほか）は**そのまま残した**。
  過去のモデルとテストが読めなくなるのを避けるため。
- 追加:
  - `card_strength()` — `src/lib/napoleonCardRules.ts` の `getCardStrength` の移植。
    Mighty(♠A) / 正 J / 裏 J / 切り札 / リードスート の序列、および 1 トリック目は
    通常の切り札特権が効かないルールを含む。
  - `legal_cards()` — `src/lib/ai/gameSimulator.ts` の `getPlayableCards` の移植。
    保存済み `current_suit` ではなく `table_cards[0].suit` から導出する
    （トリック確定時に `leadingSuit` が undefined に戻るため、空テーブルなのに
    `current_suit` が残った行と食い違わないようにする）。
  - `build_candidate_features()` — 合法手 1 枚につき 1 行、41 次元。
    **学習時も推論時もこの同じ関数を通す**ので train/serve skew が構造的に起きない。
  - `build_candidate_dataset()` — DataFrame を展開して `(X, y, decision_ids, groups)`。
    選択カードが合法手に含まれない壊れた行は捨てる。

特徴量 41 次元の内訳は `CANDIDATE_FEATURE_NAMES` を参照。要点は、旧設計に無かった
**候補カード自身の情報**（値・ランク・強さ・切り札か・リードスートか・Mighty/正J/裏J/
♥Q/同色2 か・得点札か）と、**合法手集合の中での相対位置**（強さ順位・値順位・最弱/最強か）、
**場との関係**（場の最強手に勝てるか・強さの差）を入れたこと。

### `python/model/train.py`

- 学習器: `RandomForestClassifier(n_estimators=400, min_samples_leaf=2)` の 2 値分類。
  `CalibratedClassifierCV(isotonic)` は外した。合法手内で正規化すれば confidence は
  そのまま使えるので、cv=3 のコスト（fit 3 倍）に見合わない。
  `min_samples_leaf` は 1/2/5/10 を実データで比較して 2 が最良（66.04 / 65.78 /
  65.14 / 65.12%）。`n_estimators` は 400 で飽和（800 にしても改善せず）。
- 評価を `evaluate_decisions()` に集約し、**決定単位**で測る:
  accuracy / top-3 / 強制手を除いた accuracy / confidence 分布 /
  閾値ごとの採用率と的中率。
- ベースラインを「52 分の 1」ではなく「合法手からの一様ランダム」に変更（42.08%）。
  52 クラスの 1.92% と比べるのは実態からかけ離れている。
- 保存 payload に `model_type` / `schema_version` / `accuracy_non_forced` /
  `random_legal_baseline` を追加。

### `python/app.py`

- `_predict()` が `build_candidate_features()` で**合法手だけ**をスコアリングし、
  その中で正規化してから返す。返る `confidence` は「合法手の中での選択確率」。
- 旧形式（`model_type` が無い）のモデルが置かれていた場合は 503 と再学習の指示を返す。
  `src/lib/ml/mlClient.ts` は 503 をソフトミス扱いにする（警告も出さない）ので、
  AI は静かに MCTS へフォールバックする。
- `/api/health` に `model_type` / `schema_version` / `accuracy_non_forced` /
  `random_legal_baseline` を追加。

### 入力検証（`python/app.py`、セキュリティレビュー指摘）

推論エンドポイントは無認証なので、境界をルール上の値で閉じた。

- `Card.rank` を `Literal["2"…"A"]` に。`features.RANK_TO_IDX` の dict キーとして
  使われるため、未知のランクが `KeyError` → 500 になっていた
  （`suit` は元から `Literal` で弾けていたのに `rank` だけ素の `str` だった）。
- `Card.value` に `ge=1, le=14`。`10**400` は `OverflowError`、`10**39` は float32 の
  `inf` になってどちらも 500 になっていた。
- `hand` に `max_length=13`、`table_cards` に `max_length=4`。候補スコアリングは
  合法手 1 枚 = 1 行を推論するため、コストが手札長に比例する。

3 系統とも 422 になることを `python/tests/test_app.py` で回帰テスト化した。

### TS ↔ Python のルール移植ズレ検知

`card_strength` と `legal_cards` は TypeScript の移植なので、片方だけ変わると
学習も推論も静かに壊れる。テストが別言語に分かれているため通常のテストでは
検知できない。

- `scripts/dump-rule-fixtures.ts`（`pnpm ml:fixtures`）が TS 側の出力を
  `python/tests/fixtures/rules.json` に書き出す。
  `getCardStrength` は 52 枚 × 4 切札 × 4 リード × 2 = **1,664 通り全数**、
  `getPlayableCards` は固定シード（mulberry32, seed=20260801）の **500 ケース**。
- `python/tests/test_rule_parity.py` が全件突き合わせる。失敗時は
  「TS を変えたなら `pnpm ml:fixtures` で再生成」と表示する。
- `.github/workflows/python-lint.yml` に `pytest` ステップを追加した。
  **これが無いと Python のテストは CI で一切走っていなかった**（ruff/black のみ）。
  移植元の `src/lib/napoleonCardRules.ts` / `src/lib/ai/gameSimulator.ts` /
  `scripts/dump-rule-fixtures.ts` も同ワークフローの起動パスに追加してある。
- 同ワークフローの `uv sync --frozen` を `--locked` に変更。`--frozen` はロックの
  整合性を検証しないため、Dependabot #448 (c078e7e) が `pyproject.toml` と
  `requirements.txt` だけ更新して `uv.lock` を放置した不整合が CI をすり抜けていた
  （本 PR で `uv.lock` を同期済み。以後 lock 未更新の Python PR はここで落ちる）。

### 変えていないもの

- **API のリクエスト/レスポンス形状は不変**。合法手の導出はサーバ側だけで完結する
  （`hand` と `table_cards` が来ているので導出できる）。
- `src/lib/ai/` で触ったのは `aiStrategy.ts` の `ML_CONFIDENCE_THRESHOLD` と
  その直上コメントのみ（後述の順序依存のため）。`src/lib/ml/mlClient.ts` の変更は
  コメントのみで、挙動は変えていない。

## 数値（34,840 行 / 903 ゲーム、ゲーム単位分割 seed=42、テスト 6,940 決定）

| 指標                     | 旧: 52クラス（従来の測り方） | 旧: 52クラス＋合法手マスク | 新: 候補スコアリング   |
| ------------------------ | ---------------------------- | -------------------------- | ---------------------- |
| accuracy                 | 27.12%                       | 57.28%                     | **66.04%**             |
| top-3                    | 51.96%（52枚中）             | —                          | **90.32%**（合法手中） |
| accuracy（強制手を除く） | —                            | 47.8%※                     | **58.33%**             |
| top-1 confidence 中央値  | 0.219                        | 0.587                      | **0.588**              |
| confidence ≥ 0.6 の割合  | 1.9%                         | 47.9%                      | 48.2%                  |
| ランダムベースライン     | 1.92%（52枚）                | 42.08%（合法手）           | 42.08%（合法手）       |

※ 全体 57.28% と強制手比率 18.49%（強制手は必ず的中）からの逆算値。

「強制手（合法手が 1 枚しかない）を除いた accuracy」が実力に一番近い指標で、
**47.8% → 58.33%**（ランダム相当は 28.8%）。

### なぜ「強制手を除く」が実運用値なのか

テスト 6,940 決定のうち **1,283 決定（18.49%）が強制手**（合法手 1 枚）。
強制手は正規化後の confidence が必ず 1.0 になり必ず的中するので、全決定を母数に
した数字は実運用より楽観に出る。

そして本番ではこれらの局面が **そもそも ML に届かない**。`src/lib/ai/aiStrategy.ts`
の `selectAICard` が、合法手が 1 枚の局面では ML を呼ばずに短絡するため。
したがって以下の表は「全決定」と「強制手を除いた実効値」を併記し、
**閾値の判断に使うのは右側**。

### confidence の信頼性（新モデル、テストセット）

| confidence 帯 | 決定の割合（全体） | 的中率（全体） | 決定の割合（非強制手） | 的中率（非強制手） |
| ------------- | ------------------ | -------------- | ---------------------- | ------------------ |
| 0.0–0.2       | 1.8%               | 11.7%          | 2.3%                   | 11.7%              |
| 0.2–0.3       | 9.8%               | 24.2%          | 12.0%                  | 24.2%              |
| 0.3–0.4       | 11.7%              | 35.8%          | 14.4%                  | 35.8%              |
| 0.4–0.5       | 12.0%              | 52.7%          | 14.7%                  | 52.7%              |
| 0.5–0.6       | 16.5%              | 62.8%          | 20.2%                  | 62.8%              |
| 0.6–0.8       | 19.9%              | 76.1%          | 24.4%                  | 76.1%              |
| 0.8–1.0       | 28.3%              | 97.0%          | 12.0%                  | 91.3%              |

confidence がほぼそのまま的中率になっている（旧実装では 0.2 前後に潰れていて
この区別ができなかった）。0.8–1.0 の帯だけ全体と非強制手で差が出るのは、
強制手が全てこの帯（confidence = 1.0、的中率 100%）に入るため。

閾値ごとの採用率と的中率:

| 閾値 | 採用率（全体） | 的中率（全体） | **採用率（非強制手）** | **的中率（非強制手）** |
| ---- | -------------- | -------------- | ---------------------- | ---------------------- |
| 0.2  | 98.2%          | 67.1%          | **97.7%**              | **59.4%**              |
| 0.3  | 88.4%          | 71.8%          | **85.7%**              | **64.4%**              |
| 0.4  | 76.7%          | 77.3%          | **71.4%**              | **70.1%**              |
| 0.5  | 64.7%          | 81.9%          | **56.7%**              | **74.6%**              |
| 0.6  | 48.2%          | 88.4%          | **36.5%**              | **81.1%**              |

`model/train.py` はこの両方を毎回ログに出す（`evaluate_decisions` の
`adopt_rate_at_*` / `accuracy_at_*` と、その `_non_forced` 版）。

## `ML_CONFIDENCE_THRESHOLD` を 0.6 に戻した

`src/lib/ai/aiStrategy.ts` の `ML_CONFIDENCE_THRESHOLD` を **0.2 → 0.6** に変更した
（このタスクに限り当該定数とその直上コメントのみ編集許可を得ている）。

0.2 は「52 クラス分類 + 推論時に再正規化しない」旧挙動に合わせた値だった。
候補スコアリング移行で confidence 中央値が 0.588 になったため、ロードマップ本来の
0.6 に戻す。この閾値では**非強制手の 36.45% で ML が発火し、そのとき参照ポリシーと
81.13% 一致**する。

### ⚠️ 再学習と閾値変更の順序依存

この 2 つは**セットで動く**。片方だけ入れると壊れる。

| Space のモデル          | 閾値    | 結果                                                                       |
| ----------------------- | ------- | -------------------------------------------------------------------------- |
| 旧 52 クラス            | 0.2     | 変更前の状態                                                               |
| 旧 52 クラス            | **0.6** | `/api/predict-card` が 503 を返すので ML は発火しない（安全側・MCTS のみ） |
| **新 候補スコアリング** | **0.2** | ⚠️ **危険**。非強制手の 97.7% で ML が採用され、MCTS が事実上無効化される  |
| 新 候補スコアリング     | 0.6     | 意図した状態                                                               |

危険なのは 3 行目。**閾値 0.2 のまま Space を再学習すると、コード変更なしに挙動が
変わる**。しかもこのモデルは medium 難易度が主体（25,868/34,840 行）の行動クローン
なので、`NEXT_PUBLIC_AI_DIFFICULTY=hard` を指定していても medium のクローンに
置き換わる。

**安全な順序**: 閾値 0.6 を先にデプロイし、その後で Space を push・再学習する。
逆順（先に再学習）にすると、閾値 0.6 が本番に届くまでの間 3 行目の状態になる。
本 PR は閾値変更を含むので、この PR をマージしてから Space を再学習すること。

## 限界と、次に効きそうなこと

- **これは行動クローンであって強さの学習ではない。** 学習データの 97.1%
  （33,825 / 34,840 行）は AI の手（`is_ai_player = true`）なので、モデルは既存の
  MCTS/ヒューリスティックを模倣しているだけで、原理的にそれを超えられない。
  「accuracy が上がる」＝「既存 AI に似る」であって「強くなる」ではない。
  勝敗を報酬にした学習（勝ちチームの手だけで学習、あるいは価値関数）が次の分岐点。
  なお「勝ちチームの手だけ」は今回試したが、データが半減する影響が勝って
  **64.50%（-1.5pt）で悪化**した。データ量が増えるまでは効かない。
- **場のカードが 1 スカラーに潰れている（次の改善候補）。** 場札は
  `table_best_strength`（場の最強手の強さ）と `table_size` の 2 つにしか
  なっていない。つまり「2 枚目の特殊カードが出ているか」「場に得点札が何枚あるか」
  「誰が現在勝っているか（味方か敵か）」を表現できない。
  **旧設計を殺した「identity が入力に無い」問題が、手札側では解消したのに場側には
  そのまま残っている。** 52 次元の場札インジケータ、あるいは
  「場の得点札枚数 / 現在の勝者が味方か / 出ている特殊カードのフラグ」を
  足すのが、追加データを集めるより先に効くはず（未検証）。
- **既に出たカードの履歴を特徴量にできていない。** `ml_training_data` の 1 行には
  自分の手札と現在のトリックのカードしか無く、推論 API のリクエストにも入っていない。
  カードカウンティング相当の情報が欠けているので、終盤の判断は原理的に弱い。
  入れるなら API のリクエスト形状と `src/lib/ai/aiStrategy.ts` の呼び出し側の
  両方を変える必要がある（今回スコープ外）。
- **モデル成果物が 825MB・総ノード約 1,000 万**（`max_depth` を外したため）。
  ロード 0.94 秒 / ピーク RSS 1.6GB。HF 無料枠のコールドスタートと
  `src/lib/ml/mlClient.ts` の 20 秒タイムアウトが重なると初回リクエストが
  落ちる可能性がある。ただし**旧モデルは上書き済みで比較できておらず、退行かどうかは
  未検証**。実運用ログを見てから判断する。
- **難易度が混ざっている**（medium 25,868 / hard 3,916 / easy 3,744 / 不明 1,312）。
  easy の手はノイズとして効いている可能性がある。difficulty を特徴量に入れるか、
  hard のみで学習する余地がある（未検証）。
- HF Space は別リポジトリなので、**この変更を反映するには Space への push と
  再学習が別途必要**（`python/README.md` の「The Space is a separate git repository」
  参照）。再学習前は `/api/predict-card` が 503 を返し、AI は MCTS にフォールバックする。

## 再現手順

```bash
# ルール移植フィクスチャの再生成（TS 側を変えたときだけ必要）
pnpm ml:fixtures

cd python
cp .env.example .env    # SUPABASE_URL と SUPABASE_ANON_KEY の 2 つだけ手で埋める
uv sync --locked --group dev
uv run python -m model.train   # 上表の数字がログに出る
uv run pytest                  # 110 tests（学習データ不要）
```

`SUPABASE_ANON_KEY` には **publishable キー**（`sb_publishable_…`）を入れること。
理由は `python/README.md` の「Use the publishable key, never a secret/service-role key」
を参照。`fetch_data.py` は `ml_training_data` に SELECT を 1 回投げるだけで、
それ以上の権限を必要としない。

> ⚠️ **`vercel env pull` の出力を `python/` の中に置かないこと。**
> `vercel env pull` は指定環境の**全変数**を平文で書き出すので、development には
> `SUPABASE_SERVICE_ROLE_KEY`（RLS を全バイパスする）と `ENCRYPTION_KEY` が含まれる。
> 一方 `python/` は「ディレクトリごと Hugging Face Space に push する」配布単位で、
> `python/Dockerfile` は `COPY . .` を行い、`fetch_data.py` の `_load_env()` は
> 起動時に `python/.env` を `os.environ` に読み込む。つまり `python/.env` に
> service role キーを置いた瞬間、それが Space のイメージとプロセス環境に載る。
> これは `python/README.md` の「blast radius を read one table に留める」方針と
> 正面から矛盾する。
>
> 保険として `python/.gitignore` と `python/.dockerignore` が `.env` / `.env.*` /
> `model/models/` を除外している（ルートの `.gitignore` は GitHub 側しか守らない。
> Space は別の git リポジトリなので継承されない）。
>
> どうしても Vercel から引きたい場合は、リポジトリルートの `python/` の外に出す:
>
> ```bash
> vercel env pull .env.ml.local --environment=development   # ルートに出す
> set -a; . ./.env.ml.local; set +a                          # 環境変数として渡す
> uv run --directory python python -m model.train
> ```
>
> `fetch_data.py` は `SUPABASE_URL` / `SUPABASE_ANON_KEY`（無ければ
> `NEXT_PUBLIC_SUPABASE_*`）を `os.environ` から読むので、`.env` ファイルが
> 無くてもこの形で動く。使い終わったら `.env.ml.local` は消すこと。
