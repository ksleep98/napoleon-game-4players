# PR自動化機能

GitHub ActionsによるPull Request自動化機能の設定完了。

## 🤖 自動化機能一覧

### 1. PR説明自動生成 (pr-description.yml)

**トリガー**: PR作成・更新時
**機能**:

- 変更ファイル一覧の自動生成
- ファイル種別の分類・集計
- コミット履歴の要約
- 品質チェックリスト追加
- テスト手順の自動生成

**生成される内容**:

```markdown
🤖 Auto-generated PR Summary

## 📝 Changes Summary

### Recent Commits:

- feat: add new feature
- fix: resolve bug

## 📁 Files Changed

**Total files changed: 5**

- 🔧 Source Code: 3 files
- 🧪 Tests: 1 file
- 📚 Documentation: 1 file

## ✅ Quality Checklist

- [ ] Code follows project conventions
- [ ] TypeScript types are properly defined
- [ ] Tests are added/updated
```

### 2. コード分析・レビュー支援 (pr-analysis.yml)

**トリガー**: PR作成・更新時
**機能**:

- 変更統計の自動計算
- 影響範囲の分析
- TypeScript型チェック実行
- テスト実行結果
- レビューポイントの提示

**分析内容**:

- ✅ **Core Game Logic Modified** - 重要変更の検出
- ✅ **Tests Updated** - テスト更新の確認
- ⚠️ **No Test Changes** - テスト不足の警告
- ⚙️ **Configuration Changes** - 設定変更の検出
- 🚀 **CI/CD Changes** - パイプライン変更の検出

### 3. PRテンプレート (.github/pull_request_template.md)

**機能**: PR作成時の最小限テンプレート提供
**内容**:

- 概要の記入欄
- 関連Issue記入欄
- レビューポイント記入欄
- 自動生成機能との重複を回避したシンプル構成

**改善点**:

- 重複するチェックリストを削除
- 変更種別は自動判定に統合
- PRテンプレート + 自動生成の二重表示問題を解決

## 🔄 ワークフロー

### PR作成時

1. **開発者がPR作成**
2. **自動でPR説明追加**
   - ファイル変更の詳細分析
   - 品質チェックリスト追加
3. **コード分析コメント投稿**
   - 影響範囲の分析結果
   - 型チェック・テスト結果
4. **CI/CDパイプライン実行**
   - 品質チェック・ビルド検証

### PR更新時

1. **新しいコミットをpush**
2. **PR説明を自動更新**
3. **分析コメントを更新**
4. **CI/CD再実行**

## 📋 生成される情報

### 自動分析内容

- **変更統計**: 追加・削除行数
- **ファイル分類**: ソースコード・テスト・設定・ドキュメント別
- **影響範囲**: コアロジック・設定・CI/CD変更の検出
- **品質指標**: 型チェック・テスト結果
- **推奨事項**: レビューポイント・注意事項

### レビュー支援

- **重要度判定**: コアロジック変更時の警告
- **テスト状況**: テスト追加・更新の確認
- **設定影響**: ビルド・品質ツール変更の検出
- **ドキュメント**: 関連ドキュメント更新の推奨

## ⚙️ 設定詳細

### 必要な権限

```yaml
permissions:
  pull-requests: write # PR説明更新・コメント投稿
  contents: read # コード読み取り
```

### トリガー設定

```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

### 使用アクション

- `actions/checkout@v4` - コード取得
- `tj-actions/changed-files@v42` - 変更ファイル検出
- `actions/github-script@v7` - GitHub API操作

## 🎯 効果・メリット

### 開発者

- PR作成の手間削減
- レビューポイントの明確化
- テスト・品質チェック忘れ防止

### レビュアー

- 変更内容の素早い把握
- 影響範囲の理解促進
- レビュー品質の向上

### プロジェクト

- 一貫したPR品質
- ドキュメント化の促進
- レビュー効率の向上

## 🔧 カスタマイズ

### 分析ルールの調整

`pr-analysis.yml`内の条件文を編集:

```bash
# コアファイルの定義変更
if echo "$ts_js_files" | grep -q "src/lib/gameLogic.ts\|src/lib/scoring.ts"; then
```

### テンプレートの変更

`.github/pull_request_template.md`を編集:

- チェックリスト項目の追加
- セクション構成の変更
- プロジェクト固有の要素追加

## 🔧 技術的詳細

### GitHub Actions Script 最適化

**問題**: マルチライン文字列の GitHub Actions Template Literal エラー

```
SyntaxError: Unexpected identifier 'docs'
```

**解決策**: 環境変数を使用した文字列渡し

```yaml
# 修正前（エラー）
script: |
  const content = `${{ steps.output.content }}`;

# 修正後（正常動作）
env:
  CONTENT: ${{ steps.output.content }}
script: |
  const content = process.env.CONTENT;
```

### YAML構文検証

```bash
# 全ワークフローファイルの構文チェック
find .github/workflows -name "*.yml" -exec python3 -c "import yaml; yaml.safe_load(open('{}', 'r'))" \;
```

## 📊 運用結果

### ✅ 設定完了・動作確認済み

- PR説明自動生成ワークフロー
- コード分析・レビュー支援ワークフロー
- PRテンプレート設定
- YAML構文検証済み

### 期待される効果

- PR作成時間: 50%短縮
- レビュー時間: 30%短縮
- 品質問題検出率: 向上
- ドキュメント更新率: 向上
