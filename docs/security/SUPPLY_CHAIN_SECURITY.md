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

## 🐍 Python導入時の対策（TODO）

**注意**: 現在はTypeScript/Node.jsのみですが、将来Pythonを導入する際は以下の対策を実装してください。

### ML実装予定（Phase 3）

- **予定時期**: Phase 3（Hugging Face Spaces）
- **パッケージマネージャー**: `uv` または `pip`
- **参考**: [ML Implementation Roadmap](../ml/ML_IMPLEMENTATION_ROADMAP.md)

---

### Pythonのサプライチェーン攻撃対策

#### 1. クールダウン機能

**uv（推奨）**:

```toml
# pyproject.toml
[tool.uv]
exclude-newer = "1 week"  # 7日間のクールダウン
```

**pip（代替案）**:

```ini
# pip.conf または .pip/pip.conf
[global]
# 残念ながらpipには標準でクールダウン機能なし
# 代わりにConstraints fileで手動管理
```

```txt
# constraints.txt - 特定バージョンに固定
package-name==1.2.3  # 安全確認済みバージョン
```

```bash
pip install -r requirements.txt --constraint constraints.txt
```

---

#### 2. ロックファイルの厳密な運用

**uv**:

```bash
# ロックファイル生成
uv lock

# CI/CD: ロックファイル厳守
uv sync --frozen
```

**pip**:

```bash
# requirements.txtを厳密に固定
pip freeze > requirements.lock

# CI/CD: 完全一致でインストール
pip install -r requirements.lock --require-hashes
```

**poetry**:

```bash
# ロックファイル生成
poetry lock

# CI/CD: ロックファイル厳守
poetry install --no-root
```

---

#### 3. ハッシュ検証（pip）

```txt
# requirements.txt with hashes
package-name==1.2.3 \
    --hash=sha256:abcdef123456...
```

```bash
# ハッシュ検証付きインストール
pip install -r requirements.txt --require-hashes
```

---

#### 4. Dependabot設定の追加

**.github/dependabot.yml に追加**:

```yaml
updates:
  # Python パッケージの監視
  - package-ecosystem: 'pip'
    directory: '/python' # Pythonプロジェクトのディレクトリ
    schedule:
      interval: 'weekly'
      day: 'monday'
      time: '09:00'
      timezone: 'Asia/Tokyo'
    open-pull-requests-limit: 10
    reviewers:
      - 'ksleep98'
    labels:
      - 'dependencies'
      - 'python'
    commit-message:
      prefix: 'fix'
      prefix-development: 'chore'
```

---

#### 5. GitHub Actions: Python Security Audit

**.github/workflows/python-security-audit.yml**:

```yaml
name: Python Security Audit

on:
  schedule:
    - cron: '0 0 * * 1' # 毎週月曜
  workflow_dispatch:

jobs:
  python-security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install uv
        run: pip install uv

      - name: Install Dependencies
        run: uv sync --frozen

      - name: Security Audit
        run: |
          # pip-audit または safety
          pip install pip-audit
          pip-audit

      - name: Check Outdated
        run: uv pip list --outdated
```

---

#### 6. セキュリティツール

| ツール        | 用途           | コマンド                             |
| ------------- | -------------- | ------------------------------------ |
| **pip-audit** | 脆弱性スキャン | `pip install pip-audit && pip-audit` |
| **safety**    | 脆弱性スキャン | `pip install safety && safety check` |
| **bandit**    | コード静的解析 | `pip install bandit && bandit -r .`  |

---

### Hugging Face Spaces特有の注意点

**依存の管理（本プロジェクトの現状）**:

`python/requirements.txt` は**存在しない**。依存の唯一のソースは
`python/uv.lock` で、直接依存は `python/pyproject.toml` に書く。Space の
Docker ビルドが `uv export --no-hashes --no-dev` でピン済みの集合を導出して
`pip install` する（`python/Dockerfile`）。

```dockerfile
# python/Dockerfile （抜粋）
COPY pyproject.toml uv.lock ./
RUN pip install --no-cache-dir "uv==${UV_VERSION}" \
    && uv export --no-cache --no-hashes --no-dev --no-header --format requirements-txt \
        > "${EXPORTED_REQUIREMENTS}" \
    && pip install --no-cache-dir -r "${EXPORTED_REQUIREMENTS}"
```

かつては `uv export` の生成物を `requirements.txt` としてコミットしていたが、
Dependabot が `uv.lock` と独立にそれを編集し、**推移的依存**のピンを他の制約と
両立しない版へ単独で上げていた（#520 / #527 の `tomlkit==0.15.1` は
`gradio 6.22.0` の `tomlkit<0.15.0` と衝突。同じ組み合わせが実際に Space の
ビルドを `ResolutionImpossible` で落としている → #509）。Dependabot を pip から
uv へ切り替えても（#523）推移的依存は止まらないため、ファイル自体を削除した。

**セキュリティチェックリスト**:

- [ ] 直接依存は `pyproject.toml` に記載し `uv lock` でロックを更新
- [ ] CI の `uv sync --locked` が通る（lock と pyproject の整合性検証）
- [ ] ローカルで `uv run --group dev pip-audit` 実行済み
- [ ] Dependabot（uv エコシステム）で自動監視設定済み
- [ ] GitHub Actions で週次監査設定済み（`python-security-audit.yml`）
- [ ] クールダウン機能設定済み（`.github/dependabot.yml` の `cooldown`）

---

### Python導入時のTODOリスト

```markdown
- [ ] パッケージマネージャー選定（uv推奨）
- [ ] pyproject.toml または requirements.txt 作成
- [ ] クールダウン機能設定（exclude-newer = "1 week"）
- [ ] ロックファイル生成（uv.lock または requirements.lock）
- [ ] Dependabot設定追加（.github/dependabot.yml）
- [ ] Python Security Audit workflow 作成
- [ ] pip-audit または safety インストール
- [ ] CI/CDにセキュリティチェック追加
- [ ] このドキュメントを更新（実装内容を反映）
```

---

## 🔗 参考リンク

- [Zenn: サプライチェーン攻撃が怖いので真面目に対策してみた](https://zenn.dev/dely_jp/articles/supply-chain-kowai)
- [GitHub: Dependency Review Action](https://github.com/actions/dependency-review-action)
- [pnpm: Security](https://pnpm.io/cli/audit)
- [npm: package.json overrides](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#overrides)
- [uv: Python package installer](https://github.com/astral-sh/uv)
- [pip-audit: PyPA security audit tool](https://pypi.org/project/pip-audit/)
- [safety: Python dependency security](https://pypi.org/project/safety/)
