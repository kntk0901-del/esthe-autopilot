# Esthe Growth Autopilot PoC

3店舗の出勤同期、投稿生成、X投稿、売上取込、セラピスト・投稿分析を一体化したNext.js App Router製PoCです。

外部APIキーがなくても `DATA_MODE=mock` と `X_MOCK_MODE=true` で全画面と主要フローを確認できます。

## 実装範囲

- 3店舗統合ダッシュボード
- 店舗別の出勤・売上・投稿状況
- 蒲田向け設定駆動スクレイパー
- スパラウンジ大井町の実サイトDOM対応とライブ取得テスト
- CSV / Excelのヘッダ検出、行分類、正規化、レビュー、確定
- 4種類の投稿variant、店舗×曜日内の均等割当
- 掲載同意・出勤情報に基づく最大4名の投稿対象選定
- Gemini生成、事実検証、固定テンプレートへのフォールバック
- X API v2投稿、v1.1 media upload、画像失敗時のテキスト投稿
- Upstash Redisロック、DB unique、content hashによる重複防止
- トラッキングURL、ソルト付きIPハッシュ、302リダイレクト
- 店舗・セラピスト・variant分析、任意のランダムホールドアウト比較
- operations-onlyを既定とし、PoC成功条件を運用実現性に限定
- botクリック除外、投稿キルスイッチ、日次件数・月次想定費用ガード
- 店舗別Cron fan-out、Xリーチ到達確認
- 店舗別の自動取得・自動投稿ON/OFF
- QStashによる店舗別設定時刻のサーバーレス実行
- 管理画面から店舗URL、Xアカウント、スクレイパー、外部API設定を変更
- Supabase AuthメールOTP、管理者メール許可リスト
- Vercel Cron、ジョブログ、再生成・再投稿

## クイックスタート

必要環境はNode.js 20.9以上です。

```powershell
npm install
Copy-Item .env.example .env.local
npm run dev
```

`http://localhost:3100` を開きます。初期値はモックモードなので外部サービスは不要です。

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

E2Eは初回のみChromiumを入れて実行します。

```powershell
npx playwright install chromium
npm run test:e2e
```

## モックモード

`.env.local`:

```dotenv
DATA_MODE=mock
USE_GEMINI=false
X_MOCK_MODE=true
SETTINGS_ENCRYPTION_KEY=replace-with-a-long-random-string
```

プロセス内のデモストアを使用します。再起動すると操作結果は初期化されます。データ件数は次で確認できます。

```powershell
npm run seed:demo
```

## Supabase

1. Supabaseプロジェクトを作成します。
2. SQL EditorまたはSupabase CLIで migration を適用します。
3. `supabase/seed.sql` を実行します。
4. AuthenticationでEmail OTPを有効にします。
5. Site URLとRedirect URLへアプリURLを登録します。
6. `.env.local` のSupabase値と `DATA_MODE=supabase` を設定します。

```powershell
supabase db push
supabase db reset
```

MigrationはRLSを有効化し、`authenticated` へread-only policyを付与します。更新は認証済みRoute Handlerからservice roleで実行します。`SUPABASE_SERVICE_ROLE_KEY` はクライアントへ公開しないでください。

## Upstash Redis

実X投稿ではRedisが必須です。

```dotenv
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
X_MOCK_MODE=false
```

ロックキーは `lock:post:{storeCode}:{YYYY-MM-DD}:{postType}`、TTLは120秒です。実投稿モードでRedisへ接続できない場合は投稿を停止します。

## QStash

管理画面で店舗ごとの自動実行時刻を変更したい場合に使用します。

