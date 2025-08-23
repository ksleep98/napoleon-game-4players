# Coding Standards

このドキュメントでは、Napoleon Game プロジェクトでのコーディング規約を定義します。

## 全体方針

- **言語**: TypeScript を使用し、型安全性を重視
- **フォーマッター**: Biome を使用
- **命名**: 英語を基本とし、重要なロジックには日本語コメント
- **テスト**: Jest + React Testing Library
- **コミット**: Conventional Commits 規約

## Next.js 規約

### ディレクトリ構成

```
src/
├── app/                    # App Router (Next.js 13+)
│   ├── layout.tsx         # Root layout
│   ├── page.tsx           # Home page
│   ├── globals.css        # Global styles
│   └── (routes)/          # Route groups
├── components/            # Reusable components
│   ├── ui/               # Basic UI components
│   └── features/         # Feature-specific components
├── lib/                  # Utility functions
├── hooks/                # Custom React hooks
├── types/                # TypeScript type definitions
└── utils/                # Helper functions
```

### ファイル命名規則

- **コンポーネント**: PascalCase (例: `GameBoard.tsx`)
- **ページ**: snake_case または kebab-case (例: `game-room/page.tsx`)
- **ユーティリティ**: camelCase (例: `cardUtils.ts`)
- **型定義**: PascalCase (例: `GameTypes.ts`)

### コンポーネント規約

#### React Server Components (RSC)

```typescript
// Default export for pages and layouts
export default function GamePage() {
  return (
    <div>
      <h1>Napoleon Game</h1>
    </div>
  )
}

// Async components for data fetching
export default async function GameRoom({ params }: { params: { id: string } }) {
  const gameData = await fetchGameData(params.id)
  
  return (
    <div>
      <GameBoard data={gameData} />
    </div>
  )
}
```

#### Client Components

```typescript
'use client'

import { useState, useEffect } from 'react'

interface GameBoardProps {
  initialCards: Card[]
  playerId: string
}

export function GameBoard({ initialCards, playerId }: GameBoardProps) {
  const [cards, setCards] = useState<Card[]>(initialCards)
  
  return (
    <div className="game-board">
      {cards.map((card) => (
        <CardComponent key={card.id} card={card} />
      ))}
    </div>
  )
}
```

### 型定義規約

#### Props インターface

```typescript
// Props は常に interface で定義
interface CardProps {
  card: Card
  isSelected?: boolean
  onClick: (cardId: string) => void
}

// 複雑な Props は分割
interface GameState {
  players: Player[]
  currentPlayer: string
  phase: GamePhase
}

interface GameBoardProps {
  gameState: GameState
  onCardPlay: (card: Card) => void
  onGameEnd: () => void
}
```

#### 型の export

```typescript
// types/game.ts
export interface Player {
  id: string
  name: string
  cards: Card[]
}

export interface Card {
  id: string
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
  rank: number
}

export type GamePhase = 'setup' | 'bidding' | 'playing' | 'finished'
```

### スタイリング規約

#### Tailwind CSS クラス順序

```typescript
// レイアウト → ボックスモデル → タイポグラフィ → 視覚効果
<div className="flex items-center justify-center p-4 text-lg font-bold bg-blue-500 rounded-lg shadow-md">
  Content
</div>
```

#### CSS Variables の使用

```css
/* globals.css */
:root {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
  --spacing-card: 12px;
}

/* Tailwind で使用 */
<div className="bg-[var(--color-primary)]">
```

### State Management

#### useState パターン

```typescript
// 単純な状態
const [isLoading, setIsLoading] = useState<boolean>(false)

// オブジェクト状態は個別に分離
const [player, setPlayer] = useState<Player | null>(null)
const [gamePhase, setGamePhase] = useState<GamePhase>('setup')

// 複雑な状態は useReducer を検討
const [gameState, dispatch] = useReducer(gameReducer, initialGameState)
```

