# フォーマット設定ガイド

Biome中心の統一的なコードフォーマット環境の設定と使用方法。

## 🎯 フォーマット戦略

### Biome（メインフォーマッター）

**対応ファイル**: `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.jsonc`
**機能**:

- 高速なリンティング
- コードフォーマッティング
- Import自動整理
- TypeScript完全サポート

### Prettier（補完フォーマッター）

**対応ファイル**: `.yml`, `.yaml`, `.md`
**理由**: BiomeがYAML/Markdownを未サポートのため

## 📁 ファイル別フォーマッター一覧

| ファイル種別          | フォーマッター  | 設定ファイル     |
| --------------------- | --------------- | ---------------- |
| TypeScript/JavaScript | 🟢 **Biome**    | `biome.json`     |
| JSON                  | 🟢 **Biome**    | `biome.json`     |
| YAML                  | 🔵 **Prettier** | `.prettierrc.js` |
| Markdown              | 🔵 **Prettier** | `.prettierrc.js` |

## ⚙️ VSCode設定

### 自動設定済み (`.vscode/settings.json`)

```json
{
  // Biome: JS/TS/JSON
  "editor.defaultFormatter": "biomejs.biome",
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[json]": {
    "editor.defaultFormatter": "biomejs.biome"
  },

  // Prettier: YAML/Markdown
  "[yaml]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[markdown]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },

  // 保存時自動フォーマット
  "editor.formatOnSave": true
}
```

### 必要な拡張機能

`.vscode/extensions.json`で自動推奨:

- `biomejs.biome` - TypeScript/JavaScript/JSON
- `esbenp.prettier-vscode` - YAML/Markdown
- `bradlc.vscode-tailwindcss` - Tailwind CSS
- `Prisma.prisma` - Prisma

## 🚀 コマンド一覧

### 開発時の手動実行

```bash
# Biome: JS/TS/JSONファイルのリント・フォーマット
pnpm lint          # リント検証
pnpm lint:fix       # 自動修正
pnpm format         # フォーマット実行
pnpm format:check   # フォーマット検証

# Prettier: YAML/Markdownファイルのフォーマット
pnpm format:other   # フォーマット実行
pnpm format:other:check  # フォーマット検証

# 全体チェック
pnpm ci-check       # 全ファイル品質検証
```

### 自動実行（pre-commit）

**git commit時に自動実行**:

```bash
# JS/TS/JSON → Biome自動修正
# YAML/MD → Prettier自動修正
git add .
git commit -m "message"  # 自動フォーマット実行
```

## 🔧 設定ファイル詳細

### biome.json（Biome設定）

```json
{
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "trailingCommas": "es5",
      "semicolons": "asNeeded"
    }
  },
  "json": {
    "formatter": {
      "indentStyle": "space",
      "indentWidth": 2
    }
  }
}
```

### .prettierrc.js（Prettier設定）

```javascript
module.exports = {
  // 基本設定
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,

  // YAML専用設定
  overrides: [
    {
      files: ['*.yml', '*.yaml'],
      options: {
        singleQuote: false,
        printWidth: 120,
      },
    },
    {
      files: ['*.md'],
      options: {
        printWidth: 80,
        proseWrap: 'preserve',
      },
    },
  ],
};
```

## 🔄 lint-staged設定

**pre-commit時の自動処理**:

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx,json}": [
      "npx @biomejs/biome check --write",
      "npx @biomejs/biome format --write"
    ],
    "*.{yml,yaml,md}": ["npx prettier --write"]
  }
}
```

## 💡 使用方法・ベストプラクティス

### 新しいファイル作成時

1. **TypeScript/JavaScript**: BiomeがVSCode保存時に自動フォーマット
2. **JSON**: Biomeが自動フォーマット（package.json等）
3. **YAML**: PrettierがVSCode保存時に自動フォーマット
4. **Markdown**: PrettierがVSCode保存時に自動フォーマット

### CI/CD統合

```yaml
# GitHub Actions例
- name: Check formatting
  run: |
    pnpm lint           # Biome検証
    pnpm format:check   # Biome フォーマット検証
    pnpm format:other:check  # Prettier検証
```

### トラブルシューティング

**1. VSCodeでフォーマットされない**

```bash
# 拡張機能インストール確認
code --list-extensions | grep -E "(biome|prettier)"

# 設定確認
cat .vscode/settings.json
```

**2. Biomeエラー**

```bash
# Biome再インストール
pnpm install @biomejs/biome@latest
npx @biomejs/biome --version
```

**3. Prettierエラー**

```bash
# Prettier設定確認
npx prettier --check "**/*.yml"
```

## 📈 パフォーマンス比較

| フォーマッター | 速度    | 対応ファイル | 特徴               |
| -------------- | ------- | ------------ | ------------------ |
| **Biome**      | 🚀 高速 | JS/TS/JSON   | Rust製・統合ツール |
| **Prettier**   | 🐢 標準 | YAML/MD      | 豊富なオプション   |

### 処理時間例

```bash
# Biome: ~10ms (32ファイル)
# Prettier: ~200ms (21ファイル)
```

## 🎉 メリット

### 開発体験

- **統一性**: 全ファイルで一貫したフォーマット
- **自動化**: VSCode保存時・git commit時の自動修正
- **高速**: Biomeによる高速処理

### チーム開発

- **設定共有**: `.vscode/`フォルダで設定統一
- **品質保証**: CI/CDでフォーマット検証
- **学習コスト**: BiomeとPrettierの2ツールのみ

---

> この設定により、BiomeとPrettierを適切に使い分けた統一的なフォーマット環境が実現されます。
