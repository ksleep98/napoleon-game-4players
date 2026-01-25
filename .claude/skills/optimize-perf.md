# Optimize Performance Skill

このスキルは、Next.js + Supabaseプロジェクトのパフォーマンス最適化を体系的に行うためのガイドです。

## パフォーマンス最適化の優先順位

1. **データベース最適化** - 最大の効果
2. **ネットワーク最適化** - 中程度の効果
3. **レンダリング最適化** - 小〜中程度の効果
4. **バンドルサイズ最適化** - 小程度の効果

## 1. データベース最適化（最重要）

### N+1クエリ問題の解決

#### ❌ Before: N+1問題

```typescript
// 4人のプレイヤーを個別にINSERT（4回のDB呼び出し）
for (const player of players) {
  await supabase.from('players').insert({ id: player.id, name: player.name });
}
// → 合計: 4 × 50ms = 200ms
```

#### ✅ After: バッチINSERT

```typescript
// 全プレイヤーを1回でINSERT（1回のDB呼び出し）
await supabase
  .from('players')
  .insert(players.map((p) => ({ id: p.id, name: p.name })));
// → 合計: 50ms（75%削減）
```

**効果**: 150ms削減

### 並列データフェッチ

#### ❌ Before: 逐次実行

```typescript
const room = await getRoomDetails(roomId); // 50ms
const players = await getPlayers(roomId); // 50ms
// → 合計: 100ms
```

#### ✅ After: 並列実行

```typescript
const [room, players] = await Promise.all([
  getRoomDetails(roomId), // 50ms
  getPlayers(roomId), // 50ms
]);
// → 合計: 50ms（50%削減）
```

**効果**: 50ms削減

### 不要なDB呼び出しの削減

#### ❌ Before: リアルタイム更新後に再取得

```typescript
subscribeToRoom(roomId, {
  onPlayerJoin: async (player) => {
    setPlayers((prev) => [...prev, player]);
    await loadRoomData(); // ❌ 不要なDB呼び出し
  },
});
```

#### ✅ After: ローカル状態更新のみ

```typescript
subscribeToRoom(roomId, {
  onPlayerJoin: (player) => {
    setPlayers((prev) => [...prev, player]);
    setRoom((prev) =>
      prev
        ? {
            ...prev,
            playerCount: prev.playerCount + 1,
          }
        : null
    );
  },
});
```

**効果**: 50ms削減（DB呼び出し削除）

### インデックスの追加

#### 頻繁にクエリされるカラムにインデックス

```sql
-- プレイヤー検索の高速化
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_connected ON players(connected);

-- ゲーム検索の高速化
CREATE INDEX idx_game_states_player_id ON game_states(player_id);
CREATE INDEX idx_game_states_created_at ON game_states(created_at DESC);
```

**効果**: クエリ時間50-80%削減

### PostgreSQL関数の活用

#### ✅ 複数クエリを1回のRPC呼び出しに統合

```sql
CREATE OR REPLACE FUNCTION get_game_with_players(p_game_id UUID)
RETURNS JSON AS $$
BEGIN
  RETURN (
    SELECT json_build_object(
      'game', (SELECT row_to_json(g) FROM game_states g WHERE g.id = p_game_id),
      'players', (SELECT json_agg(p) FROM players p WHERE p.game_id = p_game_id)
    )
  );
END;
$$ LANGUAGE plpgsql;
```

**効果**: 複数クエリ → 1回のRPC呼び出し（30-50ms削減）

## 2. ネットワーク最適化

### リクエストの最小化

#### Server Actionsの活用

```typescript
// ❌ Before: 複数のAPI呼び出し
const response1 = await fetch('/api/game');
const response2 = await fetch('/api/players');

// ✅ After: Server Actionで統合
const { game, players } = await getGameDataAction(gameId);
```

### Vercelリージョンの最適化

#### 日本リージョンの使用

```javascript
// next.config.js
module.exports = {
  // Vercel自動設定でnrt1（東京）リージョン使用
  // Supabaseも日本リージョン（ap-northeast-1）使用
};
```

**効果**: レイテンシ80-120ms削減

## 3. レンダリング最適化

### React.memoの活用

#### ❌ Before: 不要な再レンダリング

```typescript
function PlayerCard({ player }) {
  return <div>{player.name}</div>
}
```

#### ✅ After: メモ化

```typescript
const PlayerCard = React.memo(({ player }) => {
  return <div>{player.name}</div>
})
```

### useCallbackとuseMemo

#### ❌ Before: 毎回再生成

```typescript
function Component() {
  const handleClick = () => {  // 毎レンダリングで新規作成
    doSomething()
  }

  const expensiveValue = calculateExpensiveValue()  // 毎回計算

  return <Button onClick={handleClick}>{expensiveValue}</Button>
}
```

#### ✅ After: メモ化

```typescript
function Component() {
  const handleClick = useCallback(() => {  // メモ化
    doSomething()
  }, [])

  const expensiveValue = useMemo(  // メモ化
    () => calculateExpensiveValue(),
    [dependency]
  )

  return <Button onClick={handleClick}>{expensiveValue}</Button>
}
```

