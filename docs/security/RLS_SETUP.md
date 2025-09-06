# Supabase RLS セキュリティ設定ガイド

このドキュメントでは、Napoleon Gameアプリケーションでのsupabase Row Level Security (RLS) の設定方法を説明します。

## 概要

RLSポリシーの有効化により、以下のセキュリティが強化されます：

- **データ隔離**: プレイヤーは自分が参加しているゲームのデータのみアクセス可能
- **認証済みアクセス**: 適切なプレイヤーセッションが必要
- **サーバーサイド保護**: サーバーアクションによるデータベース操作

## 環境変数設定

`.env.local`ファイルに以下を追加：

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Server-side Supabase Configuration (REQUIRED for RLS bypass)
# ⚠️ Without this key, game saves will fail with RLS policy violations
# 📝 2025-09-06: 新API Keys形式 (sb_secret_*) と Legacy JWT (eyJ*) の両方に対応
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## 🔄 2025-09-06 Authentication Update

### 新API Keys認証システム

**✅ 完了した改善**:

- 新Supabase API Keys形式 (`sb_secret_*`) 完全対応
- Legacy JWT形式 (`eyJ*`) との互換性維持
- 認証失敗時のREST APIフォールバック機能
- Service Role Key自動診断機能

**実装詳細**:

```typescript
// 自動診断によるAPI Key形式検出
const diagnosis = diagnoseServiceRoleKey();
if (diagnosis.isNewApiKey) {
  // 新API Keys専用の認証設定
  headers.apikey = serviceRoleKey;
  headers.Authorization = `Bearer ${serviceRoleKey}`;
}
```

**トラブルシューティング実績**:

- ❌ 問題: "new row violates row-level security policy"
- ✅ 解決: クライアントサイドの直接DB呼び出しをServer Actions化
- ❌ 問題: POST 401 Unauthorized
- ✅ 解決: 新API Keys形式対応 + REST APIフォールバック

## RLSポリシー設定手順

### 1. Supabaseダッシュボードでの設定

1. Supabaseプロジェクトのダッシュボードにアクセス
2. **SQL Editor**を選択
3. `docs/supabase/rls-policies.sql`の内容を実行

### 2. 設定内容確認

```sql
-- RLSの有効化確認
SELECT * FROM rls_policy_status;
```

### 3. プレイヤーセッション設定

アプリケーション側では、プレイヤーログイン時に以下が実行されます：

```typescript
import { setPlayerSession } from '@/lib/supabase/client';

// プレイヤーIDをセッションに設定
await setPlayerSession(playerId);
```

## セキュリティ機能

### 1. データアクセス制御

- **ゲームデータ**: プレイヤーが参加しているゲームのみアクセス可能
- **プレイヤーデータ**: 自分のデータのみ管理可能
- **ゲーム結果**: 参加したゲームの結果のみ閲覧可能

### 2. サーバーアクション

以下の操作がサーバーサイドで保護されます：

- `saveGameStateAction`: ゲーム状態保存
- `loadGameStateAction`: ゲーム状態読み込み
- `saveGameResultAction`: ゲーム結果保存
- `createPlayerAction`: プレイヤー作成

### 3. レート制限

APIアクセスにレート制限が適用されます：

- ゲーム保存: 30回/分
- ゲーム読み込み: 60回/分
- プレイヤー作成: 5回/分

## エラーハンドリング

### 一般的なエラーと対処法

1. **"Player session not found"**
   - プレイヤーセッションが設定されていない
   - 対処: ページをリロードしてプレイヤーセッションを再設定

2. **"Player not in game"**
   - プレイヤーがゲームに参加していない
   - 対処: 正しいゲームIDでアクセスしているか確認

3. **"Rate limit exceeded"**
   - APIアクセス制限に達した
   - 対処: 少し待ってから再試行

## 開発環境での注意事項

開発環境では以下の制限緩和が適用されます：

- `get_current_player_id() IS NULL`の場合は制限を緩和
- 本番環境では必ず適切なプレイヤーセッションが必要

## テスト方法

### 1. RLS動作確認

```typescript
// 正常ケース: 参加しているゲームにアクセス
const gameState = await loadGameState('game_id');

// エラーケース: 参加していないゲームにアクセス
// → "Player not in game" エラー
```

### 2. レート制限確認

```typescript
// 大量のリクエストを送信してレート制限をテスト
for (let i = 0; i < 100; i++) {
  await saveGameState(gameState);
}
// → "Rate limit exceeded" エラー
```

## 本番デプロイメント

本番環境では以下を確認：

1. 環境変数が正しく設定されていること
2. RLSポリシーが有効になっていること
3. Service Role Keyが安全に管理されていること

## トラブルシューティング

### よくある問題

1. **データベース接続エラー**
   - 環境変数の確認
   - Supabaseプロジェクトのステータス確認

2. **RLSポリシー違反**
   - プレイヤーセッションの設定確認
   - ゲーム参加状態の確認

3. **サーバーアクションエラー**
   - Service Role Keyの確認
   - サーバーサイドの実行環境確認

### ログの確認

```typescript
// クライアントサイドのエラー確認
console.error('Game service error:', error);

// サーバーサイドのエラー確認
// Vercelの場合: Functions logs を確認
```
