---
name: test
description: Jestテストの実行・修正・新規作成を効率的に行います。TDD（テスト駆動開発）をサポート。Use when running tests, writing new tests, or fixing test failures.
---

# テストスキル

Jestテストの実行・修正・新規作成を効率的に行うスキル。TDD（テスト駆動開発）をサポート。

## 前提条件

- Jest設定済み（`jest.config.js`）
- Testing Libraryインストール済み
- テストファイル命名規則: `*.test.ts`, `*.test.tsx`, `*.spec.ts`

## テストフロー

### 1. テスト実行

```bash
# 全テスト実行
pnpm test

# Watch モード（開発時）
pnpm test:watch

# Coverage確認
pnpm test:coverage

# 特定のファイルのみ
pnpm test src/utils/cardUtils.test.ts

# 特定のパターンにマッチするテスト
pnpm test -- --testNamePattern="Napoleon"
```

### 2. テスト結果の分析

```bash
# 詳細なエラー情報表示
pnpm test -- --verbose

# 失敗したテストのみ再実行
pnpm test -- --onlyFailures

# カバレッジレポート確認
open coverage/lcov-report/index.html
```

### 3. テスト修正

```typescript
// ❌ 失敗するテスト
describe('Napoleon Declaration', () => {
  it('should allow valid declaration', () => {
    const result = declareNapoleon(player, {
      rank: 'A',
      suit: 'spades',
      tricks: 13,
    });
    expect(result.success).toBe(true); // 実際はfalse
  });
});

// ✅ 修正後
describe('Napoleon Declaration', () => {
  it('should allow valid declaration', () => {
    const result = declareNapoleon(player, {
      rank: 'A',
      suit: 'spades',
      tricks: 13,
    });
    expect(result.success).toBe(true);
    expect(result.declaration).toEqual({
      rank: 'A',
      suit: 'spades',
      tricks: 13,
    });
  });
});
```

## テスト作成ガイド

### ユニットテスト（関数・ロジック）

```typescript
// src/utils/cardUtils.test.ts
import { createDeck, shuffleDeck, dealCards } from './cardUtils';

describe('Card Utils', () => {
  describe('createDeck', () => {
    it('should create a deck with 52 cards', () => {
      const deck = createDeck();
      expect(deck).toHaveLength(52);
    });

    it('should have 4 suits', () => {
      const deck = createDeck();
      const suits = [...new Set(deck.map((card) => card.suit))];
      expect(suits).toHaveLength(4);
    });
  });

  describe('shuffleDeck', () => {
    it('should shuffle deck randomly', () => {
      const deck = createDeck();
      const shuffled = shuffleDeck([...deck]);
      expect(shuffled).not.toEqual(deck); // 順序が変わっている
      expect(shuffled).toHaveLength(52); // カード数は同じ
    });
  });
});
```

### コンポーネントテスト（React）