```dotenv
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

1. 設定画面で「クラウドスケジューラー」をQStashへ変更
2. 公開アプリURLを設定
3. QStash資格情報を保存
4. 「自動実行時刻を同期」を実行

QStash未使用時はVercel Cronが毎日09:00 JSTに実行します。

## Gemini

```dotenv
USE_GEMINI=true
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash
```

AIにはシステム確定済みの店舗名、氏名、出勤時刻、URLだけを渡します。出力検証に失敗した場合、またはAPI障害時は固定テンプレートを保存して処理を続行します。

## X公式API

```dotenv
X_API_KEY=...
X_API_SECRET=...
X_ACCESS_TOKEN=...
X_ACCESS_TOKEN_SECRET=...
X_MOCK_MODE=false
```

OAuth 1.0a User Contextを `lib/posting/x-client.ts` に閉じ込めています。投稿は `POST /2/tweets`、画像登録は公式media upload endpointを利用します。管理画面から保存した秘密値はAES-256-GCMで暗号化し、平文を再表示しません。

実アカウントへ切り替える前に、テストアカウントで次を確認してください。

1. 読み書き権限とUser Access Token
2. 画像許可ドメイン
3. 投稿上限と利用プラン
4. 401 / 403 / 429 / 5xx時の表示
5. 同一日・店舗・投稿種別の重複拒否

## Cron

`vercel.json` は毎日 `00:00 UTC` に `/api/cron/daily` を呼びます。これは日本時間の毎日 `09:00 JST` です。

日次処理:

1. 自動取得ONの店舗をスケジュール同期
2. 当日投稿計画
3. Geminiまたは固定テンプレートで本文生成
4. 自動投稿ONかつ承認不要の投稿をXへ送信
5. job run保存

Vercelの `CRON_SECRET` を設定するとAuthorization Bearerを検証します。

## 店舗ごとの自動化

設定画面で次を独立して変更できます。

- 店舗を運用対象にする
- 出勤表を自動取得
- Xへ自動投稿
- 自動実行時刻
- URL掲載率、最大掲載人数、ハッシュタグ
- 画像許可ドメイン、承認必須、X抑制時停止
- DOM selector

自動投稿をOFFにしても、出勤取得と投稿案作成は継続します。全店舗を即時停止する場合は「全店舗のX投稿を許可」をOFFにします。

大井町の出勤表は `https://esthe-spa-lounge.com/schedule/` を初期値にしています。新規在籍者は候補マスタへ自動登録され、掲載同意を確認するまで投稿対象になりません。

## 売上取込

- `.xlsx`, `.xls`, `.csv`
- 最大5MB
- 先頭30行からヘッダ検出
- `reservation`, `therapist_daily`, `store_daily`, `subtotal`, `total`, `empty`, `unknown` に分類
- `file_hash + sheet + row + date + store + therapist + amount` をsource key化
- 要確認行が残るバッチは確定不可

サンプル:

```powershell
npm run import:sample
```

## API

画面の読み取りはServer Componentが `getAppData()` 等で直接取得します。
以前あった読み取り専用REST(`/api/dashboard`、`/api/dashboard/monthly`、`/api/analytics/*`、および `/api/posts`・`/api/shifts`・`/api/stores`・`/api/imports` の一覧GET)は、UIから未使用の二重実装だったため廃止しました。

副作用のあるRoute Handlersと外部連携用エンドポイント:

- `PATCH /api/stores/:storeCode`, `POST /api/stores/:storeCode/x-health`
- `POST/PATCH /api/therapists`, `PATCH /api/therapists/:id`
- `POST /api/shifts/sync`, `POST /api/shifts/manual`
- `POST /api/imports/upload`, `POST /api/imports/ai`, `POST /api/imports/:batchId/confirm|parse`, `PATCH /api/imports/:batchId/rows/:rowId`
- `POST /api/posts/generate`, `PATCH|DELETE /api/posts/:postId`, `POST /api/posts/:postId/approve|publish|retry|cancel`
- `GET|PATCH /api/settings`, `POST /api/settings/secrets|scheduler`
- `GET /r/x/:postId`(クリック計測リダイレクト)
- `GET /api/cron/daily`, `GET|POST /api/cron/store/:storeCode`(スケジューラ)

書込APIはSupabaseモードで認証とadmin roleを確認します。

## データと時刻

- DB保存: UTC `timestamptz`
- 画面・業務日判定: `Asia/Tokyo`
- 売上日・出勤日: JSTの `date`
- IP: 平文保存禁止、`IP_HASH_SALT` を使ったSHA-256
- 画像: URLのみ保存

## ディレクトリ

```text
app/                 UI、Route Handlers、tracking redirect
components/          管理画面と操作コンポーネント
lib/                 DB、scraper、import、posting、analytics、locks
supabase/migrations/ PostgreSQL schema、RLS、view
supabase/seed.sql    3店舗、25名、variants、デモ売上
tests/               unit、integration、e2e、fixtures
scripts/             デモ確認用CLI
```

## 本番移行

詳細は [docs/PRODUCTION_CHECKLIST.md](docs/PRODUCTION_CHECKLIST.md) を参照してください。最低限、実店舗URLとselector確認、管理者許可リスト、強いsalt/secret、Supabaseバックアップ、Upstash、Gemini、公式X認証、承認制、Webhook監視を設定します。

## 既知の制約

[docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) にまとめています。特に、店舗固有DOMの実地確認、X APIプラン差分、モックストアの非永続性、PoC分析の交絡要因に注意してください。

## セキュリティノート

`xlsx@0.18.5` はnpm配布版に既知のPrototype Pollution / ReDoS advisoryがあり、npm上に修正版がありません。本PoCでは管理者限定、5MB上限、許可拡張子、確定前レビューで影響を抑えています。本番前にSheetJS公式配布版または保守中の互換実装へ置換してください。

## 仕様

実装の基本設計は [SPEC.md](SPEC.md) です。
