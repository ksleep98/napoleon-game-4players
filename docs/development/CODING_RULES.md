# Napoleon Game コーディングルール

## 📋 基本原則

### 🎯 コード品質・一貫性

1. **TypeScript strict mode** - 型安全性を最優先
2. **Biome linting/formatting** - 自動修正・統一フォーマット
3. **英語中心** - 変数・関数名は英語、重要ロジックは日本語コメント
4. **テスト必須** - 新機能にはJestテスト追加

### ⚠️ Git ワークフロー

**`develop`ブランチへの直接コミット禁止**

- 必ず `feature/xxx` ブランチを作成して作業
- Pull Requestを通してのみマージ
- 直接 `git push origin develop` は禁止

```bash
# ✅ 正しい流れ
git checkout develop
git pull origin develop
git checkout -b feature/your-feature
# 開発作業...
git push origin feature/your-feature
# → GitHub でPR作成

# ❌ 禁止行為
git checkout develop
# 開発作業...
git push origin develop  # これは禁止！
```

## 🔧 定数・文字列管理

### ✅ 定数参照の徹底

**❌ NG: 文字列リテラル直接使用**

```typescript
// ダメな例
if (gameState.phase === 'napoleon') {
  // ...
}

throw new GameActionError('Game not found', 'NOT_FOUND');
```

**✅ OK: 定数参照**

```typescript
// 良い例
if (gameState.phase === GAME_PHASES.NAPOLEON) {
  // ...
}

throw new GameActionError('Game not found', GAME_ACTION_ERROR_CODES.NOT_FOUND);
```

### 📁 定数定義場所

- **ゲームフェーズ**: `src/lib/constants.ts` の `GAME_PHASES`
- **エラーコード**: `src/lib/errors/GameActionError.ts` の `GAME_ACTION_ERROR_CODES`
- **UI文言**: 各コンポーネント内で `const MESSAGES = {}` として定義
- **設定値**: `src/lib/constants.ts` の各種定数

### 🎨 定数ネーミング規則

```typescript
// ✅ 推奨パターン
export const GAME_PHASES = {
  SETUP: 'setup',
  NAPOLEON: 'napoleon',
  PLAYING: 'playing',
} as const;

export const API_ENDPOINTS = {
  GAMES: '/api/games',
  PLAYERS: '/api/players',
} as const;

export const ERROR_MESSAGES = {
  GAME_NOT_FOUND: 'Game not found',
  INVALID_MOVE: 'Invalid move',
} as const;
```

## 📦 依存関係・パッケージ管理

### 🗑️ 不要パッケージの排除

**定期的なクリーンアップが重要** - 使用されていないライブラリは即座に削除

**削除済み例：**

- `critters` - 未使用のCSS最適化ツール
- `vercel` - CLI ツールでdevDependenciesに不要

**チェック方法：**

```bash
# パッケージ使用状況の確認
npx depcheck
pnpm audit
```

### 📊 最適化済み状況

- **Before**: 41パッケージ
- **After**: 37パッケージ（-4パッケージ）
- **効果**: ビルド時間短縮・メンテナンス性向上

### 📝 package.json Scripts最適化

**削除済みの重複スクリプト：**

- `check` (lintと重複)
- `test:e2e:manual` (不要な冗長コマンド)
- `test:e2e:no-server` (他のCI用コマンドで代用可能)

## 📦 Import/Export規則

### ✅ 静的Import優先

**❌ NG: 動的import（パフォーマンス以外での使用）**

```typescript
// ダメな例
const { processAITurnAction } = await import('@/app/actions/aiStrategyActions');
```

**✅ OK: 静的import**

```typescript
// 良い例
import { processAITurnAction } from '@/app/actions/aiStrategyActions';
```

### 📋 Import順序

1. React・Next.js関連
2. 外部ライブラリ
3. 内部モジュール（`@/` から始まる）
4. 相対パス（`./`, `../`）
5. 型定義（`import type`）

```typescript
// ✅ 推奨順序
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { processAITurnAction } from '@/app/actions/aiStrategyActions';
import { GAME_PHASES } from '@/lib/constants';
import { getCurrentPlayer } from '@/lib/gameLogic';

import type { GameState, Player } from '@/types/game';
```

## 🎮 Server Actions

### 🔐 セキュリティ・検証

