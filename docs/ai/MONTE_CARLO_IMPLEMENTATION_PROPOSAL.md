# モンテカルロ木探索（MCTS）実装提案

## 概要

現在のヒューリスティック評価AIに、モンテカルロ木探索（MCTS）を追加する実装提案。

## 実装可能性

### ✅ 有利な点

1. **Server Actions実装済み**
   - サーバーサイドでAIロジックを実行
   - クライアントにAI思考過程を隠蔽（チート防止）
   - 計算リソースをサーバーで使用可能

2. **完全なゲーム状態管理**
   - GameState型で全情報を保持
   - カードの勝敗判定ロジック完備
   - ゲームルールが実装済み

3. **既存コードの再利用**
   - `napoleonCardRules.ts`の勝敗判定
   - `gameLogic.ts`のゲーム進行処理
   - `strategicCardEvaluator.ts`のヒューリスティック評価

### ⚠️ 考慮が必要な点

1. **計算時間制限**
   - Vercel Server Actions: 最大60秒
   - 実用的には1-3秒以内に完了させる必要
   - シミュレーション回数の調整が必要

2. **不完全情報ゲーム**
   - 他プレイヤーの手札が見えない
   - 決定論的シミュレーション（Determinization）が必要
   - 複数回のランダム手札配置でシミュレーション

3. **メモリ使用量**
   - 探索木のノードが増大
   - 適切な枝刈りが必要

## アーキテクチャ設計

### ファイル構成

```
src/lib/ai/
├── strategicCardEvaluator.ts  (既存) ヒューリスティック評価
├── monteCarloAI.ts            (新規) MCTS実装
├── aiStrategy.ts              (新規) 戦略切り替え
└── aiSimulator.ts             (新規) ゲームシミュレーター
```

### データ構造

```typescript
// MCTSノード
interface MCTSNode {
  // 状態
  gameState: GameState;
  playedCard: Card | null;

  // 統計
  visits: number;
  wins: number;

  // ツリー構造
  parent: MCTSNode | null;
  children: MCTSNode[];

  // 未展開アクション
  untriedActions: Card[];
}

// MCTS設定
interface MCTSConfig {
  simulationCount: number; // シミュレーション回数
  explorationConstant: number; // UCB1の探索定数（通常√2）
  timeLimit: number; // 制限時間（ミリ秒）
  determinizationCount: number; // 決定論化回数
}
```

## MCTS実装の4フェーズ

### 1. Selection（選択）

```typescript
function selectNode(node: MCTSNode): MCTSNode {
  while (node.untriedActions.length === 0 && node.children.length > 0) {
    node = selectBestChild(node, EXPLORATION_CONSTANT);
  }
  return node;
}

// UCB1アルゴリズム
function selectBestChild(node: MCTSNode, c: number): MCTSNode {
  return node.children.reduce((best, child) => {
    const ucb1 = calculateUCB1(child, node.visits, c);
    const bestUCB1 = calculateUCB1(best, node.visits, c);
    return ucb1 > bestUCB1 ? child : best;
  });
}

function calculateUCB1(
  node: MCTSNode,
  parentVisits: number,
  c: number
): number {
  const exploitation = node.wins / node.visits;
  const exploration = c * Math.sqrt(Math.log(parentVisits) / node.visits);
  return exploitation + exploration;
}
```

### 2. Expansion（展開）

```typescript
function expandNode(node: MCTSNode): MCTSNode {
  if (node.untriedActions.length === 0) return node;

  // 未試行のアクションを1つ選択
  const action = node.untriedActions.pop()!;

  // 新しいゲーム状態をシミュレート
  const newGameState = simulateAction(node.gameState, action);

  // 子ノードを作成
  const childNode: MCTSNode = {
    gameState: newGameState,
    playedCard: action,
    visits: 0,
    wins: 0,
    parent: node,
    children: [],
    untriedActions: getPlayableCards(newGameState),
  };

  node.children.push(childNode);
  return childNode;
}
```

### 3. Simulation（シミュレーション）

