# .claude フォルダ

このフォルダには、Claude Codeエージェントが効率的に作業するための設定ファイルとスキル定義が含まれています。

## フォルダ構造

```
.claude/
├── README.md                 # このファイル
├── CLAUDE.md                 # プロジェクト指示書（メイン設定）
├── settings.json             # チーム共有設定
├── settings.local.json       # Claude Codeローカル設定
└── skills/                   # スキル定義フォルダ
    ├── commit.md             # コミット作成スキル
    ├── review-pr.md          # PRレビュースキル
    ├── fix-build.md          # ビルドエラー修正スキル
    ├── optimize-perf.md      # パフォーマンス最適化スキル
    ├── deploy.md             # Vercelデプロイスキル
    ├── db-migrate.md         # Supabaseマイグレーションスキル
    ├── test.md               # テスト実行・修正スキル
    ├── security-check.md     # セキュリティチェックスキル
    └── create-pr.md          # PR作成スキル
```

## ファイル説明

### CLAUDE.md

プロジェクトのメイン指示書。Claude Codeがプロジェクト全体を理解するための包括的なドキュメント。

**内容**:

- プロジェクト概要
- 技術スタック
- ブランチ戦略
- 開発環境設定
- ドキュメントリンク
- セキュリティガイドライン
- 開発ルール

**Claude Codeの動作**:

- このファイルは自動的にシステムプロンプトに含まれる
- プロジェクト固有のルールや規約に従った作業が可能
- 常に最新の状態に保つこと

### settings.json

チーム共有のClaude Code設定ファイル。

**内容**:

- 許可・拒否・確認が必要なコマンド
- コーディング規約
- ブランチ保護設定
- テスト要件

**注意**: Gitで管理（チーム全体で共有）

### settings.local.json

Claude Codeのローカル設定ファイル。

**注意**:

- `.gitignore`で除外されているため、個人設定を含む
- チーム共有したい設定は`settings.json`を使用
- 環境変数やAPIキーは含めない

### skills/

プロジェクト固有のタスクを効率化するためのスキル定義フォルダ。

#### commit.md - コミット作成スキル

**用途**: 高品質なコミットメッセージを作成

**主な内容**:

- Conventional Commits規約
- コミットメッセージのテンプレート
- Pre-commit hooksガイド
- 良い例・悪い例

**使用方法**:

```
Claude Code: /commit
```

#### review-pr.md - PRレビュースキル

**用途**: プルリクエストの効果的なレビュー

**主な内容**:

- レビュープロセス
- チェックリスト
- コメントの書き方
- 承認基準

**使用方法**:

```
Claude Code: /review-pr [PR URL]
```

#### fix-build.md - ビルドエラー修正スキル

**用途**: Next.jsビルドエラーの診断・修正

**主な内容**:

- よくあるビルドエラーと解決方法
- TypeScript型エラー
- 環境変数エラー
- モジュールインポートエラー

**使用方法**:

```
Claude Code: /fix-build
```

#### optimize-perf.md - パフォーマンス最適化スキル

**用途**: アプリケーションのパフォーマンス改善

**主な内容**:

- データベース最適化（N+1問題、バッチ処理）
- ネットワーク最適化
- レンダリング最適化
- バンドルサイズ最適化

**使用方法**:

```
Claude Code: /optimize-perf
```

#### deploy.md - Vercelデプロイスキル

**用途**: Vercelへの安全なデプロイ実行

**主な内容**:

- Pre-deployチェック
- ビルド検証
- 環境変数確認
- デプロイ実行とロールバック

**使用方法**:

```
Claude Code: /deploy
```

#### db-migrate.md - Supabaseマイグレーションスキル

**用途**: データベースマイグレーションの作成・適用・ロールバック

**主な内容**:

- マイグレーションファイル作成
- RLSポリシー設定
- インデックス作成
- ロールバック手順

**使用方法**:

```
Claude Code: /db-migrate
```

#### test.md - テスト実行・修正スキル

**用途**: Jestテストの効率的な実行・作成・修正

**主な内容**:

- テスト実行方法
- ユニット・コンポーネント・統合テスト
- ベストプラクティス（AAAパターン）
- トラブルシューティング

**使用方法**:

```
Claude Code: /test
```

#### security-check.md - セキュリティチェックスキル

**用途**: 脆弱性検出とセキュリティ強化

**主な内容**:

