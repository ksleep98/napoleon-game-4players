# Review PR Skill

このスキルは、プルリクエストのレビューを効率的かつ効果的に行うためのガイドです。

## レビューの目的

1. **品質保証**: バグ、セキュリティ脆弱性、パフォーマンス問題の検出
2. **知識共有**: チーム全体でコードベースの理解を深める
3. **ベストプラクティス**: コーディング規約、アーキテクチャパターンの維持
4. **継続的改善**: コードの可読性、保守性、拡張性の向上

## レビュープロセス

### 1. PR概要の確認

- [ ] タイトルがConventional Commits形式に従っているか
- [ ] 説明文が変更内容を明確に説明しているか
- [ ] 関連Issueがリンクされているか
- [ ] ラベルが適切に設定されているか

### 2. CI/CDチェック

- [ ] すべてのCIチェックが合格しているか
  - Lint & Format
  - Type Check
  - Unit Tests
  - E2E Tests（該当する場合）
- [ ] ビルドが成功しているか
- [ ] Vercel Preview URLで動作確認可能か

### 3. コード変更の確認

#### 全体構造

- [ ] 変更が論理的にまとまっているか
- [ ] 1つのPRが1つの目的に集中しているか
- [ ] ファイル数、変更行数が適切か（大きすぎないか）

#### コード品質

- [ ] コーディング規約に従っているか
- [ ] 定数参照を使用しているか（文字列リテラル禁止）
- [ ] 静的importを使用しているか（動的import避ける）
- [ ] 適切なTypeScript型が定義されているか
- [ ] エラーハンドリングが適切か

#### セキュリティ

- [ ] 入力検証が実装されているか
- [ ] RLS（Row Level Security）が適切に設定されているか
- [ ] Server Actionsでセッション検証が行われているか
- [ ] レート制限が実装されているか
- [ ] 環境変数が適切に管理されているか（.envファイルを含まない）

#### パフォーマンス

- [ ] N+1クエリ問題がないか
- [ ] 不要なデータベースクエリがないか
- [ ] 並列実行可能な処理が並列化されているか
- [ ] キャッシュが適切に使用されているか

#### テスト

- [ ] 新機能に対応するテストが追加されているか
- [ ] テストカバレッジが維持されているか
- [ ] エッジケースが考慮されているか

### 4. 機能動作の確認

- [ ] Vercel Preview URLで実際に動作確認
- [ ] 本番環境の設定で正しく動作するか
- [ ] UIが期待通りに表示されるか
- [ ] エラーケースが適切に処理されるか

## レビューコメントの書き方

### 良いコメントの例

#### 🐛 バグ指摘

```markdown
**Issue**: この条件分岐では、`players`が空配列の場合に正しく処理されません。

**Suggestion**:
\`\`\`typescript
if (!players || players.length === 0) {
throw new GameActionError('No players found', 'INVALID_INPUT')
}
\`\`\`

**Impact**: High - ゲーム初期化時にエラーが発生する可能性
```

#### 🔒 セキュリティ指摘

```markdown
**Security Risk**: Server Actionでセッション検証が行われていません。

**Recommendation**:
\`\`\`typescript
// セッション検証を追加
const sessionValid = await validateSessionAction(playerId)
if (!sessionValid.success) {
throw new GameActionError('Unauthorized', 'UNAUTHORIZED')
}
\`\`\`

**Reference**: [セキュリティ設定ドキュメント](../../docs/security/RLS_SETUP.md)
```

#### ⚡ パフォーマンス改善提案

```markdown
**Performance**: ここでは4回の個別insertが実行されています。

**Optimization**:
\`\`\`typescript
// Batch insertで75%削減
const { error } = await supabaseAdmin
.from('players')
.insert(players.map(p => ({ id: p.id, name: p.name })))
\`\`\`

**Benefit**: DB呼び出しを4回→1回に削減（~50ms改善）
```

#### 💡 改善提案

```markdown
**Suggestion**: この処理は`Promise.all()`で並列化できます。

**Example**:
\`\`\`typescript
const [roomResult, playersResult] = await Promise.all([
getRoomDetailsAction(roomId),
getPlayersInRoom(roomId)
])
\`\`\`

**Impact**: Low - 小さな改善ですが、レイテンシを約50%削減できます
```

#### ✅ 良い実装を褒める

```markdown
**Great work!** 🎉

Batch insertの実装により、N+1問題が解決されています。
パフォーマンステストでも50ms改善が確認できました。

ドキュメントのコメントも分かりやすく、素晴らしい実装です！
```

### 避けるべきコメント

❌ 曖昧な指摘

```
これは良くないと思います。
```

❌ 批判的すぎる表現

```
この実装は完全に間違っています。書き直してください。
```

❌ 根拠のない指摘

```
パフォーマンスが悪そうです。
```

## レビュー優先度

### P0: Critical（即座に修正必須）

- セキュリティ脆弱性
- データ損失のリスク
- 本番環境でクラッシュする可能性
- RLS設定の欠落

### P1: High（マージ前に修正推奨）

- 重大なバグ
- パフォーマンス問題（N+1など）
- テストの欠落
- コーディング規約違反

### P2: Medium（修正推奨）

- 軽微なバグ
- コードの可読性改善
- リファクタリング提案
- ドキュメント改善

### P3: Low（任意）

- 細かいスタイル改善
- より良い変数名の提案
- 将来の拡張性に関する提案

## 承認基準

PRを承認（Approve）する前に以下を確認:

- [ ] すべてのP0、P1の問題が解決されている
- [ ] CIチェックがすべて合格している
- [ ] Vercel Previewで動作確認完了
- [ ] セキュリティリスクがない
- [ ] テストが適切にカバーされている
- [ ] ドキュメントが更新されている（必要な場合）

## プロジェクト固有のチェック項目

### Napoleon Game特有の確認事項

- [ ] ゲーム状態管理が正しく実装されているか
- [ ] カード配布がサーバーサイドで実行されているか
- [ ] Supabase RPCとServer Actionsが適切に使い分けられているか
- [ ] AIプレイヤーとマルチプレイヤーの両方で動作するか
- [ ] リアルタイム同期が正しく機能するか

### データベース関連

- [ ] RLS policyが適切に設定されているか
- [ ] インデックスが必要な場合は追加されているか
- [ ] トランザクションが必要な処理で使用されているか
- [ ] N+1問題がないか

### UI/UX関連

- [ ] レスポンシブデザインが考慮されているか
- [ ] ローディング状態が表示されるか
- [ ] エラーメッセージがユーザーフレンドリーか
- [ ] アクセシビリティが考慮されているか

## レビューテンプレート

```markdown
## レビュー結果

### ✅ Good Points

- [良かった点1]
- [良かった点2]

### 🔍 Issues Found

#### P0: Critical

- [ ] [Critical Issue 1]

#### P1: High

- [ ] [High Priority Issue 1]

#### P2: Medium

- [ ] [Medium Priority Issue 1]

### 💡 Suggestions

- [改善提案1]
- [改善提案2]

### 📋 Checklist

- [ ] Code quality
- [ ] Security
- [ ] Performance
- [ ] Tests
- [ ] Documentation

### 決定

- [ ] ✅ Approve
- [ ] 🔄 Request Changes
- [ ] 💬 Comment
```

## 参考リンク

- [コーディングルール](../../docs/development/CODING_RULES.md)
- [セキュリティ設定](../../docs/security/RLS_SETUP.md)
- [テスト設定](../../docs/testing/JEST_SETUP.md)
- [PR自動化](../../docs/ci-cd/PR_AUTOMATION.md)
