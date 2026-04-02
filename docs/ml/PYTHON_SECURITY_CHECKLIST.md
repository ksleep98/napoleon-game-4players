# Python導入時セキュリティチェックリスト

> **対象**: Phase 3（Python機械学習基盤構築）
>
> **参考**: [サプライチェーン攻撃対策ガイド](../security/SUPPLY_CHAIN_SECURITY.md#-python導入時の対策todo)

---

## 📋 必須チェック項目

### ✅ Phase 3開始前（準備）

- [ ] **ドキュメント確認**
  - [ ] [SUPPLY_CHAIN_SECURITY.md](../security/SUPPLY_CHAIN_SECURITY.md) の Pythonセクションを読む
  - [ ] [ML_IMPLEMENTATION_ROADMAP.md](./ML_IMPLEMENTATION_ROADMAP.md) のセキュリティ警告を確認

- [ ] **パッケージマネージャー選定**
  - [ ] `uv`（推奨）または `pip` を選択
  - [ ] インストール確認: `uv --version` または `pip --version`

- [ ] **セキュリティツールのインストール**
  ```bash
  pip install pip-audit safety bandit
  ```

---

### ✅ requirements.txt 作成時

- [ ] **バージョン固定**

  ```txt
  ❌ 悪い例:
  fastapi
  gradio

  ✅ 良い例:
  fastapi==0.104.1
  gradio==4.8.0
  ```

- [ ] **脆弱性スキャン実行**

  ```bash
  pip install -r requirements.txt
  pip-audit
  ```

- [ ] **スキャン結果の確認**
  - 脆弱性がある場合は安全なバージョンに更新
  - 記録を残す（コミットメッセージに記載）

---

### ✅ クールダウン機能設定

**uv使用時（推奨）**:

- [ ] `pyproject.toml` を作成

  ```toml
  [tool.uv]
  exclude-newer = "1 week"  # 7日間のクールダウン
  ```

- [ ] 動作確認
  ```bash
  uv sync
  ```

**pip使用時**:

- [ ] `constraints.txt` で手動管理

  ```txt
  # 安全確認済みバージョン（2026-04-03時点）
  fastapi==0.104.1
  gradio==4.8.0
  ```

- [ ] インストール時にConstraints使用
  ```bash
  pip install -r requirements.txt --constraint constraints.txt
  ```

---

### ✅ ロックファイル作成

**uv使用時**:

- [ ] ロックファイル生成

  ```bash
  uv lock
  ```

- [ ] `.gitignore` 確認（uv.lock は追跡する）

**pip使用時**:

- [ ] ロックファイル生成

  ```bash
  pip freeze > requirements.lock
  ```

- [ ] ハッシュ付きロックファイル生成（推奨）
  ```bash
  pip install pip-tools
  pip-compile --generate-hashes requirements.in -o requirements.txt
  ```

---

### ✅ Dependabot設定

- [ ] `.github/dependabot.yml` に追加

  ```yaml
  updates:
    - package-ecosystem: 'pip'
      directory: '/python' # Pythonプロジェクトの場所
      schedule:
        interval: 'weekly'
        day: 'monday'
      labels:
        - 'dependencies'
        - 'python'
  ```

- [ ] コミット・プッシュ

---

### ✅ GitHub Actions設定

- [ ] `python-security-audit.yml` を作成

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

        - name: Install Dependencies
          run: pip install -r requirements.txt

        - name: Security Audit
          run: |
            pip install pip-audit
            pip-audit
  ```

- [ ] コミット・プッシュ

- [ ] 手動実行でテスト
  ```
  GitHub → Actions → Python Security Audit → Run workflow
  ```

---

### ✅ Hugging Face Spaces設定

- [ ] `requirements.txt` をアップロード
- [ ] Spacesビルドログで脆弱性警告を確認
- [ ] 環境変数の安全な設定
  - [ ] `SUPABASE_URL` 設定
  - [ ] `SUPABASE_ANON_KEY` 設定（公開鍵）
  - [ ] Secrets として保存（NEVER commit）

---

### ✅ CI/CD統合

- [ ] GitHub Actionsでpip-audit実行
- [ ] ビルド時にセキュリティチェック
- [ ] 脆弱性発見時はビルド失敗

---

### ✅ 定期メンテナンス設定

- [ ] **週次**: Dependabot PRを確認
- [ ] **月次**: 手動で `pip list --outdated` 確認
- [ ] **重要**: セキュリティアドバイザリーを購読
  - [ ] [PyPI Advisory Database](https://github.com/pypa/advisory-database)
  - [ ] [GitHub Security Advisories](https://github.com/advisories?query=ecosystem%3Apip)

---

## 🚨 緊急時の対応

### 脆弱性が見つかった場合

1. **即座に更新**

   ```bash
   # 安全なバージョンに更新
   pip install package-name==safe-version

   # requirements.txt更新
   pip freeze > requirements.txt
   ```

2. **テスト実行**

   ```bash
   # ローカルでテスト
   python -m pytest

   # Hugging Face Spacesで動作確認
   ```

3. **PR作成**
   ```bash
   git checkout -b fix/security-update-package-name
   git add requirements.txt
   git commit -m "fix: Update package-name to safe version (CVE-XXXX-XXXX)"
   git push
   gh pr create
   ```

---

## 📊 チェックリスト完了確認

以下すべてにチェックが入ったら完了：

- [ ] requirements.txtにバージョン固定
- [ ] pip-auditでスキャン済み
- [ ] クールダウン機能設定済み
- [ ] ロックファイル作成済み
- [ ] Dependabot設定追加済み
- [ ] GitHub Actions設定済み
- [ ] Hugging Face Spaces設定済み
- [ ] 定期メンテナンス計画作成済み

---

## 🔗 参考リンク

- [サプライチェーン攻撃対策ガイド（本プロジェクト）](../security/SUPPLY_CHAIN_SECURITY.md)
- [ML Implementation Roadmap](./ML_IMPLEMENTATION_ROADMAP.md)
- [pip-audit](https://pypi.org/project/pip-audit/)
- [safety](https://pypi.org/project/safety/)
- [uv: Python package installer](https://github.com/astral-sh/uv)
- [PyPA Advisory Database](https://github.com/pypa/advisory-database)

---

**作成日**: 2026-04-03
**更新**: Phase 3実装時に完了チェックを追記すること