### 仮想スクロール（長いリスト）

#### ❌ Before: 全要素レンダリング

```typescript
<ul>
  {items.map(item => (
    <li key={item.id}>{item.name}</li>
  ))}
</ul>
```

#### ✅ After: react-window使用

```typescript
import { FixedSizeList } from 'react-window'

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={35}
>
  {({ index, style }) => (
    <div style={style}>{items[index].name}</div>
  )}
</FixedSizeList>
```

## 4. バンドルサイズ最適化

### 動的インポート

#### ❌ Before: すべて静的インポート

```typescript
import HeavyComponent from './HeavyComponent'

export default function Page() {
  return <HeavyComponent />
}
```

#### ✅ After: 必要時にロード

```typescript
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
})

export default function Page() {
  return <HeavyComponent />
}
```

### Tree Shaking

#### ✅ 必要な関数のみインポート

```typescript
// ❌ ライブラリ全体をインポート
import _ from 'lodash';
_.debounce(fn, 300);

// ✅ 必要な関数のみ
import debounce from 'lodash/debounce';
debounce(fn, 300);
```

## 5. 画像最適化

### Next.js Image コンポーネント

#### ❌ Before: 通常のimg

```typescript
<img src="/card.png" width={200} height={300} alt="Card" />
```

#### ✅ After: Next.js Image

```typescript
import Image from 'next/image'

<Image
  src="/card.png"
  width={200}
  height={300}
  alt="Card"
  priority  // LCP画像の場合
/>
```

**効果**:

- 自動WebP/AVIF変換
- 遅延読み込み
- サイズ最適化

## パフォーマンス測定

### 1. Lighthouse

```bash
# Chrome DevToolsでLighthouse実行
# Performance、Accessibility、Best Practices、SEOスコア確認
```

### 2. Next.js Analytics

```typescript
// next.config.js
module.exports = {
  experimental: {
    instrumentationHook: true,
  },
};
```

### 3. カスタムパフォーマンス計測

```typescript
export async function measurePerformance<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    console.log(`[Perf] ${label}: ${duration.toFixed(2)}ms`);
  }
}

// 使用例
const result = await measurePerformance('Load game state', () =>
  loadGameStateAction(gameId, playerId)
);
```

### 4. Supabaseパフォーマンス監視

```typescript
// lib/supabase/performanceClient.ts
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, key, {
  auth: {
    persistSession: false, // 不要な場合は無効化
  },
  global: {
    headers: {
      'x-client-info': 'napoleon-game',
    },
  },
});

// クエリ時間計測
export async function performanceQuery<T>(
  queryFn: () => Promise<T>,
  label: string
): Promise<T> {
  const start = performance.now();
  const result = await queryFn();
  const duration = performance.now() - start;

  if (duration > 100) {
    console.warn(`[Slow Query] ${label}: ${duration.toFixed(2)}ms`);
  }

  return result;
}
```

## プロジェクト固有の最適化実績

### 実装済みの最適化

1. **N+1問題解決** (PR #167)
   - プレイヤー作成: 4回 → 1回のバッチINSERT
   - 効果: 150ms削減（75%改善）

2. **並列データフェッチ** (PR #167)
   - ルーム・プレイヤー情報の同時取得
   - 効果: 50ms削減（50%改善）

3. **不要I/O削減** (PR #167)
   - リアルタイム更新後の不要なDB再取得を削除
   - 効果: 50ms削減

4. **PostgreSQL関数統合**
   - 複数クエリを1回のRPC呼び出しに統合
   - 効果: 50-120ms削減

5. **Vercel日本リージョン**
   - レイテンシ大幅削減
   - 効果: 80-120ms削減

**合計効果**: 380-490ms削減（初期ロード時間50-60%改善）

## パフォーマンス最適化チェックリスト

### データベース

- [ ] N+1クエリの排除
- [ ] バッチ処理の実装
- [ ] 並列データフェッチ
- [ ] 適切なインデックス設定
- [ ] PostgreSQL関数の活用
- [ ] 不要なクエリの削減

### ネットワーク

- [ ] リクエスト数の最小化
- [ ] Server Actions活用
- [ ] 適切なキャッシュ戦略
- [ ] Vercel Edge Network活用

### レンダリング

- [ ] React.memoの活用
- [ ] useCallback/useMemo
- [ ] 仮想スクロール（長いリスト）
- [ ] 適切なキー設定

### バンドル

- [ ] 動的インポート
- [ ] Tree Shaking
- [ ] 不要な依存関係削除

### 画像

- [ ] Next.js Image使用
- [ ] WebP/AVIF対応
- [ ] 遅延読み込み

## 参考リンク

- [データベースパフォーマンス設定](../../docs/database/DATABASE_PERFORMANCE_SETUP.md)
- [Next.js パフォーマンス最適化](https://nextjs.org/docs/app/building-your-application/optimizing)
- [Supabase パフォーマンスガイド](https://supabase.com/docs/guides/database/performance)
- [React パフォーマンス最適化](https://react.dev/learn/render-and-commit)
