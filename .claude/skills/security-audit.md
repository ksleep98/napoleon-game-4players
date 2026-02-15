# Security Audit Skill

## 目的

アプリケーションのセキュリティ監査を実行し、脆弱性を検出・修正するスキル。依存関係の脆弱性チェック、環境変数チェック、RLSポリシー確認などを行います。

**注意**: このスキルは `/security-audit` で実行してください。`/security-review` はClaude Code組み込みのPRコードレビュー用スキルです。

## セキュリティチェックリスト

### 1. 依存関係の脆弱性チェック

```bash
# pnpm audit実行
pnpm audit

# 高・重大な脆弱性のみ表示
pnpm audit --audit-level=high

# 自動修正（可能な場合）
pnpm audit --fix
```

### 2. 環境変数チェック

```bash
# .envファイルがGit追跡されていないか確認
git check-ignore .env .env.local .env.production

# 環境変数が正しく設定されているか確認
cat .env.example  # テンプレート確認
```

**重要な環境変数:**

- ✅ `.env.example` - Git追跡OK（値なしのテンプレート）
- ❌ `.env`, `.env.local`, `.env.production` - Git追跡NG

**環境変数の種類:**

```bash
# 公開OK（クライアント側で使用）
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# 秘密（サーバー側のみ使用）
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...
```

### 3. RLS（Row Level Security）チェック

```sql
-- Supabase Studioで確認
-- https://supabase.com/dashboard/project/[PROJECT_ID]/editor

-- テーブルのRLS有効化確認
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';

-- RLSポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'games';
```

**すべての公開テーブルでRLSを有効化:**

```sql
-- RLS有効化
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;

-- ポリシー作成例
CREATE POLICY "Users can view their own games"
  ON public.games
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.id = ANY(games.state->'players'->>'id')
      AND players.id = auth.uid()
    )
  );
```

### 4. Server Actions セキュリティ

```typescript
// ✅ 良い例：入力検証 + Server Action
'use server';

import { z } from 'zod';

const GameIdSchema = z.string().uuid();
const PlayerIdSchema = z.string().uuid();

export async function loadGameStateAction(gameId: string, playerId: string) {
  // 入力検証
  const validatedGameId = GameIdSchema.parse(gameId);
  const validatedPlayerId = PlayerIdSchema.parse(playerId);

  // セキュアな処理
  const { data, error } = await supabase
    .from('games')
    .select('*')
    .eq('id', validatedGameId)
    .single();

  if (error) {
    return { success: false, error: error.message };
  }

  // プレイヤー権限チェック
  const isPlayerInGame = data.state.players.some(
    (p) => p.id === validatedPlayerId
  );
  if (!isPlayerInGame) {
    return { success: false, error: 'Unauthorized' };
  }

  return { success: true, gameState: data.state };
}

// ❌ 悪い例：入力検証なし
export async function loadGameStateAction(gameId: string, playerId: string) {
  // 直接使用（SQLインジェクションリスク）
  const { data } = await supabase
    .from('games')
    .select('*')
    .eq('id', gameId) // 検証なし
    .single();

  return data; // エラーハンドリングなし
}
```

### 5. XSS（クロスサイトスクリプティング）対策

```typescript
// ✅ 良い例：Reactの自動エスケープ
export function PlayerName({ name }: { name: string }) {
  return <h3>{name}</h3>  // 自動エスケープ
}

// ❌ 悪い例：dangerouslySetInnerHTML使用
export function PlayerName({ name }: { name: string }) {
  return <h3 dangerouslySetInnerHTML={{ __html: name }} />  // XSSリスク
}

// ✅ サニタイズ必要な場合
import DOMPurify from 'dompurify'

export function SafeHTML({ html }: { html: string }) {
  const sanitized = DOMPurify.sanitize(html)
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} />
}
```

### 6. CSRF（クロスサイトリクエストフォージェリ）対策

Next.js Server Actionsは自動的にCSRF対策済み。

```typescript
// ✅ Server Actionsは安全
'use server';

export async function updateGameAction(gameId: string, playerId: string) {
  // CSRFトークンが自動的に検証される
  // ...
}
```

### 7. レート制限（Rate Limiting）

```typescript
// Vercel Edge Middleware例
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'), // 10秒間に10リクエスト
});

export async function middleware(request: Request) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown';
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return new Response('Too Many Requests', { status: 429 });
  }

  return NextResponse.next();
}
```

### 8. 認証トークンの安全な保存

```typescript
// ✅ 良い例：httpOnlyクッキー
import { cookies } from 'next/headers';

export async function setAuthToken(token: string) {
  cookies().set('auth_token', token, {
    httpOnly: true, // JavaScriptからアクセス不可
    secure: true, // HTTPS必須
    sameSite: 'strict', // CSRF対策
    maxAge: 60 * 60 * 24 * 7, // 7日間
  });
}

// ❌ 悪い例：localStorage（XSSリスク）
localStorage.setItem('auth_token', token);
```

## 自動セキュリティチェック

### GitHub Actions（CI/CD）

```yaml
# .github/workflows/security-check.yml
name: Security Check

on: [push, pull_request]

jobs:
  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2

      # 依存関係の脆弱性チェック
      - name: Audit dependencies
        run: pnpm audit --audit-level=high

      # 環境変数チェック
      - name: Check for exposed secrets
        run: |
          if git log --all --full-history -- .env .env.local .env.production; then
            echo "❌ Secrets committed to Git!"
            exit 1
          fi
```

## セキュリティチェック実行

```bash
# 全セキュリティチェック実行
pnpm run security:check

# または手動で各チェック実行
pnpm audit
pnpm type-check
pnpm lint
git check-ignore .env .env.local
```

## チェックリスト

デプロイ前に確認：

- [ ] `pnpm audit`で脆弱性なし
- [ ] 環境変数がGit追跡されていない
- [ ] すべての公開テーブルでRLS有効化
- [ ] Server Actionsで入力検証実装
- [ ] XSS対策（自動エスケープ）
- [ ] CSRF対策（Server Actions使用）
- [ ] 認証トークンは安全に保存（httpOnlyクッキー）
- [ ] レート制限設定（必要に応じて）

## トラブルシューティング

### 依存関係の脆弱性

```bash
# 詳細確認
pnpm audit --json > audit.json

# 特定パッケージの更新
pnpm update <package-name>

# メジャーバージョンアップ
pnpm add <package-name>@latest
```

### RLSポリシーエラー

```sql
-- ポリシー確認
SELECT * FROM pg_policies WHERE tablename = 'games';

-- ポリシー削除
DROP POLICY IF EXISTS "policy_name" ON public.games;

-- ポリシー再作成
CREATE POLICY "..." ON public.games ...;
```

## 参考リンク

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Next.js Security](https://nextjs.org/docs/app/building-your-application/configuring/security)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Security Setup Guide](../docs/security/RLS_SETUP.md)
- [Development Security Guide](../docs/security/DEVELOPMENT_SECURITY.md)