#### Custom Hooks

```typescript
// hooks/useGameLogic.ts
export function useGameLogic(gameId: string) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  const playCard = useCallback((card: Card) => {
    // Game logic here
  }, [gameState])
  
  return {
    gameState,
    isLoading,
    playCard,
  }
}
```

### API Routes 規約

```typescript
// app/api/games/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const games = await getGames()
    return NextResponse.json(games)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const newGame = await createGame(body)
    return NextResponse.json(newGame, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 400 }
    )
  }
}
```

### エラーハンドリング

#### Error Boundaries

```typescript
// components/ui/ErrorBoundary.tsx
'use client'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<{ error: Error }>
}

export function ErrorBoundary({ children, fallback: Fallback }: ErrorBoundaryProps) {
  // Error boundary implementation
}
```

#### Error Pages

```typescript
// app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h2 className="text-xl font-bold">Something went wrong!</h2>
      <button onClick={reset} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded">
        Try again
      </button>
    </div>
  )
}
```

## コメント規約

### 関数コメント

```typescript
/**
 * プレイヤーの手札からカードを削除する
 * @param playerId - プレイヤーID
 * @param cardId - 削除するカードID
 * @returns 更新されたプレイヤー情報
 */
export async function removeCardFromPlayer(
  playerId: string,
  cardId: string
): Promise<Player> {
  // Implementation here
}
```

### 複雑なロジックのコメント

```typescript
// ナポレオンゲームのスコア計算
// 1. 基本点数は取ったトリック数 × 10点
// 2. ナポレオン宣言が成功した場合は追加ボーナス
const calculateScore = (tricks: number, isNapoleon: boolean) => {
  let score = tricks * 10
  
  if (isNapoleon && tricks >= 13) {
    score += 100 // ナポレオン成功ボーナス
  }
  
  return score
}
```

## テスト規約

### Unit Tests

```typescript
// __tests__/components/Card.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { Card } from '@/components/Card'

describe('Card Component', () => {
  const mockCard = {
    id: '1',
    suit: 'hearts' as const,
    rank: 10,
  }

  it('renders card correctly', () => {
    render(<Card card={mockCard} />)
    
    expect(screen.getByRole('button')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('calls onClick when clicked', () => {
    const mockOnClick = jest.fn()
    render(<Card card={mockCard} onClick={mockOnClick} />)
    
    fireEvent.click(screen.getByRole('button'))
    expect(mockOnClick).toHaveBeenCalledWith(mockCard.id)
  })
})
```

## パフォーマンス規約

### 最適化の指針

1. **Server Components 優先**: データ取得は可能な限り Server Components で
2. **Client Components 最小化**: インタラクションが必要な部分のみ
3. **Dynamic Imports**: 大きなコンポーネントは動的インポート
4. **Image 最適化**: Next.js の Image コンポーネントを使用

```typescript
// 動的インポート例
const GameBoard = dynamic(() => import('@/components/GameBoard'), {
  loading: () => <div>Loading game board...</div>,
})

// Image 最適化
import Image from 'next/image'

<Image
  src="/cards/heart-10.png"
  alt="10 of Hearts"
  width={100}
  height={140}
  priority={isVisible}
/>
```

## セキュリティ規約

### 基本原則

1. **入力値検証**: 全ての入力は検証する
2. **型安全性**: TypeScript の型チェックを活用
3. **環境変数**: 機密情報は環境変数で管理
4. **CSRF対策**: Next.js の標準機能を使用

```typescript
// 入力値検証例
import { z } from 'zod'

const GameSchema = z.object({
  playerName: z.string().min(1).max(20),
  roomId: z.string().uuid(),
})

export async function createGame(input: unknown) {
  const validated = GameSchema.parse(input)
  // Process validated input
}
```

このコーディング規約に従って開発することで、保守性が高く、チーム開発しやすいコードベースを維持できます。