- 依存関係の脆弱性チェック
- 環境変数チェック
- RLSポリシー確認
- XSS/CSRF対策
- Server Actionsセキュリティ

**使用方法**:

```
Claude Code: /security-check
```

#### create-pr.md - PR作成スキル

**用途**: ローカルでfeatureブランチを作成し、developへのPRを自動作成

**主な内容**:

- ブランチ命名規則
- Conventional Commitsでのコミット
- GitHub CLIでのPR作成
- PR本文テンプレート
- 自動化スクリプト例

**使用方法**:

```
Claude Code: /create-pr
```

## スキルの使い方

### 基本的な使用方法

1. **スキルの一覧表示**

   ```
   Claude Code: /skills
   ```

2. **特定のスキルを実行**

   ```
   Claude Code: /commit
   Claude Code: /create-pr
   Claude Code: /review-pr https://github.com/ksleep98/napoleon-game-4players/pull/167
   Claude Code: /fix-build
   Claude Code: /optimize-perf
   Claude Code: /deploy
   Claude Code: /db-migrate
   Claude Code: /test
   Claude Code: /security-check
   ```

3. **スキルの詳細を確認**
   - 各スキルファイルを直接読む
   - Claude Codeに質問する

### スキルのカスタマイズ

プロジェクトの成長に合わせてスキルを追加・更新できます:

```bash
# 新しいスキルを追加
touch .claude/skills/my-custom-skill.md

# スキルの内容を編集
code .claude/skills/my-custom-skill.md
```

## ベストプラクティス

### 1. CLAUDE.mdの更新

プロジェクトの重要な変更時には`CLAUDE.md`を更新:

- 新しい技術スタックの追加
- ブランチ戦略の変更
- セキュリティポリシーの更新
- 開発ルールの追加

### 2. スキルの追加

繰り返し行うタスクがある場合、新しいスキルを作成:

```markdown
# My Custom Skill

## 目的

[このスキルが解決する問題]

## 手順

1. [ステップ1]
2. [ステップ2]
3. [ステップ3]

## 例

[具体的な使用例]

## チェックリスト

- [ ] [確認項目1]
- [ ] [確認項目2]
```

### 3. 設定のバージョン管理

- `CLAUDE.md`: Gitで管理（チーム共有）
- `skills/*.md`: Gitで管理（チーム共有）
- `settings.local.json`: Gitで管理しない（個人設定）

## Git設定

### .gitignore

`.gitignore`に以下を追加済み:

```gitignore
# Claude Code local settings
.claude/settings.local.json
.claude/cache/
```

### 共有すべきファイル

✅ Gitにコミット:

- `.claude/CLAUDE.md`
- `.claude/README.md`
- `.claude/settings.json`
- `.claude/skills/*.md`
- `.claudeignore`

❌ Gitから除外:

- `.claude/settings.local.json`
- `.claude/cache/`

## トラブルシューティング

### Claude Codeがプロジェクト指示を無視する

1. `CLAUDE.md`が存在するか確認
2. ファイルの内容が正しいか確認
3. Claude Codeを再起動

### スキルが動作しない

1. スキルファイルが存在するか確認
2. Markdown形式が正しいか確認
3. スキル名が正しいか確認

### 設定が反映されない

1. `settings.local.json`の構文が正しいか確認
2. Claude Codeを再起動
3. キャッシュをクリア

## 参考リンク

### プロジェクトドキュメント

- [プロジェクトセットアップ](../docs/setup/PROJECT_SETUP.md)
- [開発コマンド](../docs/development/COMMANDS.md)
- [コーディングルール](../docs/development/CODING_RULES.md)
- [セキュリティ設定](../docs/security/RLS_SETUP.md)

### Claude Code公式ドキュメント

- [Claude Code CLI](https://www.anthropic.com/claude/code)
- [Skills Guide](https://docs.anthropic.com/claude-code/skills)
- [Project Instructions](https://docs.anthropic.com/claude-code/project-instructions)

## 更新履歴

- 2026-02-15: Claude Code最新機能追加
  - `.claudeignore`追加（コンテキスト最適化）
  - `.claude/settings.json`追加（チーム共有設定）
  - 5つの新スキル追加（deploy, db-migrate, test, security-check, create-pr）
- 2026-01-25: 初期作成
  - CLAUDE.mdをルートから移動
  - skillsフォルダ作成
  - 4つの基本スキル追加（commit, review-pr, fix-build, optimize-perf）
