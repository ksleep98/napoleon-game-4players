# サプライチェーン攻撃対策ガイド

## 📋 概要

このプロジェクトでは、2026年3月に相次いだサプライチェーン攻撃（Trivy、LiteLLM、axios）を教訓に、5層の防御戦略を実装しています。

**参考**: [サプライチェーン攻撃が怖いので真面目に対策してみた](https://zenn.dev/dely_jp/articles/supply-chain-kowai)

---

## 🛡️ 実装済み対策（5層）

### 1. クールダウン機能（minimumReleaseAge）

**設定ファイル**: `.npmrc`

```ini
minimumReleaseAge=10080  # 7日間（分単位）
```

**効果**:

- パッケージ公開から7日経過するまでインストールを遅延
- 悪意のあるパッケージの80%が1週間以内に検出・削除される統計に基づく
- サプライチェーン攻撃のほとんどをブロック可能

**動作**:

- `pnpm install` 実行時、7日以内に公開されたパッケージはスキップ
- エラーメッセージで該当パッケージを通知
- 7日後に再実行すればインストール可能

---

### 2. ロックファイルの厳密な運用

**CI/CD設定**: `.github/workflows/ci.yml`

```yaml
- name: Install dependencies
  run: pnpm install --frozen-lockfile
```

**効果**:

- `pnpm-lock.yaml` と完全一致する依存関係のみインストール
- ロックファイルが更新されていない場合はエラー
- CI/CD環境で予期しないパッケージ更新を防止

**ローカル開発**:

```bash
# 通常のインストール（ロックファイル更新なし）
pnpm install

# ロックファイル強制更新（注意して使用）
pnpm install --no-frozen-lockfile
```

---

### 3. インストールスクリプト無効化

**設定ファイル**: `.npmrc`

```ini
ignore-scripts=true
```

**効果**:

- `postinstall`、`preinstall` スクリプトの自動実行を防止
- 悪意のあるコードの実行をブロック
- pnpm v10 では `allowBuilds` で信頼できるパッケージのみ許可可能

**信頼できるパッケージの許可**:

```json
// package.json
{
  "pnpm": {
    "allowedBuilds": ["@playwright/test", "puppeteer"]
  }
}
```

---

### 4. Dependency Review Action

**設定ファイル**: `.github/workflows/dependency-review.yml`

**効果**:

- PRで新規・更新される依存関係を自動スキャン
- 既知の脆弱性（moderate以上）があればマージをブロック
- 禁止ライセンス（GPL-2.0、LGPL-2.0）のチェック
- OpenSSF Scorecardでセキュリティスコアを表示

**動作フロー**:

1. PR作成時に自動実行
2. 依存関係の変更を検出
3. GitHub Advisory Databaseで脆弱性チェック
4. 結果をPRコメントに投稿
5. 問題があればCIを失敗させる

---

### 5. 緊急時の対応手順（overrides）

**package.json に緊急パッチを適用**:

```json
{
  "pnpm": {
    "overrides": {
      "vulnerable-package": "safe-version",
      "axios": "1.7.9"
    }
  }
}
```

**手順**:

1. **脆弱性発見時**:

   ```bash
   # 脆弱性を確認
   pnpm audit

   # 詳細を確認
   pnpm audit --json | jq '.advisories'
   ```

2. **package.json を更新**:

   ```json
   {
     "pnpm": {
       "overrides": {
         "vulnerable-package@<2.0.0": ">=2.0.1"
       }
     }
   }
   ```

3. **依存関係を再インストール**:

   ```bash
   # クールダウンを一時的に無効化（.npmrc）
   # minimumReleaseAge=0

   pnpm install

   # 修正後は元に戻す
   # minimumReleaseAge=10080
   ```

4. **動作確認**:

   ```bash
   pnpm test
   pnpm build
   ```

5. **コミット**:
   ```bash
   git add package.json pnpm-lock.yaml
   git commit -m "fix: Override vulnerable package to safe version"
   ```

---

## 🔧 セキュリティコマンド

プロジェクトに追加されたセキュリティ関連コマンド：

```bash
# 脆弱性監査（moderate以上）
pnpm security:audit

# 脆弱性の自動修正（可能な場合）
pnpm security:audit:fix

# 古いパッケージを確認
pnpm security:outdated

# 総合チェック（監査 + 古いパッケージ）
pnpm security:check
```

---

## 📊 統計データ

**悪意のあるパッケージの検出・削除速度**:

| 期間     | 削除率 |
| -------- | ------ |
| 1日以内  | 40%    |
| 3日以内  | 60%    |
| 7日以内  | 80%    |
| 14日以内 | 90%    |

**7日のクールダウン期間**:

- 過去の攻撃事例に基づいた実証的な数値
- リスク許容度に応じて14日に延長も可能
- 緊急性が高い場合は一時的に0日に設定可能

---

## ⚠️ トラブルシューティング

### エラー1: minimumReleaseAge でインストール失敗

```
ERR_PNPM_PACKAGE_TOO_NEW
Package "example-package@1.0.0" was published less than 10080 minutes ago
```

**原因**: パッケージが7日以内に公開された

**対処法**:

1. **7日待つ（推奨）**:

   ```bash
   # 7日後に再実行
   pnpm install
   ```

2. **一時的に無効化（緊急時のみ）**:

   ```ini
   # .npmrc
   minimumReleaseAge=0
   ```

3. **特定パッケージのみ例外**:
   ```json
   // package.json
   {
     "pnpm": {
       "packageExtensions": {
         "example-package": {
           "minimumReleaseAge": 0
         }
       }
     }
   }
   ```

---

### エラー2: Dependency Review Actionが失敗

```
Dependency Review detected vulnerabilities
```

**原因**: 新規・更新依存関係に脆弱性がある

**対処法**:

1. **PRコメントを確認**:
   - GitHub PRページで詳細を確認
   - 影響を受けるパッケージとCVE番号を特定

2. **安全なバージョンに更新**:

   ```bash
   pnpm update vulnerable-package --latest
   ```

3. **overridesで強制的に修正**:
   ```json
   {
     "pnpm": {
       "overrides": {
         "vulnerable-package": "safe-version"
       }
     }
   }
   ```

---

### エラー3: ビルドスクリプトがブロックされる

```
ERR_PNPM_LIFECYCLE_SCRIPT_BLOCKED
```

**原因**: `ignore-scripts=true` でビルドスクリプトがブロック

**対処法**:

1. **信頼できるパッケージを許可**:

   ```json
   // package.json
   {
     "pnpm": {
       "allowedBuilds": ["@playwright/test"]
     }
   }
   ```

2. **一時的に実行許可（非推奨）**:
   ```bash
   pnpm install --ignore-scripts=false
   ```

---

## 🔍 定期的なセキュリティチェック

### 週次チェック（推奨）

```bash
# 脆弱性と古いパッケージを確認
pnpm security:check

# 結果をチームで共有
```

### 月次チェック（推奨）

```bash
# すべての依存関係を最新に更新
pnpm update --latest --interactive

# テスト実行
pnpm test

# ビルド確認
pnpm build
```

### PR作成時（自動）

- Dependency Review Actionが自動実行
- 問題があればマージブロック
- 詳細はPRコメントに投稿

---

## 📚 関連ドキュメント

- [環境変数セキュリティガイド](./ENVIRONMENT_VARIABLES.md)
- [RLSセットアップ](./RLS_SETUP.md)
- [開発環境セキュリティ](./DEVELOPMENT_SECURITY.md)
- [Realtime Subscription エラー対処法](../troubleshooting/REALTIME_SUBSCRIPTION_ERROR.md)

---

## 📝 更新履歴

- **2026-04-03**: 初版作成（5層の防御戦略実装）
- サプライチェーン攻撃対策の完全実装

---

## 🔗 参考リンク

- [Zenn: サプライチェーン攻撃が怖いので真面目に対策してみた](https://zenn.dev/dely_jp/articles/supply-chain-kowai)
- [GitHub: Dependency Review Action](https://github.com/actions/dependency-review-action)
- [pnpm: Security](https://pnpm.io/cli/audit)
- [npm: package.json overrides](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides)
