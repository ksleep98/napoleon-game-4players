# Napoleon Game - Recent Improvements Log

## 2025-01-04 Multiplayer Room System Implementation

### 🏢 マルチプレイヤールーム機能実装

#### 概要

4人対戦用のマルチプレイヤールーム管理システムを実装しました。プレイヤーがルームを作成し、他のプレイヤーが参加してゲームを開始できる基盤を構築しました。

**PR**: [#161](https://github.com/ksleep98/napoleon-game-4players/pull/161)

### 🎯 実装機能

#### 1. ルーム管理システム

**Files Created**:

- `src/app/rooms/page.tsx` - ルーム一覧・作成UI
- `src/app/rooms/[roomId]/waiting/page.tsx` - 待機ルームUI
- `docs/database/room_player_count_functions.sql` - PostgreSQL関数
- `docs/database/MULTIPLAYER_ROOM_SETUP.md` - セットアップドキュメント

**Features**:

- ✅ ルーム作成機能（ホストプレイヤー設定）
- ✅ ルーム一覧表示（リアルタイム更新：30秒間隔）
- ✅ プレイヤー参加機能（セッション管理）
- ✅ プレイヤー数追跡（0→1→2→3→4人）
- ✅ 待機ルームUI（4人集まるまで待機）

#### 2. PostgreSQL データベース関数

**File**: `docs/database/room_player_count_functions.sql`

```sql
-- プレイヤー数を安全に増やす
CREATE OR REPLACE FUNCTION increment_player_count(room_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = player_count + 1
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;

-- プレイヤー数を安全に減らす
CREATE OR REPLACE FUNCTION decrement_player_count(room_id TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE game_rooms
  SET player_count = GREATEST(player_count - 1, 0)
  WHERE id = room_id;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp;
```

**Security Features**:

- `SECURITY DEFINER`: RLS制約を回避して確実に実行
- `search_path = public, pg_temp`: SQLインジェクション対策
- `service_role` のみ実行可能（クライアント直接呼び出し不可）

#### 3. Server Actions 拡張

**Files Modified**: `src/app/actions/gameActions.ts`

**Changes**:

```typescript
// 1. getGameRoomsAction - playerId任意化
export async function getGameRoomsAction(
  playerId?: string // Optional: 未認証でもルーム一覧取得可能
): Promise<{ success: boolean; gameRooms?: GameRoom[]; error?: string }> {
  // プレイヤーIDがある場合のみ検証・レート制限
  if (playerId && !validatePlayerId(playerId)) {
    throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID');
  }
  // ...
}

// 2. joinGameRoomAction - エラーハンドリング強化
const { error: roomUpdateError } = await supabaseAdmin.rpc(
  'increment_player_count',
  { room_id: roomId }
);

if (roomUpdateError) {
  console.error('Failed to update room player count:', roomUpdateError);
  // Silent logging → Throw error (明示的エラー処理)
  throw new GameActionError(
    `Failed to update room player count: ${roomUpdateError.message}`,
    'ROOM_UPDATE_ERROR'
  );
}

// 3. getRoomDetailsAction - 新規追加
export async function getRoomDetailsAction(roomId: string): Promise<{
  success: boolean;
  room?: GameRoom;
  error?: string;
}> {
  // 待機ルーム用のルーム詳細取得
  // ...
}
```

**Impact**:

- ✅ 未認証ユーザーでもルーム一覧閲覧可能
- ✅ エラー検出強化（プレイヤー数更新失敗を即座に検知）
- ✅ 待機ルーム用データ取得API追加

#### 4. セキュアサービスレイヤー修正

**Files Modified**: `src/lib/supabase/secureGameService.ts`

**Changes**:

```typescript
// 1. secureGameRoomCreate - hostPlayerId使用
export async function secureGameRoomCreate(
  room: Omit<GameRoom, 'createdAt'>
): Promise<GameRoom> {
  // Before: セッションストレージからplayerId取得（エラー発生）
  // const playerId = getPlayerId()

  // After: ルームのhostPlayerIdを直接使用
  const playerId = room.hostPlayerId;
  const result = await createGameRoomAction(room, playerId);
  // ...
}

// 2. secureGameRoomsGet - オプショナルplayerId対応
export async function secureGameRoomsGet(): Promise<GameRoom[]> {
  // セッションがなくても実行可能
  const playerId = getSecurePlayerId();
  const result = await getGameRoomsAction(playerId || undefined);
  // ...
}
```

**Impact**:

- ✅ ルーム作成時のセッションエラー解消
- ✅ 未認証状態でのルーム一覧取得対応

#### 5. クライアントコンポーネント実装

**File**: `src/app/rooms/page.tsx`

**Features**:

- ルーム作成UI（プレイヤー名入力・ルーム名入力）
- ルーム一覧表示（player count表示・Join/Fullボタン）
- 30秒間隔の自動更新
- localStorage活用（プレイヤー名保存）

```typescript
const handleCreateRoom = async () => {
  const playerId = generatePlayerId();
  const roomId = generateGameId();

  // playerCount: 0 で初期化（二重カウント防止）
  await createGameRoom({
    id: roomId,
    name: newRoomName.trim(),
    playerCount: 0, // ← 0で初期化
    maxPlayers: 4,
    status: 'waiting',
    hostPlayerId: playerId,
  });

  await createPlayer(playerId, playerName.trim());

  // ホストプレイヤーをルームに参加（0 → 1）
  await joinGameRoom(roomId, playerId);

  // セッション保存・ページ遷移
  localStorage.setItem('playerId', playerId);
  localStorage.setItem('playerName', playerName.trim());
  router.push(`/rooms/${roomId}/waiting`);
};
```

**File**: `src/app/rooms/[roomId]/waiting/page.tsx`

**Features**:

- 4人分のプレイヤースロット表示（1-4）
- リアルタイムプレイヤー参加・退出監視
- ホストバッジ表示（👑 Host）
- 接続状態インジケーター（緑: Connected）
- Start Gameボタン（4人揃った時のみ有効化）
- Leave Roomボタン

```typescript
// Real-time subscription
useEffect(() => {
  const unsubscribe = subscribeToGameRoom(roomId, {
    onRoomUpdate: (updatedRoom) => {
      setRoom(updatedRoom);
      // Auto-navigate when game starts
      if (updatedRoom.status === GAME_ROOM_STATUS.PLAYING) {
        router.push(`/game/${roomId}?multiplayer=true`);
      }
    },
    onPlayerJoin: (player) => {
      setPlayers((prev) => [...prev, player]);
      loadRoomData(); // Update player count
    },
    onPlayerLeave: (playerId) => {
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
      loadRoomData();
    },
    onError: (error) => {
      console.error('Room subscription error:', error);
      setError(error.message);
    },
  });

  return () => unsubscribe();
}, [roomId, router, loadRoomData]);
```

### 🐛 修正・改善内容

#### Issue 1: プレイヤー数二重カウント問題

**Problem**: ルーム作成時に `playerCount: 1` で初期化 → joinGameRoom呼び出しで+1 → `playerCount: 2` になる

**Root Cause**:

```typescript
// Before: Double counting
await createGameRoom({
  playerCount: 1, // ← ホストとして1から開始
  hostPlayerId: playerId,
});
await joinGameRoom(roomId, playerId); // ← さらに+1で2になる
```

**Fix**:

```typescript
// After: Start from 0
await createGameRoom({
  playerCount: 0, // ← 0から開始
  hostPlayerId: playerId,
});
await joinGameRoom(roomId, playerId); // ← +1で正しく1になる
```

**Impact**: ✅ プレイヤー数が正確に追跡される（0→1→2→3→4）

#### Issue 2: プレイヤーセッションエラー

**Problem**: "Player session not found. Please use usePlayerSession hook"

**Root Cause**: `getGameRooms()` と `createGameRoom()` が `getPlayerId()` を呼び出し、セッション未確立時にエラー

**Fix**:

- `getGameRoomsAction`: playerId任意化
- `secureGameRoomCreate`: `room.hostPlayerId` を使用

**Impact**: ✅ ルーム作成・一覧取得時のセッションエラー解消

#### Issue 3: PostgreSQL関数呼び出しエラー

**Problem**: "Could not choose the best candidate function"

**Root Cause**: UUID型とTEXT型で同名関数が重複

**Fix**:

```sql
-- UUID版を削除
DROP FUNCTION IF EXISTS increment_player_count(uuid);
DROP FUNCTION IF EXISTS decrement_player_count(uuid);

-- TEXT版のみ保持
CREATE OR REPLACE FUNCTION increment_player_count(room_id TEXT) ...
```

**Impact**: ✅ 関数呼び出し時のエラー解消・プレイヤー数正常更新

#### Issue 4: React Key Prop警告

**Problem**: Biome linting error - `lint/suspicious/noArrayIndexKey`

**Root Cause**: プレイヤースロット表示で配列インデックスをkeyとして使用

**Fix**:

```typescript
// Before: Direct index usage
<div key={index}>

// After: Player ID or slot-based fallback
const slotKey = player?.id || `empty-slot-${slotIndex}`
<div key={slotKey}>
```

**Impact**: ✅ Lintエラー解消・安定したReactレンダリング

#### Issue 5: AI関連Lintエラー

**Files Modified**:

- `src/lib/ai/gameTricks.ts`
- `src/lib/ai/monteCarloAI.ts`
- `src/lib/ai/strategicCardEvaluator.ts`

**Fix**: 未使用変数を `_variable` に変更（Biome自動修正）

### ⚠️ 既知の制限事項

#### ゲーム初期化未実装

**Status**: 🚧 次のPRで対応予定

**Error**: "Failed to initialize game: Failed to save game state"

**Location**: Start Gameボタンクリック時（4人揃った後）

**Root Cause**: `startGameFromRoomAction` → `initializeGameAction` がマルチプレイヤー対応していない

**Next Steps**:

1. `initializeGameAction` のマルチプレイヤー対応
2. ルームからゲーム状態への変換ロジック実装
3. 4人プレイヤーIDの正しいゲーム状態への統合

### 🧪 テスト結果

#### 手動テスト（複数ブラウザウィンドウ）

**Scenarios Tested**:

1. ✅ ルーム作成（ホストプレイヤー）→ playerCount: 0 → 1
2. ✅ プレイヤー参加（別ブラウザ）→ playerCount: 1 → 2 → 3 → 4
3. ✅ UI更新（リアルタイム）→ プレイヤー名・カウント表示
4. ✅ ホストバッジ表示 → 👑 Hostが正しく表示
5. ✅ Start Gameボタン有効化 → 4人で有効化
6. ✅ データベース確認 → player_count正確に更新

#### CI/CD Pipeline

```bash
✅ Linting: No issues found
✅ Type Check: No TypeScript errors
✅ Formatting: All files properly formatted
✅ Tests: All tests pass
✅ Build: Next.js production build successful
```

**Files Changed**: 8 files (696 additions, 18 deletions)

### 📚 ドキュメント更新

**Files Added/Updated**:

- ✅ `docs/database/MULTIPLAYER_ROOM_SETUP.md` - PostgreSQL関数セットアップ手順
- ✅ `docs/game-logic/IMPLEMENTATION_STATUS.md` - マルチプレイヤールーム機能追加
- ✅ `docs/game-logic/RECENT_IMPROVEMENTS.md` - 本ログエントリー追加

### 🎯 今後の展開

**Phase 1** (実装済み - PR #161):

- ✅ ルーム管理システム
- ✅ プレイヤー参加・待機機能
- ✅ リアルタイムUI更新

**Phase 2** (次のPR):

- ⏳ ゲーム初期化機能
- ⏳ マルチプレイヤーゲーム実行
- ⏳ プレイヤー間同期

**Phase 3** (将来):

- ⏳ リコネクション機能
- ⏳ プレイヤー退出時の処理
- ⏳ ルーム削除・クリーンアップ

## Summary - Multiplayer Room System

**Total Changes**: 1 major feature implementation
**Files Modified**: 8 files (4 new, 4 modified)
**CI/CD Status**: ✅ All checks passing
**Documentation**: ✅ Comprehensive setup guide created

**Feature Implementation**:

- ✅ Complete room management system (create, list, join)
- ✅ PostgreSQL functions for safe player count management
- ✅ Real-time UI updates and subscriptions
- ✅ Session management and error handling
- ⏳ Game initialization (deferred to next PR)

**User Experience**:

- ✅ Intuitive room creation and joining flow
- ✅ Clear visual indicators (host badge, connection status)
- ✅ Real-time player count updates
- ✅ Responsive waiting room UI

**Technical Quality**:

- ✅ Secure database operations (SECURITY DEFINER, search_path)
- ✅ Proper error handling and validation
- ✅ Clean code with comprehensive documentation
- ✅ Production-ready architecture

---

## 2025-09-06 Authentication & Security Major Update

### 🔐 Supabase新API Keys認証システム対応

#### Issue: RLS Policy Violation & 401 Unauthorized Errors

**Problem**:

- Napoleon card selection時に "new row violates row-level security policy" エラー
- クライアントサイドの直接Supabase呼び出しによる認証問題
- 新Supabase API Keys (`sb_secret_*`) 形式への対応不備

**Root Cause Analysis**:

1. `useGameActions.ts`と`useAIProcessing.ts`が古い`gameService.ts`を使用
2. クライアントサイドでanon keyによる直接DB書き込み実行
3. 新API Keys形式での認証ヘッダー不適合

**Files Modified**:

- `src/app/actions/gameActions.ts` - 新API Keys認証システム実装
- `src/hooks/useGameActions.ts` - secureGameService移行
- `src/hooks/useAIProcessing.ts` - secureGameService移行
- `src/lib/supabase/gameService.ts` - 危険な直接呼び出し関数削除
- `src/lib/supabase/server.ts` - Service Role診断機能追加

**Key Technical Solutions**:

1. **Service Role Key診断システム**:

```typescript
export const diagnoseServiceRoleKey = () => {
  const isNewApiKey = supabaseServiceRoleKey?.startsWith('sb_secret_');
  const isLegacyJWT = supabaseServiceRoleKey?.startsWith('eyJ');
  return {
    exists: keyExists,
    isNewApiKey,
    isLegacyJWT,
    isValid: keyExists && (isNewApiKey || isLegacyJWT),
    keyType: isNewApiKey ? 'new_secret_key' : 'legacy_jwt',
  };
};
```

2. **動的クライアント作成（新API Keys対応）**:

```typescript
if (diagnosis.isNewApiKey) {
  clientForOperation = createClient(envUrl, envServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
```

3. **REST API フォールバック機能**:

```typescript
if (
  saveResult.error?.includes('401') ||
  saveResult.error?.includes('unauthorized')
) {
  const restResult = await saveGameStateViaRestAPI(
    gameData,
    envServiceRoleKey,
    envUrl
  );
}
```

**Security Architecture Changes**:

- ✅ クライアントサイドからの直接DB書き込みを完全廃止
- ✅ すべての書き込み操作をServer Actions経由に統一
- ✅ `gameService.ts`から危険な関数（`saveGameState`, `createPlayer`等）を削除
- ✅ subscription機能のみクライアントサイドに保持（読み取り専用・RLS保護下）

**Impact**:

- 🎯 Napoleon card selection時の認証エラー完全解消
- 🔒 セキュリティレベル大幅向上（プロダクション対応完了）
- 📊 新旧API Keys両対応でSupabaseバージョン移行に対応
- 🧪 全146テスト合格・ci-check完全通過

### 🧹 コードクリーンアップ & デバッグログ削除

**Changes**:

- デバッグ用の詳細ログをすべて削除
- 未使用変数・import文の整理
- Biome linting rules準拠
- エラーハンドリングの最適化

**Files Cleaned**:

- `src/app/actions/gameActions.ts` - 17個のERROR PATHログ削除
- `src/lib/supabase/gameService.ts` - 危険な直接呼び出し関数9個削除

## 2025-01-01 UI & Game Logic Improvements

### 🎨 UI/UX Improvements

#### Issue 1: White Background Visibility Problems

**Problem**: White background areas made corner text unreadable against green game board

**Files Modified**:

- `src/components/game/GameBoard.tsx`

**Changes**:

- Changed all corner information panels from `bg-white bg-opacity-90` to `bg-gray-900 bg-opacity-95 text-white`
- Added proper shadows and borders: `shadow-lg border border-gray-700`
- Updated text colors for better contrast on dark background

**Impact**: All corner information is now clearly visible with high contrast

#### Issue 2: Redundant Face Cards Display

**Problem**: Duplicate "Your Face Cards" section was unnecessary

**Files Modified**:

- `src/components/game/GameBoard.tsx` (lines 271-281)

**Changes**:

- Removed entire redundant face cards section
- Cleaned up unused imports (`useState` removed)

**Impact**: Cleaner UI with less visual clutter

#### Issue 3: Player Role Indicators Missing

**Problem**: Difficult to identify Napoleon and Adjutant positions on game board

**Files Modified**:

- `src/components/game/GameBoard.tsx`

**Changes**:

- Added Napoleon "N" badge: `<span className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">N</span>`
- Added Adjutant "A" badge: `<span className="px-1 bg-green-600 text-green-100 rounded text-xs">A</span>`
- Implemented adjutant revelation logic: Only show "A" badge after adjutant card is played
- Applied to all 4 player positions (top, bottom, left, right) and face cards panel

**Impact**: Players can easily identify team roles and positions

### 🎮 Game Logic Improvements

#### Issue 4: Counter Jack vs Same 2 Rule Priority

**Problem**: "セイム2より裏Jの方が強い" (Counter Jack is stronger than Same 2 rule) was not working

**Files Modified**:

- `src/lib/napoleonCardRules.ts`

**Root Cause**: Counter Jack was being checked AFTER Same 2 rule, causing Same 2 to win incorrectly

**Changes**:

```typescript
// Before: Same 2 checked first
if (!isFirstPhase) {
  const same2Result = checkSame2Rule(phase, trumpSuit);
  if (same2Result) return same2Result;
}

// After: Counter Jack checked first, Same 2 only if no Counter Jack
if (!isFirstPhase) {
  const counterJackCard = phase.cards.find((pc) =>
    isCounterJack(pc.card, trumpSuit)
  );
  if (counterJackCard) {
    return counterJackCard;
  }

  const same2Conditions = checkSame2Conditions(phase, trumpSuit);
  if (same2Conditions.isValid) {
    return same2Conditions.twoCard;
  }
}
```

**Impact**: Correct rule hierarchy now enforced (Counter Jack > Same 2)

#### Issue 5: Napoleon Declaration Target Calculation

**Problem**: "Napoleon needs: X more face cards" showed incorrect numbers using fixed default

**Files Modified**:

- `src/lib/scoring.ts` (multiple functions)
- `src/components/game/GameStatus.tsx`

**Root Cause**: Used fixed `NAPOLEON_RULES.TARGET_FACE_CARDS: 13` instead of actual player declaration

**Changes**:

```typescript
// Before: Fixed value
const napoleonNeedsToWin = Math.max(
  0,
  NAPOLEON_RULES.TARGET_FACE_CARDS - napoleonTeam
);

// After: Dynamic value from declaration
const targetFaceCards =
  gameState.napoleonDeclaration?.targetTricks ??
  NAPOLEON_RULES.TARGET_FACE_CARDS;
const napoleonNeedsToWin = Math.max(0, targetFaceCards - napoleonTeam);
```

**Functions Updated**:

- `getGameProgress()`
- `calculateGameResult()`
- `isGameDecided()`
- GameStatus progress bar calculation

**Impact**: Accurate face card requirements based on actual player declarations

#### Issue 6: COM Auto-Progression During Modal Display

**Problem**: COM players were automatically advancing while phase result modal was still showing

**Files Modified**:

- `src/hooks/useGameState.ts` (lines 399-401)

**Root Cause**: AI auto-progression continued even during modal display with 2-second timeout

**Changes**:

```typescript
// Before: Auto-close modal after 2 seconds
if (gameState.showingPhaseResult) {
  setTimeout(() => {
    handleClosePhaseResult();
  }, 2000);
  return;
}

// After: Wait for user interaction
if (gameState.showingPhaseResult) {
  return; // Stop AI auto-progression, wait for user action
}
```

**Impact**: Proper timing control - COM only continues after user closes modal

### 🧪 Testing Improvements

#### New Test Cases Added

**Files Modified**:

- `tests/lib/napoleonCardRules.test.ts`
- `tests/lib/scoring.test.ts`

**New Tests**:

1. **Counter Jack vs Same 2 Priority Test**:

   ```typescript
   it('should prioritize counter jack over same 2 rule - detailed test', () => {
     // Comprehensive test ensuring Counter Jack wins over Same 2
     expect(winner?.playerId).toBe('p4'); // Counter Jack player
   });
   ```

2. **Napoleon Declaration Target Tests**:
   ```typescript
   it('should use Napoleon declaration target instead of default', () => {
     mockGameState.napoleonDeclaration = {
       targetTricks: 15, // Custom declaration
     };
     expect(result.napoleonNeedsToWin).toBe(13); // 15 - 2 = 13
   });
   ```

**Test Results**: All 146 tests pass, including 18 Napoleon card rules tests and 12 scoring tests

### 🔧 Technical Fixes

#### Linting and Dependencies

- Removed unused `handleClosePhaseResult` dependency from useEffect
- Fixed Biome linting violations with proper code formatting
- Maintained full CI/CD pipeline compliance (lint, type-check, format, test, build)

## Summary

**Total Changes**: 6 major improvements across UI, game logic, and testing
**Files Modified**: 5 core files + 2 test files
**Test Coverage**: 146 tests (5 new tests added)
**CI/CD Status**: ✅ All checks passing

**User Experience Impact**:

- ✅ Better visual clarity and role identification
- ✅ Correct game rule implementation
- ✅ Accurate score calculations
- ✅ Proper COM timing control

**Code Quality**: All improvements maintain strict TypeScript typing, comprehensive test coverage, and follow established coding standards.

---

## 2025-09-02 AI Strategy Enhancements & Game Flow Improvements

### 🤖 AI Strategy Improvements

#### Issue 7: COM Napoleon Adjutant Card Selection Enhancement

**Problem**: COM Napoleon was using generic card selection without prioritizing special cards

**Files Modified**:

- `src/lib/ai/napoleon.ts`

**Changes**:

- **Priority 1**: Mighty (Spades A) - if not in hand
- **Priority 2**: Trump Jack (Trump suit J) - if not in hand
- **Priority 3**: Counter Jack (Same color opposite suit J) - if not in hand
- **Priority 4**: Fallback to original logic (strong cards by rank)

```typescript
// New strategic adjutant card selection
export function selectAdjutantCard(
  hand: Card[],
  trumpSuit?: Suit
): Card | null {
  const currentTrumpSuit = trumpSuit || 'spades';

  // 1. Mighty (Spades A) - highest priority
  const mighty = {
    id: 'spades-A',
    suit: 'spades' as Suit,
    rank: 'A' as Rank,
    value: 14,
  };
  if (!hand.some((card) => card.id === mighty.id)) {
    return mighty;
  }

  // 2. Trump Jack - second priority
  const trumpJack = {
    id: `${currentTrumpSuit}-J`,
    suit: currentTrumpSuit,
    rank: 'J' as Rank,
    value: 11,
  };
  if (!hand.some((card) => card.id === trumpJack.id)) {
    return trumpJack;
  }

  // 3. Counter Jack - third priority
  const counterJackSuit = getCounterJackSuit(currentTrumpSuit);
  if (counterJackSuit) {
    const counterJack = {
      id: `${counterJackSuit}-J`,
      suit: counterJackSuit,
      rank: 'J' as Rank,
      value: 11,
    };
    if (!hand.some((card) => card.id === counterJack.id)) {
      return counterJack;
    }
  }

  // 4. Fallback to original logic
  // ...existing logic
}
```

**Impact**: COM Napoleon now strategically selects Mighty, Trump Jack, or Counter Jack as adjutant cards unless already in hand

#### Issue 8: COM Adjutant Early Revelation Strategy

**Problem**: COM adjutants were not revealing themselves early to Napoleon, making cooperation difficult

**Files Modified**:

- `src/lib/ai/strategicCardEvaluator.ts`

**Changes**:

- Added +500 bonus to adjutant designated card in strategic evaluation
- COM adjutants now prioritize playing their designated card early in the game

```typescript
// Enhanced adjutant strategy
function evaluateAdjutantStrategy(card: Card, gameState: GameState): number {
  let bonus = 0;
  const baseStrength = getCardStrengthSafe(card, gameState);
  if (baseStrength >= 400 && baseStrength <= 600) bonus += 50;

  // Early revelation bonus for adjutant designated card
  const adjutantCard = gameState.napoleonDeclaration?.adjutantCard;
  if (adjutantCard && card.id === adjutantCard.id) {
    bonus += 500; // High priority bonus for early adjutant revelation
  }
  return bonus;
}
```

**Impact**: COM adjutants reveal themselves early, enabling better Napoleon-Adjutant cooperation

### 🎮 Game Flow Improvements

#### Issue 9: Missing 12th Turn Trick Result Display

**Problem**: 12th turn (final turn) result modal was skipped, jumping directly to game results

**Files Modified**:

- `src/lib/gameLogic.ts`
- `src/hooks/useGameState.ts`

**Root Cause**: `completeTrick` function immediately set `FINISHED` phase without showing trick result for the final turn

**Changes**:

```typescript
// Before: Skip trick result for final turn
if (allTricks.length === 12) {
  return {
    ...gameState,
    phase: GAME_PHASES.FINISHED,
    // Missing showingTrickResult and lastCompletedTrick
  };
}

// After: Show trick result for final turn too
if (allTricks.length === 12) {
  return {
    ...gameState,
    phase: GAME_PHASES.FINISHED,
    showingTrickResult: true, // Show final trick result
    lastCompletedTrick: completedTrick, // Include final trick data
  };
}
```

**Frontend Changes**:

```typescript
// Added FINISHED phase handling in useGameState.ts
} else if (gameState.phase === GAME_PHASES.FINISHED) {
  // Wait for user to close final trick result modal
  if (gameState.showingTrickResult) {
    return // Stop processing until user closes modal
  }
}
```

**Impact**: Players now see who won the final trick before viewing game results

### 🧪 Testing Enhancements

#### New Test Files Created

**Files Added**:

- `tests/lib/ai/napoleon.test.ts` - 9 comprehensive tests
- `tests/lib/ai/strategicCardEvaluator.test.ts` - 3 strategic evaluation tests

**Test Coverage**:

1. **Adjutant Card Priority Tests**:

   ```typescript
   test('マイティー（スペードA）を持っていない場合、最優先で選択される', () => {
     const adjutantCard = selectAdjutantCard(hand, 'hearts');
     expect(adjutantCard).toEqual({
       id: 'spades-A',
       suit: 'spades',
       rank: 'A',
       value: 14,
     });
   });
   ```

2. **Strategic Card Evaluation Tests**:

   ```typescript
   test('副官指定カードに高いボーナスが付与される', () => {
     const adjutantValue = evaluateCardStrategicValue(
       adjutantCard,
       gameState,
       adjutantPlayer
     );
     const normalValue = evaluateCardStrategicValue(
       normalCard,
       gameState,
       adjutantPlayer
     );

     expect(adjutantValue).toBeGreaterThan(normalValue);
     expect(adjutantValue - normalValue).toBeGreaterThanOrEqual(450); // +500 bonus
   });
   ```

**Test Results**: All 142 tests pass, including new AI strategy tests

### 🔧 Technical Improvements

#### Code Quality Enhancements

- **Type Safety**: All new functions use strict TypeScript typing with proper Rank and Suit literals
- **Error Handling**: Comprehensive error handling for edge cases (empty hands, invalid trump suits)
- **Performance**: Strategic evaluation system with efficient card comparison algorithms
- **Maintainability**: Modular functions with clear separation of concerns

#### Counter Jack Suit Logic

```typescript
function getCounterJackSuit(trumpSuit: Suit): Suit | null {
  switch (trumpSuit) {
    case 'spades':
      return 'clubs'; // Black suits
    case 'clubs':
      return 'spades'; // Black suits
    case 'hearts':
      return 'diamonds'; // Red suits
    case 'diamonds':
      return 'hearts'; // Red suits
    default:
      return null;
  }
}
```

## Summary - 2025-01-01 Session 2

**Total Changes**: 3 major AI and game flow improvements
**Files Modified**: 4 core files + 2 new test files
**Test Coverage**: 142 tests (12 new tests added)
**CI/CD Status**: ✅ All checks passing

**AI Strategy Impact**:

- ✅ COM Napoleon now strategically selects special cards (Mighty, Trump Jack, Counter Jack) as adjutants
- ✅ COM Adjutants reveal themselves early through strategic card play (+500 bonus system)
- ✅ Enhanced cooperation between COM Napoleon and Adjutant players

**Game Flow Impact**:

- ✅ Final turn (12th turn) trick results now properly displayed before game results
- ✅ Consistent user experience across all 12 turns
- ✅ Better game narrative completion

**User Experience**:

- ✅ More strategic and realistic COM player behavior
- ✅ Complete game flow without missing final turn information
- ✅ Enhanced Napoleon-Adjutant team cooperation dynamics

**Code Quality**: All new implementations maintain strict TypeScript typing, comprehensive test coverage, and follow established architectural patterns.

---

## 2025-09-02 Adjutant Icon Reveal Feature Implementation

### 🎮 New Feature: Napoleon Hidden Card Adjutant Reveal

#### Issue 10: Adjutant Icon Display When Napoleon Plays From Hidden Cards

**Problem**: When Napoleon's declared adjutant card was among the hidden 4 cards, there was no visual indicator when Napoleon played that card to reveal the adjutant's identity.

**User Request**:

> "ナポレオンが宣言した副官が隠された4枚に入っていた場合、ナポレオンが副官指定のカードを出したタイミングで、副官アイコンをナポレオンアイコンと一緒に出す仕様に修正してほしい"
>
> (When Napoleon's declared adjutant card is in the hidden 4 cards, show the adjutant icon together with the Napoleon icon when Napoleon plays that designated card)

**Files Modified**:

- `src/types/game.ts`
- `src/lib/gameLogic.ts`
- `src/components/game/GameBoard.tsx`
- `src/components/game/GameStatus.tsx`
- `tests/lib/gameLogic.adjutant-reveal.test.ts` (new file)

### 🔧 Technical Implementation

#### 1. Type System Enhancement

**File**: `src/types/game.ts`

```typescript
export interface PlayedCard {
  card: Card;
  playerId: string;
  order: number;
  revealsAdjutant?: boolean; // New: Flag for when Napoleon reveals adjutant from hidden cards
}
```

**Impact**: Added optional flag to track when a played card reveals the adjutant's identity

#### 2. Game Logic Enhancement

**File**: `src/lib/gameLogic.ts`

```typescript
// Napoleon plays adjutant card from hidden cards special handling
let playedCardFlags = {};
if (
  player.isNapoleon &&
  gameState.napoleonDeclaration?.adjutantCard &&
  card.suit === gameState.napoleonDeclaration.adjutantCard.suit &&
  card.rank === gameState.napoleonDeclaration.adjutantCard.rank &&
  card.wasHidden // Flag indicating card was originally in hidden cards
) {
  playedCardFlags = { revealsAdjutant: true };
}

const playedCard: PlayedCard = {
  card,
  playerId,
  order: gameState.currentTrick.cards.length,
  ...playedCardFlags, // Apply reveal flag when conditions are met
};
```

**Logic**: Detects when Napoleon plays the adjutant-designated card that was originally in the hidden cards and sets the `revealsAdjutant` flag

#### 3. UI Component Updates

**File**: `src/components/game/GameBoard.tsx`

```typescript
// Unified player icons display logic
const getPlayerIcons = (
  player: { isNapoleon: boolean; isAdjutant: boolean },
  playedCard?: PlayedCard
) => {
  const icons = []

  // Napoleon icon
  if (player.isNapoleon) {
    icons.push(
      <span key="napoleon" className="px-1 bg-yellow-600 text-yellow-100 rounded text-xs">
        N
      </span>
    )
  }

  // Traditional adjutant icon (when adjutant player is revealed)
  const isAdjutantRevealed =
    player.isAdjutant &&
    gameState.tricks.some((trick) =>
      trick.cards.some(
        (playedCard) =>
          gameState.napoleonCard &&
          playedCard.card.id === gameState.napoleonCard.id
      )
    )

  if (isAdjutantRevealed) {
    icons.push(
      <span key="adjutant" className="px-1 bg-green-600 text-green-100 rounded text-xs">
        A
      </span>
    )
  }

  // NEW: Show adjutant icon when Napoleon plays adjutant card from hidden cards
  if (playedCard?.revealsAdjutant && player.isNapoleon) {
    icons.push(
      <span key="adjutant-reveal" className="px-1 bg-green-600 text-green-100 rounded text-xs">
        A
      </span>
    )
  }

  return icons
}
```

**Impact**: Napoleon now displays both "N" (Napoleon) and "A" (Adjutant) icons when playing the adjutant card from hidden cards

**File**: `src/components/game/GameStatus.tsx`

```typescript
// Enhanced adjutant revelation detection logic
const isAdjutantRevealed =
  gameState.phase === GAME_PHASES.PLAYING &&
  // Case 1: Adjutant player played the adjutant card (traditional)
  ((adjutantPlayer &&
    gameState.tricks.some((trick) =>
      trick.cards.some(
        (playedCard) =>
          gameState.napoleonCard &&
          playedCard.card.id === gameState.napoleonCard.id
      )
    )) ||
    // Case 2: Napoleon played adjutant card from hidden cards (new feature)
    gameState.tricks.some((trick) =>
      trick.cards.some((playedCard) => playedCard.revealsAdjutant)
    ) ||
    // Case 3: Current trick has Napoleon playing adjutant card from hidden cards
    gameState.currentTrick.cards.some(
      (playedCard) => playedCard.revealsAdjutant
    ));
```

**Impact**: Teams section now correctly shows the adjutant as revealed instead of "??? (Hidden)" when Napoleon plays the adjutant card from hidden cards

### 🧪 Comprehensive Testing

#### New Test File: `tests/lib/gameLogic.adjutant-reveal.test.ts`

**Test Scenarios**:

1. **Positive Case**: Napoleon plays adjutant card from hidden cards

   ```typescript
   test('should set revealsAdjutant flag when Napoleon plays adjutant card from hidden cards', () => {
     // Verifies revealsAdjutant: true is set correctly
   });
   ```

2. **Negative Case**: Napoleon plays regular card

   ```typescript
   test('should NOT set revealsAdjutant flag when Napoleon plays regular card', () => {
     // Ensures no false positives for regular cards
   });
   ```

3. **Edge Case**: Non-Napoleon player plays adjutant card

   ```typescript
   test('should NOT set revealsAdjutant flag when non-Napoleon player plays adjutant card', () => {
     // Only Napoleon can reveal adjutant from hidden cards
   });
   ```

4. **Edge Case**: Napoleon plays adjutant card not from hidden cards
   ```typescript
   test('should NOT set revealsAdjutant flag when Napoleon plays adjutant card that was not hidden', () => {
     // Only works for cards that were originally in hidden cards
   });
   ```

**Test Coverage**: All 4 test scenarios pass, covering positive case, negative case, and edge cases

### 🎯 User Experience Impact

#### Before Implementation:

- When Napoleon's adjutant card was in hidden cards, no visual indication when Napoleon played it
- Teams section continued showing "??? (Hidden)" for adjutant
- Players had to manually track which card revealed the adjutant

#### After Implementation:

- ✅ Napoleon displays both "N" and "A" icons when playing adjutant card from hidden cards
- ✅ Teams section immediately shows adjutant as revealed
- ✅ Clear visual feedback for adjutant revelation moment
- ✅ Consistent with existing adjutant revelation UI patterns

### 🔧 Technical Quality

#### Code Quality Measures:

- **Type Safety**: All new code uses strict TypeScript typing with proper interfaces
- **Error Handling**: Comprehensive null checks and type guards
- **Performance**: Efficient card matching using ID comparison
- **Maintainability**: Modular functions with clear separation of concerns

#### CI/CD Pipeline Results:

```bash
✅ Linting: No issues found
✅ Type Check: No TypeScript errors
✅ Formatting: All files properly formatted
✅ Tests: All 146 tests pass (4 new tests added)
✅ Build: Next.js production build successful
```

## Summary - Adjutant Reveal Feature

**Total Changes**: 1 major feature implementation across 4 core files + 1 new test file
**Files Modified**: 4 existing files + 1 new test file
**Test Coverage**: 146 tests total (4 new tests specifically for this feature)
**CI/CD Status**: ✅ All checks passing

**Feature Implementation**:

- ✅ Complete adjutant revelation system when Napoleon plays from hidden cards
- ✅ Unified icon display logic across all UI components
- ✅ Enhanced Teams section logic for accurate adjutant status tracking
- ✅ Comprehensive test coverage for all scenarios and edge cases

**User Experience**:

- ✅ Clear visual indication when Napoleon reveals adjutant identity
- ✅ Immediate UI updates across GameBoard and GameStatus components
- ✅ Consistent behavior with existing game mechanics
- ✅ Enhanced game narrative and strategic feedback

**Technical Excellence**: All implementations follow established TypeScript patterns, maintain comprehensive test coverage, and integrate seamlessly with existing game architecture.

---

## 2025-09-03 Type System & Constants Refactoring

### 🔧 State Management & Type System Improvements

#### Issue 11: Circular Import Dependencies & Type Definitions

**Problem**: Hard-coded type definitions in `game.ts` and circular import dependencies between types and constants

**Files Modified**:

- `src/types/game.ts`
- `src/lib/constants.ts`
- `src/components/game/NapoleonSelector.tsx`
- `src/lib/napoleonRules.ts`

**Root Cause**:

- `Suit` and `Rank` types were hardcoded string literals in game.ts
- Constants file was importing types from game.ts while game.ts needed constants
- Created circular dependency: game.ts ↔ constants.ts

#### Changes

**1. Import Structure Optimization**

```typescript
// Before: game.ts had hardcoded types
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank =
  'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

// After: game.ts imports from constants
import type {
  ACTION_TYPES,
  GAME_PHASES,
  GAME_ROOM_STATUS,
  RANKS,
  SUITS,
} from '@/lib/constants';

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
```

**2. Constants Definition Restructuring**

```typescript
// Before: constants.ts imported types first
import type { Card, Rank, Suit } from '@/types/game';

export const SUITS: Suit[] = [
  SUIT_ENUM.SPADES,
  SUIT_ENUM.HEARTS,
  SUIT_ENUM.DIAMONDS,
  SUIT_ENUM.CLUBS,
];

// After: constants.ts defines arrays first, then imports types
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;

export const RANKS = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
] as const;

import type { Card, Rank, Suit } from '@/types/game';
```

**3. Readonly Array Compatibility Fixes**

**Problem**: `as const` arrays are readonly, but some functions expected mutable arrays

```typescript
// Before: Readonly array type errors
const availableSuits: Suit[] = SUITS; // Error: readonly array → mutable array

// After: Array spread for mutable copies
const availableSuits: Suit[] = [...SUITS]; // OK: creates mutable copy
```

**Files Fixed**:

- `src/components/game/NapoleonSelector.tsx:121`
- `src/lib/napoleonRules.ts:91, 119`

**Impact**:

- ✅ Eliminated circular dependencies
- ✅ Single source of truth for Suit/Rank definitions
- ✅ Type-safe constant-derived types using `(typeof ARRAY)[number]` pattern
- ✅ Maintained backward compatibility with all existing code

#### 4. Import Cleanup & Organization

**Before**: Mixed import patterns across files

```typescript
import { GAME_PHASES, ACTION_TYPES, GAME_ROOM_STATUS } from '@/lib/constants';
// ... scattered typeof import() usage in type definitions
```

**After**: Centralized import pattern

```typescript
import type {
  ACTION_TYPES,
  GAME_PHASES,
  GAME_ROOM_STATUS,
  RANKS,
  SUITS,
} from '@/lib/constants';
```

**Type Definitions Updated**:

- `GamePhase` type: Used imported `GAME_PHASES` constants
- `GameAction` type: Used imported `ACTION_TYPES` constants
- `GameRoom` status: Used imported `GAME_ROOM_STATUS` constants

### 🧪 Quality Assurance

#### TypeScript Compilation Results

```bash
# Before fixes:
> pnpm type-check
src/types/game.ts(9,13): error TS2456: Type alias 'Suit' has a circular reference to itself.
src/types/game.ts(10,13): error TS2456: Type alias 'Rank' has a circular reference to itself.
# ... 20+ additional type errors

# After fixes:
> pnpm type-check
# ✅ No errors - clean compilation
```

#### Code Quality Improvements

- **Type Safety**: Enhanced with indexed access types `(typeof ARRAY)[number]`
- **Maintainability**: Single source of truth for all game constants
- **Consistency**: Unified import patterns across the entire codebase
- **Performance**: No runtime impact, compile-time optimizations only

### 🔧 Technical Implementation Details

#### Indexed Access Type Pattern

```typescript
// Modern TypeScript pattern for deriving union types from const arrays
export const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
export type Suit = (typeof SUITS)[number]; // 'spades' | 'hearts' | 'diamonds' | 'clubs'

// Benefits:
// 1. Single source of truth - modify SUITS array, type updates automatically
// 2. Type-safe - compiler ensures consistency
// 3. IntelliSense support - autocomplete works perfectly
// 4. Refactor-safe - renaming values updates both runtime and types
```

#### Circular Dependency Resolution Strategy

```mermaid
graph TD
    A[constants.ts] -->|defines| B[SUITS, RANKS arrays]
    B -->|imports after definition| C[types from game.ts]
    D[game.ts] -->|imports| A
    D -->|derives types from| B
```

**Resolution**: Define primitive constants first, import complex types second

## Summary - Type System Refactoring

**Total Changes**: 1 major architectural improvement across 4 files
**Files Modified**: 4 core files (types, constants, components, rules)
**TypeScript Errors Fixed**: 20+ circular dependency and type errors resolved
**CI/CD Status**: ✅ All checks passing

**Type System Impact**:

- ✅ Eliminated all circular import dependencies
- ✅ Established single source of truth for game constants
- ✅ Modern TypeScript patterns with indexed access types
- ✅ Enhanced type safety and maintainability

**Code Quality Impact**:

- ✅ Consistent import patterns across entire codebase
- ✅ Reduced code duplication and hardcoded values
- ✅ Better IntelliSense and refactoring support
- ✅ Compile-time type validation improvements

**Developer Experience**:

- ✅ Clean TypeScript compilation without errors
- ✅ Better IDE support with accurate type hints
- ✅ Simplified maintenance through centralized constants
- ✅ Future-proof architecture for adding new game elements

**Technical Excellence**: All refactoring maintains strict backward compatibility while significantly improving code organization, type safety, and development experience.
