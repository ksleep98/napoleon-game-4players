# Jest テスト設定

## セットアップ完了

### 設定ファイル

- ✅ `jest.config.js` - Jest設定（Next.js統合）
- ✅ `jest.setup.js` - テスト環境セットアップ
- ✅ `moduleNameMapper` - TypeScriptパスエイリアス対応

### テストスイート

```
tests/
├── lib/
│   ├── cardUtils.test.ts               # カードユーティリティ
│   ├── constants.test.ts               # 定数・デッキ生成
│   ├── gameLogic.test.ts               # ゲームロジック
│   ├── scoring.test.ts                 # スコア計算
│   └── supabase/
│       ├── client.test.ts              # Supabaseセッション管理
│       ├── client-functions.test.ts    # 実関数テスト
│       ├── session-management.test.ts  # RLS修正確認
│       └── environment.test.ts         # 環境設定テスト
```

## 実装済みテスト

### cardUtils.test.ts

- `shuffleDeck()` - Fisher-Yatesシャッフル
- `dealCards()` - 4人への12枚配布
- カード総数検証（52枚）

### constants.test.ts

- `createDeck()` - 52枚デッキ生成（Joker除外）
- `createGameDeck()` - 48枚ゲームデッキ（2除外）
- `GAME_CONFIG` - 設定値検証
- `CARD_VALUES` - カード強さ設定

### gameLogic.test.ts

- `initializeGame()` - ゲーム初期化
- `determineTrickWinner()` - トリック勝者判定
- `isCardStronger()` - カード強さ比較
- プレイヤー作成・カード配布

### scoring.test.ts

- `getTeamTrickCounts()` - チーム別トリック数
- `getGameProgress()` - ゲーム進行状況
- `isGameDecided()` - 勝敗確定判定
- `calculateGameResult()` - 最終結果計算

### Supabase関連テスト (新規追加)

#### client.test.ts

- `setPlayerSession()` - ローカルストレージへの保存
- `getPlayerSession()` - セッション情報取得
- 統合テスト - 保存・取得の一貫性
- パフォーマンステスト - 大量処理の検証
- エラーハンドリング - ストレージエラー対応
- SSR対応 - window非存在環境での動作

#### client-functions.test.ts

- 実関数呼び出しテスト
- 型安全性確認
- モック環境での動作確認

#### session-management.test.ts

- RLS修正による動作確認
- ローカルストレージベースセッション管理
- 開発環境での安全な動作

#### environment.test.ts

- 環境変数設定テスト
- Supabase接続設定確認
- 開発・本番環境の切り分け

## テスト結果

```
Test Suites: 8 passed, 8 total
Tests:       75 passed, 75 total
Snapshots:   0 total
Time:        ~800ms
```

## 特記事項

### TypeScript型対応

- `as const` アサーション使用
- `Suit` と `Rank` 型の厳密チェック
- Player型の `isAdjutant` プロパティ対応

### カード仕様

- 52枚標準デッキ（Joker除外）
- 4スート × 13ランク
- 12枚×4人 + 隠し4枚 = 52枚

## 実行方法

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジレポート
npm run test:coverage
```