```typescript
function simulateGame(gameState: GameState): GameResult {
  let state = cloneGameState(gameState);

  // ゲーム終了までランダムにプレイアウト
  while (!isGameFinished(state)) {
    const currentPlayer = getCurrentPlayer(state);
    const playableCards = getPlayableCards(state);

    // ヒューリスティック評価と組み合わせたカード選択
    const card = selectCardForSimulation(playableCards, state, currentPlayer);

    state = simulateAction(state, card);
  }

  return evaluateGameResult(state);
}

// ランダム + ヒューリスティックのバランス
function selectCardForSimulation(
  cards: Card[],
  state: GameState,
  player: Player
): Card {
  // 50%の確率でヒューリスティック評価を使用
  if (Math.random() < 0.5) {
    return selectBestStrategicCard(cards, state, player) || cards[0];
  }
  // 50%の確率でランダム選択
  return cards[Math.floor(Math.random() * cards.length)];
}
```

### 4. Backpropagation（逆伝播）

```typescript
function backpropagate(node: MCTSNode, result: GameResult): void {
  let currentNode: MCTSNode | null = node;

  while (currentNode !== null) {
    currentNode.visits++;

    // このノードのプレイヤーが勝利した場合
    if (didPlayerWin(currentNode.gameState, result)) {
      currentNode.wins++;
    }

    currentNode = currentNode.parent;
  }
}
```

## メインMCTSアルゴリズム

```typescript
export function monteCarloTreeSearch(
  gameState: GameState,
  player: Player,
  config: MCTSConfig
): Card {
  const rootNode: MCTSNode = {
    gameState,
    playedCard: null,
    visits: 0,
    wins: 0,
    parent: null,
    children: [],
    untriedActions: getPlayableCards(gameState),
  };

  const startTime = Date.now();
  let simulationCount = 0;

  // 制限時間またはシミュレーション回数まで実行
  while (
    simulationCount < config.simulationCount &&
    Date.now() - startTime < config.timeLimit
  ) {
    // 1. Selection
    let node = selectNode(rootNode);

    // 2. Expansion
    if (node.untriedActions.length > 0 && node.visits > 0) {
      node = expandNode(node);
    }

    // 3. Simulation
    const result = simulateGame(node.gameState);

    // 4. Backpropagation
    backpropagate(node, result);

    simulationCount++;
  }

  // 最も訪問回数が多い子ノードのアクションを選択
  const bestChild = rootNode.children.reduce((best, child) =>
    child.visits > best.visits ? child : best
  );

  console.log(
    `MCTS: ${simulationCount} simulations in ${Date.now() - startTime}ms`
  );

  return bestChild.playedCard!;
}
```

## 不完全情報ゲーム対応（Determinization）

```typescript
export function selectCardWithDeterminization(
  gameState: GameState,
  player: Player,
  config: MCTSConfig
): Card {
  const cardVotes: Map<string, number> = new Map();

  // 複数回の手札配置でMCTSを実行
  for (let i = 0; i < config.determinizationCount; i++) {
    // ランダムに他プレイヤーの手札を配置
    const determinizedState = determinizeGameState(gameState, player);

    // MCTSで最適なカードを選択
    const selectedCard = monteCarloTreeSearch(
      determinizedState,
      player,
      config
    );

    // 投票
    const cardId = selectedCard.id;
    cardVotes.set(cardId, (cardVotes.get(cardId) || 0) + 1);
  }

  // 最も多く選ばれたカードを返す
  const playableCards = getPlayableCards(gameState);
  return playableCards.reduce((best, card) => {
    const votes = cardVotes.get(card.id) || 0;
    const bestVotes = cardVotes.get(best.id) || 0;
    return votes > bestVotes ? card : best;
  });
}

function determinizeGameState(
  gameState: GameState,
  observingPlayer: Player
): GameState {
  // 他プレイヤーの手札をランダムに配置
  const unknownCards = getAllUnknownCards(gameState, observingPlayer);
  const shuffled = shuffleArray(unknownCards);

  const newState = cloneGameState(gameState);
  let cardIndex = 0;

  for (const player of newState.players) {
    if (player.id === observingPlayer.id) continue;

    player.hand = shuffled.slice(cardIndex, cardIndex + player.hand.length);
    cardIndex += player.hand.length;
  }

  return newState;
}
```

## 既存コードとの統合

### aiStrategy.ts（戦略切り替え）

