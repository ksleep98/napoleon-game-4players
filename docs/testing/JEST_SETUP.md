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
│   ├── cardUtils.test.ts      # カードユーティリティ
│   ├── constants.test.ts      # 定数・デッキ生成
│   ├── gameLogic.test.ts      # ゲームロジック
│   └── scoring.test.ts        # スコア計算
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

## テスト結果

```
Test Suites: 4 passed, 4 total
Tests:       34 passed, 34 total
Snapshots:   0 total
Time:        ~400ms
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
