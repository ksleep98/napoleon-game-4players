# Supabase Keep-Alive 設定

Supabase無料プランでは、1週間アクセスがないとインスタンスが一時停止されます。このワークフローは定期的にSupabaseにアクセスして、インスタンスを有効に保ちます。

## 概要

- **ワークフロー**: `.github/workflows/supabase-keep-alive.yml`
- **実行頻度**: 毎週月曜日 午前9時（UTC）= 日本時間18時
- **手動実行**: GitHub Actions画面から手動で実行可能

## 動作内容

1. **開発環境Supabase**へアクセス
   - REST APIにpingを送信
   - データベースクエリを実行

2. **本番環境Supabase**へアクセス
   - REST APIにpingを送信
   - データベースクエリを実行

3. **結果通知**
   - 各環境のステータスをログに出力

## GitHub Secrets 設定

このワークフローを動作させるには、以下のSecretsを設定する必要があります。

### 開発環境用

| Secret名                        | 説明                              | 取得場所                            |
| ------------------------------- | --------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | 開発用SupabaseプロジェクトURL     | Supabase Dashboard > Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 開発用匿名キー（anon/public key） | Supabase Dashboard > Settings > API |

### 本番環境用

| Secret名                             | 説明                              | 取得場所                            |
| ------------------------------------ | --------------------------------- | ----------------------------------- |
| `PROD_NEXT_PUBLIC_SUPABASE_URL`      | 本番用SupabaseプロジェクトURL     | Supabase Dashboard > Settings > API |
| `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY` | 本番用匿名キー（anon/public key） | Supabase Dashboard > Settings > API |

## GitHub Secrets 設定手順

1. GitHubリポジトリページへ移動
2. `Settings` > `Secrets and variables` > `Actions` をクリック
3. `New repository secret` をクリック
4. 上記のSecret名と値を設定

### 開発環境の設定例

**既存の環境変数を使用する場合**：

```bash
# 開発環境の場合、既に設定済みの可能性があります
# .env.local または Vercel の環境変数を確認してください
```

**新規設定する場合**：

1. Supabase Dashboardへログイン
2. 開発用プロジェクトを選択
3. `Settings` > `API` へ移動
4. `Project URL` をコピー → GitHub Secretsに `NEXT_PUBLIC_SUPABASE_URL` として追加
5. `anon public` キーをコピー → GitHub Secretsに `NEXT_PUBLIC_SUPABASE_ANON_KEY` として追加

### 本番環境の設定例

1. Supabase Dashboardへログイン
2. 本番用プロジェクトを選択
3. `Settings` > `API` へ移動
4. `Project URL` をコピー → GitHub Secretsに `PROD_NEXT_PUBLIC_SUPABASE_URL` として追加
5. `anon public` キーをコピー → GitHub Secretsに `PROD_NEXT_PUBLIC_SUPABASE_ANON_KEY` として追加

## 手動実行方法

1. GitHubリポジトリページへ移動
2. `Actions` タブをクリック
3. 左サイドバーから `Supabase Keep-Alive` を選択
4. `Run workflow` ボタンをクリック
5. `Run workflow` を確認

## トラブルシューティング

### エラー: "404 Not Found"

**原因**: Supabase URLまたはAPIキーが間違っている可能性があります。

**解決方法**:

1. GitHub Secretsの値を確認
2. Supabase Dashboardで正しいURLとキーを確認
3. Secretsを更新

### エラー: "401 Unauthorized"

**原因**: APIキーが無効または期限切れの可能性があります。

**解決方法**:

1. Supabase Dashboardでanon keyを再確認
2. 必要に応じてキーを再生成
3. GitHub Secretsを更新

### エラー: "PGRST116"（テーブルが見つからない）

**原因**: データベーステーブルが存在しない、またはRLSポリシーでアクセスが制限されています。

**解決方法**:

1. Supabase Dashboardでテーブル存在を確認
2. RLSポリシーを確認（SELECT権限が必要）
3. 必要に応じてポリシーを調整

## スケジュール変更

実行頻度を変更したい場合は、`.github/workflows/supabase-keep-alive.yml`の`cron`設定を編集してください。

```yaml
schedule:
  # 毎週月曜日 午前9時（UTC）
  - cron: '0 9 * * 1'
```

### Cron設定例

| 設定           | 実行タイミング                    |
| -------------- | --------------------------------- |
| `0 9 * * 1`    | 毎週月曜日 午前9時（UTC）         |
| `0 9 * * *`    | 毎日 午前9時（UTC）               |
| `0 9 * * 3,6`  | 毎週水曜日・土曜日 午前9時（UTC） |
| `0 */12 * * *` | 12時間ごと                        |

**注意**: 無料プランの制限を超えないよう、頻度を上げすぎないでください。

## セキュリティ上の注意

- **Service Role Key は使用しない**: このワークフローでは`anon key`のみを使用してください
- **anon key は公開可能**: anon keyは公開されても問題ありませんが、Secretsとして管理することを推奨
- **RLSポリシー**: データベースのRow Level Security (RLS)が適切に設定されていることを確認

## 参考リンク

- [Supabase Documentation - Pausing and Resuming](https://supabase.com/docs/guides/platform/pause-and-resume)
- [GitHub Actions - Scheduled Events](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [Cron Expression Generator](https://crontab.guru/)