```typescript
export type AIStrategyType = 'heuristic' | 'mcts' | 'hybrid';

export interface AIStrategyConfig {
  strategy: AIStrategyType;
  mctsConfig?: MCTSConfig;
}

export function selectAICard(
  playableCards: Card[],
  gameState: GameState,
  player: Player,
  config: AIStrategyConfig
): Card | null {
  switch (config.strategy) {
    case 'heuristic':
      return selectBestStrategicCard(playableCards, gameState, player);

    case 'mcts':
      if (!config.mctsConfig) throw new Error('MCTS config required');
      return selectCardWithDeterminization(
        gameState,
        player,
        config.mctsConfig
      );

    case 'hybrid':
      // ゲーム序盤はヒューリスティック、中盤以降はMCTS
      const progress = gameState.tricks.length / 12;
      if (progress < 0.3) {
        return selectBestStrategicCard(playableCards, gameState, player);
      } else {
        if (!config.mctsConfig) throw new Error('MCTS config required');
        return selectCardWithDeterminization(
          gameState,
          player,
          config.mctsConfig
        );
      }

    default:
      return selectBestStrategicCard(playableCards, gameState, player);
  }
}
```

### Server Actionsでの使用

```typescript
// src/app/actions/aiStrategyActions.ts に追加
export async function processAITurnWithMCTS(
  gameId: string,
  playerId: string,
  strategyConfig: AIStrategyConfig
): Promise<AIStrategyActionResult<GameState>> {
  // 既存の検証ロジック...

  // MCTS戦略で処理
  const updatedGameState = await processAITurnWithStrategy(
    gameState,
    strategyConfig
  );

  // 保存...
}
```

## パフォーマンス最適化

### 1. 適切なパラメータ設定

```typescript
const MCTS_CONFIGS = {
  // 高速（モバイル・開発環境）
  fast: {
    simulationCount: 100,
    explorationConstant: Math.sqrt(2),
    timeLimit: 1000, // 1秒
    determinizationCount: 3,
  },

  // 標準（通常プレイ）
  normal: {
    simulationCount: 500,
    explorationConstant: Math.sqrt(2),
    timeLimit: 2000, // 2秒
    determinizationCount: 5,
  },

  // 高精度（難易度高）
  strong: {
    simulationCount: 2000,
    explorationConstant: Math.sqrt(2),
    timeLimit: 5000, // 5秒
    determinizationCount: 10,
  },
};
```

### 2. 枝刈り最適化

```typescript
function pruneWeakNodes(node: MCTSNode): void {
  // 訪問回数が少ないノードを削除
  node.children = node.children.filter((child) => child.visits >= MIN_VISITS);
}
```

### 3. 並列シミュレーション

```typescript
// Next.js Server Actionsで並列化可能
async function parallelSimulations(
  rootNode: MCTSNode,
  count: number
): Promise<void> {
  const promises = Array.from({ length: count }, () =>
    simulateGame(rootNode.gameState)
  );

  const results = await Promise.all(promises);
  results.forEach((result) => backpropagate(rootNode, result));
}
```

## 実装手順

1. **Phase 1**: 基本MCTS実装
   - `monteCarloAI.ts`作成
   - 基本的な4フェーズ実装
   - 単純なシミュレーション

2. **Phase 2**: Determinization追加
   - 不完全情報対応
   - 複数回の手札配置

3. **Phase 3**: 統合とテスト
   - `aiStrategy.ts`で戦略切り替え
   - ヒューリスティックとの比較テスト
   - パフォーマンス調整

4. **Phase 4**: 最適化
   - 枝刈り実装
   - パラメータチューニング
   - 並列化

## テスト計画

```typescript
// tests/lib/ai/monteCarloAI.test.ts
describe('Monte Carlo AI', () => {
  it('should select winning card with high probability', () => {
    // 明らかに有利な状況でのテスト
  });

  it('should complete within time limit', () => {
    // パフォーマンステスト
  });

  it('should handle determinization correctly', () => {
    // 不完全情報のテスト
  });
});
```

## まとめ

### ✅ 実装可能

- 現在のアーキテクチャで実装可能
- Server Actionsで安全に実行
- 既存コードを再利用可能

### 🎯 推奨実装順序

1. 基本MCTS（完全情報版）でプロトタイプ
2. Determinizationで不完全情報対応
3. ヒューリスティックとのハイブリッド戦略
4. パフォーマンス最適化

### ⚖️ トレードオフ

| 項目         | ヒューリスティック | MCTS               |
| ------------ | ------------------ | ------------------ |
| 応答速度     | 高速（<100ms）     | 中速（1-3秒）      |
| AI強度       | 中程度             | 高い               |
| 実装複雑度   | 低い               | 高い               |
| チューニング | 難しい（手動調整） | 易しい（自動学習） |

### 💡 推奨：ハイブリッド戦略

```typescript
// 序盤：ヒューリスティック（高速）
// 中盤以降：MCTS（高精度）
// 難易度設定で切り替え可能
```
