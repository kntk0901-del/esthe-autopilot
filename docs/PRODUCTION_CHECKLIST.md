# 本番移行チェックリスト

## データ基盤

- Supabase migrationとseedをステージングへ適用
- 日次バックアップと復旧テスト
- `DATA_MODE=supabase`
- service role keyをVercel server environmentだけへ登録
- RLSと管理APIのadmin判定をテスト
- ログ保持期間を90日以上へ設定

## 認証

- Email OTPのSite URL / Redirect URLを公式ドメインへ変更
- `ADMIN_EMAILS` を実運用者だけに限定
- viewerの更新拒否を確認
- 退職・異動時のアクセス削除手順を作成

## 店舗

- 3店舗のschedule URLとbooking URLを実値へ変更
- 店舗ごとの自動取得・自動投稿ON/OFFを確認
- selector、0件、DOM変更、画像欠損、翌日跨ぎを確認
- 許可画像ドメインを最小化
- publication consentを実データで設定
- 月次目標、部屋数、投稿時間、承認ルールを確認

## 外部サービス

- Upstash Redisを設定し、ロック失敗時に投稿が止まることを確認
- 店舗別時刻を使う場合はQStash tokenと署名鍵を設定し、スケジュール同期
- Gemini keyとmodelを設定し、fallbackを試験
- 公式Xアプリ、User Context token、書込権限を設定
- テストアカウントでテキスト、1画像、4画像、画像全失敗を試験
- 401 / 403 / 429 / 5xxの表示と再試行を確認

## セキュリティ

- `CRON_SECRET` と `IP_HASH_SALT` を長いランダム値へ変更
- ファイル上限、MIME、拡張子、レビュー必須を確認
- SheetJS npm版を保守中の配布物へ置換
- APIキー、token、service roleがログとクライアントbundleにないことを確認
- tracking URLがIP平文を保存しないことを確認

## 運用

- Stage 1: 2から3日ドライラン
- Stage 2: 1週間、固定文・画像なし
- Stage 3: 1週間、画像最大4枚
- Stage 4: 2週間以上、4 variant比較
- Stage 5: 必要な場合のみランダムホールドアウトを開始
- 初期は投稿承認制を推奨
- Webhookまたはメール監視を接続
- 誤投稿時の停止、削除、再開手順を作成
- 設定画面の本番稼働チェックがすべて準備完了であることを確認
