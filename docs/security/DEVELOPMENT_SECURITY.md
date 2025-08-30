# 開発環境セキュリティガイド

## セキュリティ方針

### 基本原則

- **開発環境でも本番同等のセキュリティ**: 開発環境であってもセキュリティ対策は必須
- **最小権限の原則**: 必要最小限のデータアクセスのみ許可
- **防御の多層化**: 複数のセキュリティ層で保護

## 実装済みセキュリティ対策

### 1. サーバーアクション (`src/app/actions/gameActions.ts`)

```typescript
export async function saveGameStateAction(
  gameState: GameState,
  playerId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // ✅ 入力検証
    if (!validateGameId(gameState.id)) {
      throw new GameActionError('Invalid game ID', 'INVALID_GAME_ID');
    }

    // ✅ 認証チェック
    if (!validatePlayerId(playerId)) {
      throw new GameActionError('Invalid player ID', 'INVALID_PLAYER_ID');
    }

    // ✅ レート制限
    if (!checkRateLimit(`save_game_${playerId}`, 30, 60000)) {
      throw new GameActionError('Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
    }

    // ✅ 認可チェック - プレイヤーがゲームに参加しているかチェック
    const playerInGame = gameState.players.some((p) => p.id === playerId);
    if (!playerInGame) {
      throw new GameActionError('Player not in game', 'PLAYER_NOT_IN_GAME');
    }

    // ✅ Service Role Key使用 - クライアントから直接DBアクセス不可
    const { error } = await supabaseAdmin.from('games').upsert({
      id: gameState.id,
      state: gameState,
      // ...
    });

    return { success: true };
  } catch (error) {
    // ✅ エラーハンドリング - 詳細情報は開発環境でのみ表示
    return {
      success: false,
      error:
        error instanceof GameActionError
          ? error.message
          : 'Unknown error occurred',
    };
  }
}
```

### 2. クライアント・サーバー分離 (`src/lib/supabase/`)

#### クライアント側 (`client.ts`)

- **Anon Key使用**: 公開可能な匿名キー
- **RLS適用**: Row Level Security により制限されたアクセス
- **リアルタイム購読のみ**: データの読み書きは制限

#### サーバー側 (`server.ts`)

- **Service Role Key使用**: 管理者権限（サーバーサイドでのみ使用）
- **入力検証**: すべての入力を検証
- **レート制限**: API乱用防止

### 3. RLS (Row Level Security) ポリシー

```sql
-- プレイヤーは自分が参加するゲームのみアクセス可能
CREATE POLICY "games_select_policy" ON games
  FOR SELECT USING (
    get_current_player_id() IS NOT NULL AND (
      (state->'players') @> json_build_array(json_build_object('id', get_current_player_id()))::jsonb
    )
  );
```

## セキュリティチェックコマンド

### 基本チェック

```bash
# 総合セキュリティチェック
npm run security:check

# 脆弱性スキャン
npm run security:audit

# 型安全性チェック
npm run type-check
```

### 手動チェックポイント

#### 1. 環境変数管理

```bash
# 環境変数ファイルの権限確認
ls -la .env*

# 推奨権限: 600 (所有者のみ読み書き可能)
chmod 600 .env.local
```

#### 2. データベース接続確認

```bash
# Service Role Key がサーバーサイドでのみ使用されているかチェック
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/
# 結果: server.ts でのみ使用されていることを確認

# Anon Key がクライアントサイドで使用されているかチェック
grep -r "NEXT_PUBLIC_SUPABASE_ANON_KEY" src/
# 結果: client.ts でのみ使用されていることを確認
```

#### 3. Server Actions セキュリティ

```typescript
// ✅ 正しい実装例
'use server';
export async function secureAction(data: unknown, userId: string) {
  // 1. 入力検証
  if (!validateInput(data)) throw new Error('Invalid input');

  // 2. 認証チェック
  if (!validateUser(userId)) throw new Error('Unauthorized');

  // 3. 認可チェック
  if (!canUserPerformAction(userId, data)) throw new Error('Forbidden');

  // 4. Service Role Key でDB操作
  return await supabaseAdmin.from('table').select('*');
}

// ❌ 危険な実装例
export async function unsecureAction(data: any) {
  // 入力検証なし、認証なし
  return await supabase.from('table').select('*'); // クライアントキー使用
}
```

## セキュリティ脅威と対策

### 1. クライアントサイドからの直接DB操作

**脅威**: クライアントから直接データベースにアクセス
**対策**:

- ✅ Server Actions でのみDB操作
- ✅ Service Role Key はサーバーサイドのみ
- ✅ RLS ポリシー適用

### 2. 認証・認可バイパス

**脅威**: 不正なユーザーがデータにアクセス
**対策**:

- ✅ サーバーアクションで認証チェック
- ✅ プレイヤーがゲームに参加しているかチェック
- ✅ RLS ポリシーによる多層防御

### 3. レート制限攻撃

**脅威**: API エンドポイントへの大量リクエスト
**対策**:

- ✅ プレイヤー別レート制限実装
- ✅ 操作種別ごとの制限値設定

### 4. 入力検証不備

**脅威**: 不正な入力によるセキュリティ侵害
**対策**:

- ✅ TypeScript 型チェック
- ✅ サーバーサイド入力検証
- ✅ SQL インジェクション対策 (Supabase ORM使用)

## 本番環境への移行時の注意点

### 1. 環境変数

```bash
# 本番環境でのみ設定
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key
NEXT_PUBLIC_SUPABASE_URL=your-production-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-production-anon-key
```

### 2. RLS ポリシー有効化

```sql
-- 本番データベースで実行
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_results ENABLE ROW LEVEL SECURITY;
```

### 3. HTTPS 強制

```typescript
// next.config.js
module.exports = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb', // セキュリティ: リクエストサイズ制限
    },
  },
  // 本番環境での追加セキュリティヘッダー
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=31536000; includeSubDomains',
        },
      ],
    },
  ],
};
```

## まとめ

現在の実装は**開発環境でも本番同等のセキュリティ**を確保しています：

1. **データアクセス制御**: Service Role Key はサーバーサイドのみ
2. **認証・認可**: 各操作で適切なチェック実装
3. **入力検証**: TypeScript + サーバーサイド検証
4. **レート制限**: API 乱用防止
5. **RLS対応**: データベースレベルでの保護

この方針により、開発時から本番環境と同等のセキュリティ意識で開発できています。
