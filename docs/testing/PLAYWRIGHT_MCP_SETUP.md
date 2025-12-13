# Playwright MCP Server Setup

## 概要

このプロジェクトでは、Claude CodeからPlaywright E2Eテストを実行・確認するために**Playwright MCP Server**を使用しています。

## MCP（Model Context Protocol）とは

MCPは、LLMがツールやサービスと通信するための標準化されたプロトコルです。Playwright MCPを使用すると、Claude Codeから直接ブラウザ自動化やE2Eテストを実行できます。

---

## セットアップ済み内容

### 1. **`.mcp.json`設定ファイル**

プロジェクトルートに`.mcp.json`を配置済み：

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp"],
      "env": {}
    }
  }
}
```

### 2. **自動インストール**

MCPサーバーは`npx`経由で自動的にインストール・実行されます。プロジェクトに依存関係を追加する必要はありません。

---

## 使い方

### Claude Codeで確認

1. **MCP接続状態を確認**

   ```
   /mcp
   ```

   Playwright MCPサーバーが接続されていることを確認できます。

2. **利用可能なツールを確認**
   ```
   claude mcp list
   ```

### E2Eテストの実行例

Claude Codeで以下のように指示できます：

```
ナポレオンゲームのログインからゲーム開始までのE2Eテストを実行してください
```

```
トップページにアクセスして、Quick Start機能が動作するか確認してください
```

```
Playwrightで本番環境のヘルスチェックを実行してください
```

---

## 利用可能な機能

### 1. **ブラウザ自動操作**

- ページナビゲーション
- フォーム入力
- ボタンクリック
- スクリーンショット取得

### 2. **E2Eテスト実行**

- 既存のPlaywrightテストを実行
- テスト結果の確認
- テストレポートの取得

### 3. **データ抽出**

- ページ内容の取得
- アクセシビリティツリーの確認
- DOM要素の検証

---

## トラブルシューティング

### MCP接続が確認できない場合

1. **Claude Codeを再起動**
   設定変更後は再起動が必要な場合があります。

2. **設定ファイルを確認**

   ```bash
   cat .mcp.json
   ```

3. **手動でMCPサーバーを追加**
   ```bash
   claude mcp add --transport stdio playwright -- npx -y @playwright/mcp --scope project
   ```

### Playwrightパッケージのエラー

MCPサーバーはnpx経由で自動インストールされますが、エラーが発生する場合：

```bash
# Playwrightブラウザをインストール
npx playwright install

# または
pnpm exec playwright install
```

---

## 参考リンク

- [Microsoft Playwright MCP](https://github.com/microsoft/playwright-mcp)
- [Claude Code MCP Documentation](https://code.claude.com/docs/en/mcp)
- [Playwright Documentation](https://playwright.dev/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

## プロジェクト既存のE2Eテスト

このプロジェクトには以下のPlaywrightテストが既に実装されています：

```
tests/e2e/
├── basic.spec.ts           # 基本的なページ読み込みテスト
├── game-flow.spec.ts       # ゲームフロー全体のテスト
├── performance.spec.ts     # パフォーマンステスト
└── special-rules.spec.ts   # 特殊ルールのテスト
```

Playwright MCPを使用すると、Claude Codeからこれらのテストを実行・デバッグできます。

---

## 更新履歴

- **2025-12-07**: Playwright MCP Server初期セットアップ完了
