# Performance Monitoring Guide

## 概要

Vercel vs ローカル環境の性能差を定量化・分析するためのパフォーマンス監視システム

## 🚀 クイックスタート

### 1. 環境変数設定

```bash
# .env.local に追加
NEXT_PUBLIC_ENABLE_PERF_MONITOR=true
```

### 2. アプリケーションに統合

```tsx
// app/layout.tsx または pages/_app.tsx
import { PerformanceProvider } from '@/components/debug/PerformanceDashboard';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <PerformanceProvider>{children}</PerformanceProvider>
      </body>
    </html>
  );
}
```

### 3. 既存コードにパフォーマンス測定を追加

```tsx
// Before: 通常のSupabase呼び出し
const { data } = await supabase.from('games').select('*');

// After: パフォーマンス測定付き
import { performanceSupabase } from '@/lib/supabase/performanceClient';
const { data } = await performanceSupabase.getGameState(gameId);
```

## 📊 パフォーマンスダッシュボード

開発環境で右上の「📊 Perf」ボタンをクリック

### 表示内容

- **Environment**: 現在の実行環境（Local/Vercel）
- **Response Times**: レスポンス時間統計
  - 平均・中央値・95パーセンタイル
- **Environment Comparison**: 環境別パフォーマンス比較
- **Recent**: 最新の測定結果

### アクション

- **🧪 Run Performance Test**: 包括的なテスト実行
- **Clear Data**: 測定データリセット
- **Export Log**: コンソールにレポート出力

## 🔍 測定項目

### データベース操作

- `db_select_*`: SELECT クエリ
- `db_update_*`: UPDATE 操作
- `db_insert_*`: INSERT 操作
- `db_rpc_*`: RPC関数呼び出し

### API操作

- `api_GET_*`: GET リクエスト
- `api_POST_*`: POST リクエスト
- `connection_test`: 接続テスト

### リアルタイム

- `realtime_*`: リアルタイム更新の受信遅延

## 📋 パフォーマンステスト

自動実行される包括的なテスト：

1. **Connection Test**: データベース・認証接続遅延
2. **Simple Query**: 基本的なSELECTクエリ
3. **Complex Query**: JOIN付き複雑クエリ
4. **Update Operation**: データ更新操作
5. **Realtime Setup**: リアルタイム接続設定

## 💻 コンソールAPI

開発者コンソールで使用可能：

```javascript
// パフォーマンス統計取得
window.__perfMonitor.getStats();

// 環境比較データ
window.__perfMonitor.getEnvironmentComparison();

// 詳細レポート生成
console.log(window.__perfMonitor.generateReport());

// 特定操作のみフィルタ
window.__perfMonitor.getStats('db_select');
```

## 🛠️ カスタム測定

独自の処理にパフォーマンス測定を追加：

```tsx
import { performanceMonitor } from '@/lib/performance/monitor';

// 汎用測定
const result = await performanceMonitor.measure(
  'custom_operation',
  () => heavyOperation(),
  { metadata: 'any' }
);

// データベース専用測定
const data = await performanceMonitor.measureDatabase(
  'select',
  () => supabase.from('table').select('*'),
  {
    table: 'table_name',
    queryType: 'complex',
  }
);

// API専用測定
const response = await performanceMonitor.measureAPI(
  '/api/endpoint',
  'POST',
  () => fetch('/api/endpoint', { method: 'POST' })
);
```

## 📈 分析ガイドライン

### パフォーマンス評価基準

**レスポンス時間の目安:**

- 🟢 **Excellent**: < 100ms
- 🟡 **Good**: 100-500ms
- 🟠 **Slow**: 500-1000ms
- 🔴 **Very Slow**: > 1000ms

**主な遅延原因の特定:**

1. **Geographic Latency**: 全体的に遅い場合
   - 地理的距離（日本 ↔ US East）
   - 対策: Asia Pacific リージョン移行

2. **Cold Start**: 初回のみ遅い場合
   - Vercel Serverless Functions のウォームアップ
   - 対策: 定期的なping、Edge Functions使用

3. **Database Connection**: DB操作が遅い場合
   - 接続プール設定
   - 対策: 接続数最適化、キャッシュ導入

4. **Complex Queries**: 特定クエリが遅い場合
   - JOIN、サブクエリの最適化
   - 対策: インデックス追加、クエリ分割

### 環境別比較分析

```javascript
// 環境比較レポート
const comparison = window.__perfMonitor.getEnvironmentComparison();

// Vercel vs Local の平均遅延差
const vercelAvg = comparison.vercel?.average || 0;
const localAvg = comparison.local?.average || 0;
const difference = vercelAvg - localAvg;

console.log(`Vercel is ${difference.toFixed(2)}ms slower than local`);
```

## 🔧 トラブルシューティング

### パフォーマンスダッシュボードが表示されない

- `NODE_ENV=development` を確認
- `NEXT_PUBLIC_ENABLE_PERF_MONITOR=true` を設定
- ブラウザのコンソールでエラーチェック

### 測定データが記録されない

- パフォーマンス測定付きの関数を使用しているか確認
- `performanceSupabase` を `supabase` の代わりに使用

### 異常に高い値が記録される

- ネットワーク状況の確認
- ブラウザの開発者ツールが影響していないか確認
- 初回アクセス時のコールドスタートでないか確認

## 📝 ベストプラクティス

1. **定期的な測定**: 機能追加時に必ず測定実行
2. **環境別比較**: ローカル・Vercel両方でテスト
3. **ボトルネック特定**: 遅い操作から優先的に最適化
4. **ベースライン設定**: 改善前後の数値を記録
5. **実環境での検証**: 開発環境だけでなく本番環境でも確認

## 🎯 最適化のロードマップ

### Phase 1: 測定・分析（現在）

- [x] パフォーマンス測定システム構築
- [x] 基本的な遅延データ収集
- [x] 環境別比較機能

### Phase 2: 即効性のある改善

- [ ] Supabase接続設定の最適化
- [ ] 頻繁なクエリのキャッシュ導入
- [ ] 不要なAPI呼び出しの削減

### Phase 3: 根本的な改善

- [ ] Supabase Asia Pacific移行検討
- [ ] Edge Functions活用
- [ ] CDN最適化

## 📚 参考資料

- [Next.js Performance Monitoring](https://nextjs.org/docs/advanced-features/measuring-performance)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Vercel Edge Network](https://vercel.com/docs/concepts/edge-network/overview)
