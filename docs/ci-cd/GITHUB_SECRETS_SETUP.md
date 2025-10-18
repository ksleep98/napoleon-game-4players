# GitHub Secrets セットアップ

## E2E自動化に必要なSecrets設定

E2E自動化ワークフローを動作させるため、以下のGitHub Secretsを設定する必要があります。

## 🔐 必要なSecrets

### GitHub OAuth認証用

| Secret名              | 説明                                        | 設定値                   |
| --------------------- | ------------------------------------------- | ------------------------ |
| `E2E_GITHUB_USERNAME` | GitHubユーザー名またはメールアドレス        | あなたのGitHubユーザー名 |
| `E2E_GITHUB_PASSWORD` | GitHubパスワードまたはPersonal Access Token | パスワードまたはPAT      |

## 🛠️ 設定手順

### 1. GitHubリポジトリでSecrets設定

1. **リポジトリページ**に移動

   ```
   https://github.com/ksleep98/napoleon-game-4players
   ```

2. **Settings** → **Secrets and variables** → **Actions** を開く

3. **New repository secret** をクリック

4. 各Secretを追加:

   **E2E_GITHUB_USERNAME**

   ```
   Name: E2E_GITHUB_USERNAME
   Secret: あなたのGitHubユーザー名（例：ksleep98）
   ```

   **E2E_GITHUB_PASSWORD**

   ```
   Name: E2E_GITHUB_PASSWORD
   Secret: あなたのGitHubパスワードまたはPersonal Access Token
   ```

### 2. Personal Access Token（推奨）

セキュリティ向上のため、パスワードの代わりにPersonal Access Tokenを使用することを推奨します。

1. **GitHub Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)**

2. **Generate new token** をクリック

3. 必要なスコープを選択:
   - `repo` - リポジトリへの完全アクセス
   - `workflow` - GitHub Actionsワークフローの更新

4. 生成されたトークンを `E2E_GITHUB_PASSWORD` として設定

## 🧪 設定確認

Secretsが正しく設定されているかテストするには：

### 手動ワークフロー実行

1. **GitHub Actions**ページを開く
2. **E2E Develop Tests**ワークフローを選択
3. **Run workflow**をクリック
4. パラメータを設定:
   - `target_url`: `https://napoleon-game-dev.vercel.app`
   - `create_pr`: `true`
5. **Run workflow**で実行

### ログでの認証確認

ワークフローが実行されると、以下のようなログが出力されます：

```
🔐 Vercel OAuth authentication required, setting up auth...
🌐 Accessing protected Vercel environment...
🔓 Vercel SSO authentication detected
🐙 Clicking GitHub OAuth login...
🔑 Performing GitHub authentication...
✅ Vercel OAuth authentication completed
```

## 🚨 注意事項

### セキュリティ

- **Personal Access Token使用推奨**: パスワード直接入力より安全
- **適切なスコープ設定**: 必要最小限の権限のみ付与
- **定期的な更新**: トークンの定期的な再生成を推奨

### トラブルシューティング

**認証失敗時のチェック項目:**

1. **Secrets名の確認**
   - `E2E_GITHUB_USERNAME` （アンダースコア注意）
   - `E2E_GITHUB_PASSWORD` （アンダースコア注意）

2. **認証情報の確認**
   - ユーザー名が正確か
   - パスワード/トークンが有効か
   - トークンのスコープが適切か

3. **2FA設定**
   - 2FA有効時はPersonal Access Token必須
   - パスワード認証では動作しません

## 🔄 自動実行フロー

設定完了後、以下の流れで自動実行されます：

1. **developブランチにPush**
2. **Vercelが自動デプロイ**
3. **GitHub Actionsが検知**
4. **E2Eテスト自動実行**
   - Vercel環境にGitHub OAuth認証
   - 19個のE2Eテストを実行
5. **テスト成功時**
   - develop→main自動PR作成
   - テスト結果をPRにコメント

## 📋 関連ドキュメント

- [E2E自動化ワークフロー](./E2E_AUTOMATION.md)
- [GitHub Actions設定](./GITHUB_ACTIONS.md)

---

**次のステップ**: Secrets設定後、develop環境へのデプロイでE2E自動化をテストしてください。