```typescript
export async function gameAction(gameId: string, playerId: string) {
  try {
    // 1. セッション検証
    const sessionValid = await validateSessionAction(playerId);
    if (!sessionValid.success) {
      throw new GameActionError(
        'Invalid session',
        GAME_ACTION_ERROR_CODES.UNAUTHORIZED
      );
    }

    // 2. 入力検証
    if (!validateGameId(gameId)) {
      throw new GameActionError(
        'Invalid game ID',
        GAME_ACTION_ERROR_CODES.INVALID_GAME_ID
      );
    }

    // 3. ゲーム状態取得・検証
    const gameResult = await loadGameStateAction(gameId, playerId);
    if (!gameResult.success || !gameResult.gameState) {
      throw new GameActionError(
        'Game not found',
        GAME_ACTION_ERROR_CODES.NOT_FOUND
      );
    }

    // 4. ビジネスロジック実行
    // ...

    // 5. 状態保存
    const saveResult = await saveGameStateAction(updatedGameState, playerId);
    if (!saveResult.success) {
      throw new GameActionError(
        'Failed to save game state',
        GAME_ACTION_ERROR_CODES.SAVE_FAILED
      );
    }

    return { success: true, data: updatedGameState };
  } catch (error) {
    console.error('gameAction failed:', error);
    return {
      success: false,
      error: error instanceof GameActionError ? error.message : 'Unknown error',
    };
  }
}
```

## 🗄️ データベース（Supabase）

### 🔑 テーブル作成時は GRANT を同じ SQL に書く

2026-10-30 以降、Supabase は `public` に新しく作ったテーブル・ビューへ Data API
（supabase-js / PostgREST / Realtime）の権限を自動で付けません。付け忘れると API が
`permission denied` を返します。既存テーブルは影響を受けませんが、プロジェクトを
作り直したときは `docs/` の SQL から作るので、ここに書いていないと壊れます。

- `CREATE TABLE` と同じファイルに `GRANT` を書く（例: `docs/deployment/production_database_schema.sql`）
- 行単位の制御は RLS が担う。GRANT はロールごとの最小限にする
  - `anon`: ブラウザ・Python（publishable key）が読むテーブルだけ `SELECT`
  - `authenticated`, `service_role`: `SELECT, INSERT, UPDATE, DELETE`
- RLS を経由しないビューは `service_role` だけに `SELECT` を付ける

## 🤖 AI処理

### 🔄 非同期処理パターン

```typescript
// ✅ AI処理の標準パターン
export async function processAIPhase(gameState: GameState): Promise<GameState> {
  let updatedState = { ...gameState };

  const currentPlayer = getCurrentPlayer(updatedState);
  if (!currentPlayer?.isAI) {
    return updatedState;
  }

  // AI戦略実行（非同期）
  const decision = await makeAIDecision(currentPlayer, updatedState);

  if (decision) {
    updatedState = applyDecision(updatedState, currentPlayer.id, decision);
    console.log(`AI ${currentPlayer.name} makes decision: ${decision.type}`);
  }

  return updatedState;
}
```

## 🎯 React Hooks

### 📋 依存関係管理

```typescript
// ✅ useEffect依存関係の適切な管理
useEffect(() => {
  const processData = async () => {
    // 処理内容
  };

  if (condition) {
    processData();
  }
}, [condition, stableReference]); // 安定した参照のみ含める

// ✅ useCallbackでの安定化
const handleAction = useCallback(
  (data: Data) => {
    // 処理内容
  },
  [stableDependency]
);
```

## 📝 エラーハンドリング

### 🚨 統一エラーパターン

```typescript
// ✅ カスタムエラーの使用
try {
  // 処理
} catch (error) {
  if (error instanceof GameActionError) {
    // ゲーム固有エラー
    console.error(`Game Error [${error.code}]:`, error.message);
  } else {
    // 予期しないエラー
    console.error('Unexpected error:', error);
  }

  return {
    success: false,
    error: error instanceof GameActionError ? error.message : 'Unknown error',
  };
}
```

## 🧪 テスト

### 📋 テスト必須項目

1. **新機能** - 機能追加時は必ずテスト作成
2. **バグ修正** - 修正後の動作確認テスト
3. **リファクタリング** - 既存テストが全て通ることを確認

```typescript
// ✅ テストパターン例
describe('GameLogic', () => {
  it('should handle Napoleon declaration correctly', () => {
    const gameState = createMockGameState();
    const result = declareNapoleon(gameState, MOCK_PLAYER_ID, MOCK_CARD);

    expect(result.phase).toBe(GAME_PHASES.ADJUTANT);
    expect(result.napoleonDeclaration).toBeDefined();
  });
});
```

## 🔍 コードレビューチェックリスト

### ✅ 提出前確認項目

- [ ] 文字列リテラルを定数参照に置換
- [ ] 動的importを静的importに変更
- [ ] TypeScript型エラー0件
- [ ] `pnpm ci-check` 全項目合格
- [ ] テスト追加・既存テスト合格
- [ ] エラーハンドリング適切実装
- [ ] セキュリティ検証実装（Server Actions）

---

**このルールに従うことで、保守性・可読性・品質の高いコードベースを維持できます。**