```typescript
// src/components/game/Card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from './Card'

describe('Card Component', () => {
  const mockCard = {
    id: 'card_1',
    rank: 'A',
    suit: 'spades',
    value: 14
  }

  it('should render card correctly', () => {
    render(<Card card={mockCard} isPlayable={true} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('♠')).toBeInTheDocument()
  })

  it('should call onClick when clicked', () => {
    const handleClick = jest.fn()
    render(<Card card={mockCard} isPlayable={true} onClick={handleClick} />)

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledWith(mockCard)
  })

  it('should be disabled when not playable', () => {
    render(<Card card={mockCard} isPlayable={false} />)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

### 統合テスト（ゲームフロー）

```typescript
// src/__tests__/game-flow.test.ts
describe('Game Flow Integration', () => {
  it('should complete full game round', () => {
    // 1. ゲーム初期化
    const game = initializeGame(['Player1', 'Player2', 'Player3', 'Player4']);
    expect(game.phase).toBe('NAPOLEON');

    // 2. ナポレオン宣言
    const declaration = { rank: 'A', suit: 'spades', tricks: 13 };
    const gameAfterDeclaration = declareNapoleon(
      game,
      game.players[0].id,
      declaration
    );
    expect(gameAfterDeclaration.phase).toBe('ADJUTANT');

    // 3. 副官設定
    const adjutantCard = { rank: 'K', suit: 'spades' };
    const gameAfterAdjutant = setAdjutant(gameAfterDeclaration, adjutantCard);
    expect(gameAfterAdjutant.phase).toBe('EXCHANGE');

    // ... 以降のフローをテスト
  });
});
```

## テストのベストプラクティス

### 1. AAA パターン（Arrange-Act-Assert）

```typescript
it('should calculate score correctly', () => {
  // Arrange: テストデータ準備
  const napoleonTricks = 13;
  const declaration = { rank: 'A', suit: 'spades', tricks: 13 };

  // Act: テスト対象実行
  const score = calculateScore(napoleonTricks, declaration);

  // Assert: 結果確認
  expect(score.napoleon).toBe(20);
  expect(score.allies).toBe(20);
});
```

### 2. テストの独立性

```typescript
// ✅ 良い例：各テストが独立
describe('Game State', () => {
  it('should initialize game', () => {
    const game = initializeGame(['P1', 'P2', 'P3', 'P4'])
    expect(game.phase).toBe('NAPOLEON')
  })

  it('should declare napoleon', () => {
    const game = initializeGame(['P1', 'P2', 'P3', 'P4'])  // 新しいゲーム
    const result = declareNapoleon(game, game.players[0].id, {...})
    expect(result.phase).toBe('ADJUTANT')
  })
})

// ❌ 悪い例：テストが依存
describe('Game State', () => {
  let game: GameState  // 共有状態

  it('should initialize game', () => {
    game = initializeGame(['P1', 'P2', 'P3', 'P4'])
    expect(game.phase).toBe('NAPOLEON')
  })

  it('should declare napoleon', () => {
    // 前のテストに依存している
    const result = declareNapoleon(game, game.players[0].id, {...})
  })
})
```

### 3. Edge Case テスト

```typescript
describe('Deal Cards', () => {
  it('should handle empty deck', () => {
    const deck: Card[] = [];
    expect(() => dealCards(deck, 4)).toThrow('Not enough cards');
  });

  it('should handle insufficient cards', () => {
    const deck = createDeck().slice(0, 10); // 10枚のみ
    expect(() => dealCards(deck, 4)).toThrow('Not enough cards');
  });

  it('should deal cards evenly', () => {
    const deck = createDeck(); // 52枚
    const hands = dealCards(deck, 4);
    hands.forEach((hand) => {
      expect(hand).toHaveLength(13); // 各プレイヤー13枚
    });
  });
});
```

## チェックリスト

新しいテスト作成時：

- [ ] テスト名が明確（何をテストするか分かる）
- [ ] AAAパターンに従っている
- [ ] Edge caseをカバーしている
- [ ] テストが独立している（他のテストに依存しない）
- [ ] モックを適切に使用している
- [ ] アサーションが十分（期待する動作を確認）

テスト修正時：

- [ ] 失敗理由を理解している
- [ ] 実装コードの問題かテストの問題か判断
- [ ] 修正後に他のテストも成功するか確認
- [ ] カバレッジが維持・向上している

## トラブルシューティング

### テストがタイムアウト

```typescript
// タイムアウト延長
it('should complete long operation', async () => {
  // 処理
}, 10000); // 10秒
```

### モックが効かない

```typescript
// モジュールモック
jest.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({ data: [], error: null }),
    })),
  },
}));
```

### 非同期テストの失敗

```typescript
// async/await使用
it('should load game state', async () => {
  const game = await loadGameState('game_123');
  expect(game).toBeDefined();
});
```

## 参考リンク

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Jest Setup Guide](../docs/testing/JEST_SETUP.md)
