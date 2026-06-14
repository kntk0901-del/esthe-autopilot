# 初回ライブ投稿 デプロイ手順書（大井町・承認制・テキストのみ）

目的: Vercelへデプロイし、日次Cronで「下書き生成→人が承認→1件だけ実投稿」を安全に確認する。
初日は承認制・1日1件・テキストのみ・キルスイッチ有効。2〜3日問題なければ全自動へ移行。

対象店舗は、実サイトのスクレイパーが実地確認済みの **大井町(oimachi)** のみ。蒲田・巣鴨は初日は無効。

重要な前提:
- アカウント作成・課金・トークン発行・デプロイ認証は本人のみ実行可能。
- 秘密値(APIキー等)は **チャットに貼らず、Vercelの環境変数に直接入力**する。
  形式の確認や配線は、貼らずに項目名ベースで伴走する。

---

## 費用の目安（2026-06時点）

- X API: 新規開発者は従量課金が既定。投稿1件 約$0.01。初日テストは実費数セント。
- Vercel / Supabase / Upstash: いずれも無料枠で開始可能。

---

## ステップ0: 準備するアカウント（あなた）

1. **X 開発者アカウント**（最重要・時間がかかる可能性）
   - https://developer.x.com で開発者登録（ログインは mens.beautysalon.tokyo@gmail.com のXアカウント）
   - App を作成し、User authentication settings を **OAuth 1.0a / Read and write** に設定
   - 取得する値: `API Key` / `API Key Secret`（=consumer）、`Access Token` / `Access Token Secret`（該当アカウントの書込権限付き）
   - 従量課金（pay-per-use）の支払い設定を有効化
2. **Upstash Redis**（無料）: Database作成 → `UPSTASH_REDIS_REST_URL` と `UPSTASH_REDIS_REST_TOKEN`
3. **Supabase**（無料）: プロジェクト作成 → `Project URL` / `anon key` / `service_role key`
4. **Vercel**（無料）: GitHubリポジトリ連携用アカウント

---

## ステップ1: コードをGitHubへ

```powershell
cd C:\Users\kntk0\Documents\Claude\Projects\MS
Remove-Item -Recurse -Force .git -ErrorAction SilentlyContinue
git init
git add -A
git commit -m "Esthe Growth Autopilot PoC"
```

GitHubで空リポジトリを作り、`git remote add origin <URL>` → `git push -u origin main`。

---

## ステップ2: Supabase初期化

1. SQL Editor で `supabase/migrations/` の4ファイルを古い順に適用
2. `supabase/seed.sql` を実行
3. Authentication で Email OTP を有効化、Site URL に後述のVercel URLを登録
4. Authentication > Users に管理者メール（ログインに使うメール）を追加 or OTPで初回ログイン

---

## ステップ3: Vercelへデプロイ（まずモックで疎通）

1. Vercelでリポジトリをimport（Framework: Next.js を自動検出）
2. 環境変数を設定（**初回はモードを mock/true のまま**）:

| 変数 | 初回値 |
|---|---|
| NEXT_PUBLIC_APP_URL | デプロイ後のURL（例 https://xxx.vercel.app）。初回は仮、後で再設定 |
| DATA_MODE | `mock`（疎通確認後 `supabase`） |
| NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SUPABASE_SERVICE_ROLE_KEY | Supabaseの値 |
| SETTINGS_ENCRYPTION_KEY | 長いランダム文字列 |
| UPSTASH_REDIS_REST_URL / TOKEN | Upstashの値 |
| X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_TOKEN_SECRET | Xの値 |
| X_MOCK_MODE | `true`（実投稿の直前に `false`） |
| USE_GEMINI | `false`（初日は固定テンプレート） |
| CRON_SECRET | 長いランダム文字列（Vercelが自動でCron認証に付与） |
| ADMIN_EMAILS | ログインに使う管理者メール |
| IP_HASH_SALT | 長いランダム文字列 |
| STORE_OIMACHI_SCHEDULE_URL | https://esthe-spa-lounge.com/schedule/ |

3. デプロイ後、`NEXT_PUBLIC_APP_URL` を実URLに更新して再デプロイ
4. `/login` でログイン → ダッシュボードが出ることを確認（mockモードで全画面疎通）

---

## ステップ4: 本番データへ切替（mock→supabase）

1. `DATA_MODE=supabase` に変更して再デプロイ
2. 設定画面で大井町以外（蒲田・巣鴨）の自動取得・自動投稿を **OFF**
3. 大井町: 自動取得 ON、**承認必須 ON**、最大掲載人数を確認、ハッシュタグ確認
4. 全体の「X投稿を許可」キルスイッチは ON だが、承認必須なので自動送信はされない
5. 日次上限を **1** に、X_MOCK_MODE は **まだ true** のまま

---

## ステップ5: 初回の実投稿（承認制・テキストのみ）

1. `X_MOCK_MODE=false` に変更して再デプロイ（ここで初めて実投稿が可能に）
2. 設定/投稿画面から大井町の同期＋下書き生成を手動実行（Cronを待たずに確認可）
3. `/posts` で下書きを開き、本文・出勤者名・時刻が実サイトと一致するか目視
4. 問題なければ **承認 → 投稿** を実行 → 実際にXへ1件投稿
5. 投稿URL・成否・エラーを確認。異常時は設定画面のキルスイッチOFFで即停止

---

## ステップ6: 数日観察後に全自動へ

- 2〜3日、承認制で誤りが無いことを確認
- 問題なければ大井町の「承認必須」をOFF、日次上限を運用値へ、画像投稿を検討
- その後、蒲田・巣鴨のURL/selectorを確定して順次追加

---

## 私（アシスタント）が伴走できること

- 各値の項目名・形式チェック（秘密値は伏せたまま）
- 設定画面の操作やトラブル時のログ解析
- migration/seed 適用の確認、Cron動作確認、初回下書きの内容レビュー
- 蒲田・巣鴨のselector確定とテスト
