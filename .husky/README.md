# Pre-commit Hook 設定

## 現在の設定（デフォルト）
`pre-commit` - 包括的な品質チェック
- 自動フォーマット・lint修正
- TypeScript型チェック  
- Jestテスト実行
- 全てパスしないとコミット不可

## 他の選択肢

### 軽量版に切り替え
```bash
cp .husky/pre-commit-light .husky/pre-commit
```
- フォーマット・lint修正のみ
- 高速だがチェックは最小限

### 拡張版に切り替え（現在と同じ）
```bash
cp .husky/pre-commit-enhanced .husky/pre-commit
```

### 一時的に無効化（緊急時）
```bash
git commit -m "message" --no-verify
```

## 手動でのチェック実行

```bash
# 全体的な品質チェック
npm run ci-check

# 個別実行
npm run lint:fix      # 自動修正
npm run type-check    # 型チェック
npm test              # テスト実行
npm run format        # フォーマット
```