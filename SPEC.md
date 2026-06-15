
## 0. Codexへの実装指示

本ドキュメントを唯一の基本設計書として、PoCアプリを実装すること。

### 0.1 2026-06-14 設計レビュー反映（後続節より優先）

- PoCの既定成功条件は「運用実現性の検証」とし、売上貢献の検証は含めない。
- 通常運用で選定した掲載日と非掲載日の売上差は、系統的selection biasがあるため表示・意思決定に使用しない。
- 売上差を探索する場合のみ、同条件候補を掲載群と非掲載群へランダム割当する`randomized_holdout`を使用する。
- 各比較群30観測未満、および各variant 30投稿未満は探索値とし、勝敗判定に使用しない。
- variantは単純な日替わりラウンドロビンではなく、店舗×曜日内で割当回数を均等化する。
- 日次Cronは店舗単位の独立ジョブへfan-outし、店舗ジョブごとに実行時間上限を設定する。
- XリンクのクリックはUser-Agentによるbot判定を保存し、botアクセスを集計から除外する。
- 投稿キルスイッチ、日次投稿上限、月次想定X費用上限、Xアカウント抑制時の停止を必須とする。
- 粗利は実支払額が無い場合の概算であり、設定可能な取り分率を用いる。
- 店舗URL、Xアカウント、スクレイパー設定、外部API資格情報は管理画面から変更可能にする。秘密値は暗号化し再表示しない。
- 店舗ごとに自動スクレイピングと自動投稿を独立してON/OFFできるようにする。
- 自動投稿OFF時も出勤取得と投稿案作成を継続し、Xへの送信だけを停止する。
- 店舗別の実行時刻をUIから変更する場合はQStash scheduleを同期し、Vercel日次Cronを低コストfallbackとする。
- 掲載同意は契約時に全従業員から取得済みの運用とし、publication_consentを投稿可否のゲートにしない(2026-06-14決定)。新規在籍者は候補マスタへ自動登録し、同日から投稿対象に含める。実データ異常(時刻解析不能等)があるshiftのみreview_requiredで自動除外する。

以降の節で上記と矛盾する「売上貢献可能性」「掲載日/非掲載日比較」「ラウンドロビン」「単一Cron逐次実行」「一律0.56」の記述は、本改訂により置き換える。

### 実装方針

- TypeScriptは`strict: true`とする
- Next.js App Routerを使用する
- 画面、API、DB、バッチ、AI生成、X投稿、分析機能まで一体で実装する
- 外部APIキーが未設定でも、モックモードで画面確認とテストができるようにする
- 店舗固有情報、URL、投稿時間、AIモデル名、投稿ルールはハードコードせず設定化する
- 日時は保存時UTC、表示と業務判定は`Asia/Tokyo`で統一する
- AIに事実情報を生成させない。店舗名、セラピスト名、出勤時間、料金、URL、売上値はシステム側で確定する
- AI生成が失敗しても、固定テンプレートで処理を継続できるようにする
- X投稿は公式APIのみを利用し、ブラウザ自動操作は実装しない
- すべての自動処理は冪等にし、重複投稿と重複取込を防止する
- エラーを握りつぶさず、管理画面とログに残す
- PoCでは低コストを優先し、Vercel / Supabase / Upstash / Geminiの無料枠を基本とする
- X API利用料のみ従量課金を許容する
- 仕様上不明な店舗URLやX認証情報は環境変数またはDB設定として実装し、ダミー値をseedする
- 実装完了時に、README、セットアップ手順、DB migration、seed、テスト、デモデータを含める

---

# 1. プロジェクト概要

## 1.1 仮称

**Esthe Growth Autopilot PoC**

## 1.2 対象店舗

1. ザ・リッツ蒲田
2. スパラウンジ大井町
3. 巣鴨店

内部の正規店舗名は以下とする。

| store_code | 正規名 | 表示名 |
|---|---|---|
| `kamata` | 蒲田 | ザ・リッツ蒲田 |
| `oimachi` | 大井町 | スパラウンジ大井町 |
| `sugamo` | 巣鴨 | 巣鴨店 |

## 1.3 背景

店舗運営では、毎日の出勤情報確認、投稿文作成、画像選定、X投稿、投稿履歴管理、売上集計、セラピスト別分析に手作業が発生している。

単に投稿を自動化するだけでは、投稿が売上へ寄与したかを判断できない。PoCでは、3店舗横断で以下を一体化する。

- 出勤情報の自動取得
- AIによる投稿文生成
- Xへの自動投稿
- 投稿対象セラピストの管理
- 売上データの取込
- セラピスト別の売上分析
- 投稿内容別の効果比較
- 管理画面による確認、再実行、異常検知

---

# 2. PoCの目的

## 2.1 主目的

以下の3点を検証する。

1. **運用実現性**
   - 3店舗の出勤情報を安定して取得し、Xへ自動投稿できるか
2. **運用効率**
   - 毎日の投稿作業と売上集計作業を削減できるか
3. **売上貢献可能性**
   - 投稿対象、訴求パターン、店舗、セラピストごとに売上への寄与を比較できるか

## 2.2 PoCで確認すべき問い

- 3店舗を1画面で運用できるか
- 出勤情報を誤りなく取得できるか
- 同じ投稿を重複送信しないか
- AI生成文が事実情報を変更せず、実運用可能な品質か
- どの投稿パターンが反応や売上につながるか
- 投稿掲載されたセラピストと非掲載セラピストで売上傾向に差があるか
- 店舗別、曜日別、時間帯別で有効な投稿内容が異なるか
- X経由の流入や予約を可能な範囲で追跡できるか
- 公式アカウント移行後も同じ構成を拡張利用できるか

---

# 3. 成功条件

## 3.1 システム面

| 指標 | PoC合格基準 |
|---|---:|
| 出勤情報取得成功率 | 95%以上 |
| X投稿成功率 | 95%以上 |
| 重複投稿 | 0件 |
| 店舗名誤り | 0件 |
| セラピスト名誤り | 0件 |
| 出勤時間誤り | 0件 |
| 売上取込成功率 | 95%以上 |
| 重大なデータ破損 | 0件 |
| 手作業時間 | 週30分以下 |

## 3.2 効果検証面

PoC期間中に以下を比較可能な状態にする。

- 店舗別売上
- セラピスト別売上
- 出勤時間当たり売上
- 投稿掲載日と非掲載日の売上
- 投稿パターン別のクリック数
- 投稿パターン別の予約数
- 投稿パターン別の売上
- 新規 / 再来 / 指名構成
- URLあり / URLなし投稿の差
- 画像あり / 画像なし投稿の差

統計的有意差まではPoCの必須条件としない。サンプル不足の場合は明示する。

---

# 4. 設計思想

## 4.1 最小コスト

PoCでは以下を基本とする。

| 領域 | 採用候補 | PoC費用方針 |
|---|---|---|
| Web / API / Cron | Vercel | 無料枠を利用 |
| DB / Auth | Supabase | 無料枠を利用 |
| 分散ロック | Upstash Redis | 無料枠を利用 |
| AI | Gemini API | 無料枠を利用 |
| ソース管理 | GitHub | 無料 |
| X投稿 | X API | 実利用分のみ課金 |
| 独自ドメイン | 任意 | PoCでは不要 |

料金はコードへ埋め込まず、管理画面で実績値または概算値を設定できるようにする。

## 4.2 AIは判断補助

AIの役割は以下に限定する。

- 投稿文の表現生成
- 訴求軸の変更
- 文章の短文化
- 投稿パターンの生成
- 分析結果の自然言語要約

AIに任せない項目は以下。

- 店舗名
- セラピスト名
- 出勤時刻
- コース料金
- 売上値
- 投稿対象者
- 画像
- URL
- 投稿可否
- 重複判定
- 売上計算

## 4.3 事実と推定の分離

売上データ取込時は以下を区別する。

- 原文から確定できる値
- マスタから正規化した値
- 推定値
- 欠損値
- 異常値

各レコードに以下を保持する。

- `confidence`
- `review_required`
- `inferred_fields`
- `missing_fields`
- `anomalies`

## 4.4 冪等性

以下はすべて重複実行可能にする。

- スケジュール同期
- 売上ファイル取込
- 投稿生成
- X投稿
- 分析集計

同一店舗、同一日、同一投稿種別で既に投稿済みの場合は、明示的な再投稿操作がない限り再投稿しない。

## 4.5 本番移行可能性

PoC用コードを捨てず、公式アカウント移行時に以下だけ変更できる構成とする。

- Vercelプラン
- X認証情報
- 投稿承認ルール
- Cron頻度
- 監視設定
- ログ保持期間
- 店舗別投稿ルール
- 利用ユーザー
- 投稿数上限

---

# 5. PoCスコープ

## 5.1 必須機能

1. 3店舗統合管理画面
2. 3店舗スケジュール情報取得
3. セラピストマスタ管理
4. 出勤情報の正規化
5. 売上CSV / Excel取込
6. 予約単位または日次セラピスト単位への構造化
7. AI投稿文生成
8. 複数の投稿パターン管理
9. 投稿プレビュー
10. X公式API投稿
11. 画像付き投稿
12. 投稿履歴
13. 重複投稿防止
14. 投稿エラー表示
15. 手動再実行
16. セラピスト別売上分析
17. 店舗別売上分析
18. 投稿掲載日 / 非掲載日比較
19. 投稿パターン別比較
20. X流入計測用リダイレクトURL
21. データ品質確認
22. モックモード

## 5.2 PoC対象外

- LINE公式アカウント連携
- Instagram連携
- Googleビジネスプロフィール連携
- 顧客個人情報管理
- 顧客単位のCRM
- 高度な機械学習
- 自動広告出稿
- 複雑な権限階層
- 会計システム連携
- 完全な予約在庫管理
- リアルタイム空き枠最適化
- 自動返信
- DM送信

---

# 6. 全体アーキテクチャ

```mermaid
flowchart TD
    A1[蒲田スケジュールページ] --> B[Schedule Scraper]
    A2[大井町スケジュールページ] --> B
    A3[巣鴨スケジュールページ] --> B

    S1[Excel / CSV売上ファイル] --> C[Sales Importer]
    C --> D[Normalizer / Validator]
    B --> D

    D --> E[(Supabase PostgreSQL)]

    F[Vercel Cron] --> G[Job Orchestrator]
    G --> B
    G --> H[Post Planner]
    H --> I[AI Copy Generator]
    I --> J[Post Validator]
    J --> K[X API Client]
    K --> X[X]

    G --> L[(Upstash Redis)]
    L --> G

    E --> M[Next.js Admin UI]
    M --> N[Dashboard]
    M --> O[Post Management]
    M --> P[Sales Analysis]
    M --> Q[Import Review]

    X --> R[Tracking URL / Click Endpoint]
    R --> E
    R --> T[店舗スケジュールページ]

    K --> E
    I --> E
    C --> E
7. 技術スタック
7.1 フロントエンド
Next.js App Router

TypeScript

React

Tailwind CSS

shadcn/ui

Recharts

React Hook Form

Zod

TanStack Table

7.2 バックエンド
Next.js Route Handlers

Vercel Functions

Vercel Cron

Supabase PostgreSQL

Supabase Auth

Upstash Redis

Gemini API

X API v2

Cheerio

SheetJS

7.3 推奨ライブラリ
{
  "dependencies": {
    "@supabase/supabase-js": "latest",
    "@upstash/redis": "latest",
    "@google/generative-ai": "latest",
    "cheerio": "latest",
    "xlsx": "latest",
    "zod": "latest",
    "date-fns": "latest",
    "date-fns-tz": "latest",
    "oauth-1.0a": "latest",
    "crypto-js": "latest",
    "recharts": "latest",
    "@tanstack/react-table": "latest",
    "react-hook-form": "latest"
  }
}
バージョンは実装時点の安定版を選定し、lockファイルをコミットする。

8. 認証と利用者
8.1 PoC認証
Supabase AuthのメールOTPを利用する。

8.2 利用者制限
環境変数またはDBで管理者メールを許可リスト化する。

ADMIN_EMAILS=user1@example.com,user2@example.com
8.3 権限
PoCでは以下の2種類のみ。

role	権限
admin	全機能
viewer	閲覧のみ
9. 主要業務フロー
9.1 出勤情報同期
9.2 投稿生成と投稿
9.3 売上取込
10. 画面設計
10.1 画面一覧
画面	URL
ログイン	/login
全店ダッシュボード	/dashboard
店舗詳細	/stores/[storeCode]
投稿管理	/posts
投稿詳細 / プレビュー	/posts/[postId]
セラピスト分析	/therapists
セラピスト詳細	/therapists/[therapistId]
売上分析	/analytics
売上取込	/imports
取込レビュー	/imports/[batchId]
同期 / ジョブログ	/jobs
設定	/settings
10.2 全店ダッシュボード
KPIカード
本日売上

月次売上

月次目標進捗率

本日本数

客単価

新規数

指名数

本日出勤人数

投稿成功数

投稿エラー数

店舗別一覧
店舗	本日出勤	本日売上	本数	客単価	月次進捗	投稿状態	エラー
本日の投稿
店舗

投稿予定時刻

投稿パターン

掲載セラピスト

投稿状態

X投稿URL

再実行

アラート
スクレイピング失敗

セラピスト未マッチ

売上取込エラー

投稿失敗

画像取得失敗

投稿文検証失敗

10.3 投稿管理
フィルタ:

店舗

投稿日

投稿状態

投稿パターン

AI使用有無

URL有無

画像有無

一覧列:

投稿日

店舗

投稿文

掲載セラピスト

variant

status

X post id

クリック数

関連売上

created_at

10.4 セラピスト分析
一覧列:

セラピスト

主店舗

出勤日数

総出勤時間

投稿掲載回数

売上

本数

客単価

時間当たり売上

新規比率

再来比率

指名比率

掲載日平均売上

非掲載日平均売上

差分

サンプル数

10.5 売上取込
機能:

.xlsx, .xls, .csv対応

シート選択

自動ヘッダ検出

店舗指定

月指定

プレビュー

行分類

エラー / 警告表示

手動補正

確定取込

再取込

11. データモデル
11.1 stores
create table stores (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  canonical_name text not null,
  display_name text not null,
  schedule_url text,
  booking_url text,
  x_account_name text,
  monthly_target integer,
  room_capacity integer not null default 2,
  enabled boolean not null default true,
  scraper_config jsonb not null default '{}'::jsonb,
  posting_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
11.2 therapists
create table therapists (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  display_name text not null,
  primary_store_id uuid references stores(id),
  aliases text[] not null default '{}',
  profile_url text,
  profile_image_url text,
  publication_consent boolean not null default false,
  active boolean not null default true,
  priority_flag boolean not null default false,
  newcomer_flag boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(canonical_name, primary_store_id)
);
11.3 shifts
create table shifts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  therapist_id uuid references therapists(id),
  therapist_raw text,
  shift_date date not null,
  start_time time,
  end_time time,
  source text not null,
  source_url text,
  source_key text not null,
  confidence integer not null default 100,
  review_required boolean not null default false,
  inferred_fields jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  anomalies jsonb not null default '[]'::jsonb,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, source_key)
);
11.4 sales_import_batches
create table sales_import_batches (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_hash text not null unique,
  store_id uuid references stores(id),
  source_sheet text,
  period_from date,
  period_to date,
  status text not null check (status in ('uploaded','parsed','review','confirmed','failed')),
  total_rows integer not null default 0,
  accepted_rows integer not null default 0,
  rejected_rows integer not null default 0,
  warning_rows integer not null default 0,
  uploaded_by uuid,
  error_message text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
11.5 sales_records
予約単位または1日1セラピスト単位を格納する。

create table sales_records (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid references sales_import_batches(id),
  raw_id text,
  record_type text not null check (record_type in ('reservation','therapist_daily','store_daily')),
  sales_date date not null,
  store_id uuid references stores(id),
  therapist_id uuid references therapists(id),
  therapist_raw text,
  start_time time,
  course_minutes integer,
  sales_amount integer not null default 0,
  therapist_payment integer,
  gross_profit integer,
  discount integer,
  customer_type text check (customer_type in ('新規','再来') or customer_type is null),
  nomination text check (nomination in ('Y','N','不明')),
  source text,
  status text check (status in ('来店済','予約済','キャンセル')),
  confidence integer not null default 100,
  review_required boolean not null default false,
  inferred_fields jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  anomalies jsonb not null default '[]'::jsonb,
  raw_payload jsonb,
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
11.6 post_variants
create table post_variants (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  description text,
  prompt_template text,
  fixed_template text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
初期seed:

code	name
schedule_info	出勤情報型
therapist_focus	セラピスト訴求型
reservation_push	予約促進型
brand_message	ブランド訴求型
11.7 posts
create table posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  post_date date not null,
  post_type text not null default 'daily_schedule',
  variant_id uuid references post_variants(id),
  status text not null check (status in ('draft','scheduled','processing','posted','failed','cancelled')),
  approval_status text not null default 'auto' check (approval_status in ('auto','pending','approved','rejected')),
  scheduled_at timestamptz,
  posted_at timestamptz,
  text_content text not null,
  fallback_text text,
  used_ai boolean not null default false,
  ai_model text,
  ai_prompt text,
  ai_raw_response text,
  include_url boolean not null default false,
  tracking_url text,
  image_urls jsonb not null default '[]'::jsonb,
  x_media_ids jsonb not null default '[]'::jsonb,
  x_post_id text,
  x_post_url text,
  content_hash text not null,
  attempt_count integer not null default 0,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(store_id, post_date, post_type)
);
11.8 post_therapists
create table post_therapists (
  post_id uuid not null references posts(id) on delete cascade,
  therapist_id uuid not null references therapists(id),
  display_order integer not null,
  selection_reason text,
  image_url text,
  primary key(post_id, therapist_id)
);
11.9 tracking_clicks
create table tracking_clicks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id),
  clicked_at timestamptz not null default now(),
  user_agent text,
  referer text,
  ip_hash text,
  destination_url text not null
);
IPアドレスは平文保存しない。必要ならソルト付きハッシュのみ保存する。

11.10 post_metrics
PoCでは手動入力または取得可能な範囲を保存する。

create table post_metrics (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id),
  measured_at timestamptz not null default now(),
  impressions integer,
  likes integer,
  reposts integer,
  replies integer,
  bookmarks integer,
  profile_clicks integer,
  link_clicks integer,
  reservations integer,
  attributed_sales integer,
  metric_source text not null default 'manual'
);
11.11 job_runs
create table job_runs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  store_id uuid references stores(id),
  target_date date,
  status text not null check (status in ('running','success','partial','failed','skipped')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  processed_count integer not null default 0,
  success_count integer not null default 0,
  error_count integer not null default 0,
  error_message text,
  metadata jsonb not null default '{}'::jsonb
);
12. 売上データ正規化仕様
12.1 入力形式
CSV

Excel

ヘッダ位置不定

空行あり

合計行あり

列崩れあり

日次集計行あり

店舗名がシート名にしかない場合あり

年のない日付あり

セラピスト名が別名の場合あり

12.2 行分類
各行を以下へ分類する。

reservation

therapist_daily

store_daily

subtotal

total

empty

unknown

subtotal, total, emptyは取込対象外。

12.3 正規化ルール
年のない日付は対象年度設定を利用

店舗名は店舗マスタで正規化

セラピスト名は別名マスタで正規化

数値カンマを除去

#DIV/0!, #N/A, 空欄はnull

日次集計行はrecord_type = store_daily

セラピスト不明の場合はtherapist_id = null

料金マスタと矛盾する場合はanomaliesへ記録

推定値はinferred_fieldsへ記録

人間確認が必要な場合はreview_required = true

confidenceは0から100

12.4 重複判定
以下を連結したハッシュをsource_keyとする。

file_hash
+ sheet_name
+ row_number
+ normalized_date
+ normalized_store
+ normalized_therapist
+ sales_amount
13. スケジュールスクレイピング仕様
13.1 店舗設定
店舗ごとにstores.scraper_configへ設定する。

{
  "dateTabSelector": "[id^='tlsp-']",
  "dateIdPattern": "tlsp-YYYY-MM-DD",
  "cardSelector": ".tl-schedule-card",
  "nameSelector": ".therapist-name",
  "timeSelector": ".schedule-time",
  "imageSelector": "img",
  "profileLinkSelector": "a",
  "fallbackActiveTabSelector": ".is-active",
  "timezone": "Asia/Tokyo"
}
実際のDOMに合わせて設定値を修正できるようにする。

13.2 取得項目
店舗

日付

セラピスト表示名

開始時刻

終了時刻

画像URL

プロフィールURL

raw HTML fragment

取得日時

13.3 セラピスト正規化
処理順:

全角 / 半角空白除去

改行除去

宣伝文言除去

マスタ完全一致

alias一致

主店舗一致

未一致なら新規候補としてreview_required = true

13.4 例外条件
以下の場合は自動投稿対象外。

当日タブがない

セラピスト0名

名前が空

開始時刻が解析不能

画像URLが許可ドメイン外

取得件数が通常範囲から大きく逸脱

HTMLサイズが異常

レスポンスがHTML以外

14. 投稿対象セラピスト選定
14.1 基本制約
最大4名

当日出勤者のみ

active = true

（掲載同意は契約時取得済みのため投稿条件にしない。第0.1節の決定によりpublication_consentでのブロックは廃止）

画像がない場合でもテキスト掲載は可

同一セラピストの過度な連続掲載を避ける

14.2 PoC選定スコア
selection_score
=
未掲載日数 × 3
+ priority_flag × 10
+ newcomer_flag × 8
+ 直近30日掲載回数の少なさ × 2
+ 直近30日売上未達度 × 2
+ 出勤時間の長さ × 1
売上データが不足する場合は、未掲載日数と掲載回数を主に利用する。

14.3 選定理由保存
post_therapists.selection_reasonへ保存する。

例:

前回未掲載 / 直近30日掲載回数が少ない / 重点販促対象
15. AI投稿最適化
15.1 目的
単なる文章生成ではなく、以下を比較検証する。

どの訴求軸が反応されるか

どの店舗でどの訴求が効くか

どのセラピスト構成で反応が高いか

URL有無の差

画像有無の差

投稿パターン別の売上差

15.2 入力情報
{
  "store": {
    "name": "ザ・リッツ蒲田",
    "monthly_target": 2600000,
    "monthly_sales": 1800000,
    "progress_rate": 0.692
  },
  "date": "2026-06-15",
  "day_of_week": "月",
  "therapists": [
    {
      "name": "ちひろ",
      "start_time": "12:00",
      "end_time": "20:00",
      "sales_30d": 145000,
      "booking_count_30d": 8,
      "average_ticket_30d": 18125,
      "new_customer_ratio": 0.25,
      "nomination_ratio": 0.5
    }
  ],
  "variant": "reservation_push",
  "include_url": true,
  "url": "https://example.vercel.app/r/x/POST_ID",
  "constraints": {
    "max_chars": 140,
    "max_emojis": 3,
    "max_hashtags": 3
  }
}
15.3 AIシステムプロンプト
あなたはメンズエステ店舗のX投稿文を作成するコピーライターです。
入力JSONに含まれる事実だけを使用してください。
店舗名、セラピスト名、出勤時刻、料金、URL、数値を変更または追加してはいけません。
過剰な煽り、虚偽、性的に露骨な表現、在庫や空き枠の断定は禁止です。
指定された投稿パターンに従い、自然な日本語でX投稿文を1案だけ生成してください。
出力は投稿本文のみとし、説明文、引用符、Markdownは含めないでください。
15.4 投稿パターン
schedule_info
事実を簡潔に伝える

全員の名前と時間を表示

CTAは弱め

therapist_focus
セラピストの特徴ではなく、出勤メンバーの紹介に重点

未提供の性格や施術特徴を生成しない

reservation_push
予約行動を促す

予約可能、残り枠など未確認情報は書かない

詳細確認先を案内

brand_message
店舗の世界観を伝える

出勤情報は必ず保持

誇大表現を避ける

15.5 AI出力検証
必須チェック:

文字数

店舗名一致

掲載対象者名が全て含まれる

未掲載者名が含まれない

出勤時間一致

URL一致

禁止表現なし

料金の新規生成なし

空き枠断定なし

ハッシュタグ数

絵文字数

失敗した場合は固定テンプレートへフォールバックする。

16. 固定テンプレート
【本日の出勤情報】

{store_display_name}

{therapist_lines}

本日もご予約をお待ちしております。
{cta_line}
{hashtags}
例:

【本日の出勤情報】

ザ・リッツ蒲田

・ちひろ 12:00〜20:00
・みこ 14:00〜22:00
・かすみ 18:00〜翌2:00

本日もご予約をお待ちしております。
詳細はプロフィールからご確認ください。
#蒲田
17. A/Bテスト設計
17.1 割当方法
完全ランダムではなく、店舗ごとに均等になるようラウンドロビンで割り当てる。

schedule_info
→ therapist_focus
→ reservation_push
→ brand_message
→ 繰り返し
17.2 比較軸
variant

店舗

曜日

URL有無

画像有無

掲載人数

投稿時刻帯

AIあり / 固定テンプレート

セラピスト構成

17.3 最低サンプル表示
各分析画面でサンプル数を表示する。

5件未満: サンプル不足

5から14件: 参考値

15件以上: 比較対象

因果関係を断定しない。

18. X投稿仕様
18.1 認証
OAuth 1.0a User Contextまたは実装時点で推奨される公式認証方式

認証方式はx-client.tsに閉じ込める

APIキーはVercel環境変数に保存

DBへ平文保存しない

18.2 投稿処理
画像取得

MIME type検証

サイズ検証

X media upload

media id取得

post create

post id保存

post URL生成

statusをpostedへ更新

18.3 投稿失敗
429: Retry-Afterに従う

401 / 403: 即時失敗、管理画面へ表示

5xx: 最大3回指数バックオフ

画像1枚失敗: 残り画像で続行

全画像失敗: テキスト投稿へフォールバック

投稿本文失敗: 固定テンプレートへフォールバック

投稿自体失敗: failed

18.4 重複防止
Redis lock:

lock:post:{storeCode}:{YYYY-MM-DD}:{postType}
DB unique:

unique(store_id, post_date, post_type)
content hash:

sha256(store_id + post_date + variant + text + therapist_ids)
19. クリック計測
19.1 URL
/r/x/{postId}
19.2 処理
postId確認

クリック記録

IPはハッシュ化

302で店舗予約ページへリダイレクト

19.3 URL利用率
設定で変更可能とする。

{
  "includeUrlRate": 0.5
}
PoCでは、URLあり / URLなしの効果とコストを比較する。

20. 売上分析仕様
20.1 基本指標
店舗別
売上

本数

客単価

粗利

月次目標

進捗率

新規数

再来数

指名数

出勤人数

出勤時間

投稿回数

セラピスト別
売上

本数

客単価

出勤日数

出勤時間

時間当たり売上

新規比率

再来比率

指名比率

掲載回数

掲載率

掲載日平均売上

非掲載日平均売上

差分

サンプル数

投稿別
variant

掲載人数

AI有無

URL有無

画像数

クリック数

予約数

関連売上

投稿後当日売上

投稿後24時間売上

20.2 時間当たり売上
時間当たり売上 = 売上 / 出勤時間
出勤時間不明の場合は計算しない。

20.3 掲載日 / 非掲載日比較
掲載日平均売上
=
掲載された出勤日の売上合計 / 掲載された出勤日数
非掲載日平均売上
=
掲載されなかった出勤日の売上合計 / 非掲載出勤日数
曜日や出勤時間差が大きいため、参考値として表示する。

20.4 直接流入
予約データのsource = Xまたは投稿トラッキングURLからの流入を直接流入として扱う。

20.5 分析上の注意
投稿掲載と売上増加の因果関係は断定しない

人気セラピスト、曜日、出勤時間、既存予約の影響を注記する

サンプル不足時は「サンプル不足」と表示する

日次集計行はセラピスト別分析に含めない

therapist不明レコードは店舗集計にのみ含める

21. API設計

注記(2026-06実装): 画面の読み取りはServer Componentが getAppData() 等で直接行う方式に統一した。
このため本節の読み取り専用GET(/api/dashboard, /api/dashboard/monthly, /api/analytics/*, および
/api/posts・/api/shifts・/api/stores・/api/imports の一覧GET)はUIから未使用の二重実装となり、廃止した。
副作用のあるエンドポイント(POST/PATCH/DELETE)とcron系、リダイレクト /r/x/:postId は現行のまま。

21.1 Dashboard
GET /api/dashboard?date=YYYY-MM-DD
GET /api/dashboard/monthly?month=YYYY-MM
21.2 Stores
GET /api/stores
GET /api/stores/:storeCode
PATCH /api/stores/:storeCode
21.3 Therapists
GET /api/therapists
GET /api/therapists/:id
POST /api/therapists
PATCH /api/therapists/:id
21.4 Shifts
GET /api/shifts?date=YYYY-MM-DD&store=kamata
POST /api/shifts/sync
POST /api/shifts/manual
21.5 Imports
POST /api/imports/upload
POST /api/imports/:batchId/parse
GET /api/imports/:batchId
PATCH /api/imports/:batchId/rows/:rowId
POST /api/imports/:batchId/confirm
21.6 Posts
GET /api/posts
POST /api/posts/generate
GET /api/posts/:id
PATCH /api/posts/:id
POST /api/posts/:id/approve
POST /api/posts/:id/publish
POST /api/posts/:id/retry
POST /api/posts/:id/cancel
21.7 Analytics
GET /api/analytics/stores
GET /api/analytics/therapists
GET /api/analytics/therapists/:id
GET /api/analytics/posts
GET /api/analytics/variants
21.8 Tracking
GET /r/x/:postId
21.9 Cron
GET /api/cron/daily
1つのCronで以下を順次実行する。

3店舗スケジュール同期

当日投稿計画作成

投稿文生成

投稿

集計更新

job run保存

22. Cron設計
22.1 PoC
1日1回のCronを基本とする。

{
  "crons": [
    {
      "path": "/api/cron/daily",
      "schedule": "0 0 * * *"
    }
  ]
}
JST換算はコードとREADMEへ明記する。

22.2 手動実行
管理画面から以下を実行可能にする。

全店舗同期

店舗単位同期

投稿再生成

投稿再実行

分析再集計

23. 環境変数
NEXT_PUBLIC_APP_URL=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
USE_GEMINI=true

X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_TOKEN_SECRET=
X_MOCK_MODE=true

CRON_SECRET=
ADMIN_EMAILS=

STORE_KAMATA_SCHEDULE_URL=https://the-ritz-kamata.com/schedule/
STORE_OIMACHI_SCHEDULE_URL=
STORE_SUGAMO_SCHEDULE_URL=

ALERT_WEBHOOK_URL=
24. ファイル構成
esthe-growth-autopilot/
├── app/
│   ├── (auth)/
│   │   └── login/page.tsx
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx
│   │   ├── stores/[storeCode]/page.tsx
│   │   ├── posts/page.tsx
│   │   ├── posts/[postId]/page.tsx
│   │   ├── therapists/page.tsx
│   │   ├── therapists/[therapistId]/page.tsx
│   │   ├── analytics/page.tsx
│   │   ├── imports/page.tsx
│   │   ├── imports/[batchId]/page.tsx
│   │   ├── jobs/page.tsx
│   │   └── settings/page.tsx
│   ├── api/
│   │   ├── cron/daily/route.ts
│   │   ├── dashboard/route.ts
│   │   ├── stores/route.ts
│   │   ├── therapists/route.ts
│   │   ├── shifts/sync/route.ts
│   │   ├── imports/upload/route.ts
│   │   ├── imports/[batchId]/confirm/route.ts
│   │   ├── posts/generate/route.ts
│   │   ├── posts/[postId]/publish/route.ts
│   │   ├── posts/[postId]/retry/route.ts
│   │   └── analytics/route.ts
│   ├── r/x/[postId]/route.ts
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── dashboard/
│   ├── posts/
│   ├── therapists/
│   ├── analytics/
│   ├── imports/
│   └── ui/
│
├── lib/
│   ├── auth/
│   ├── config/
│   ├── db/
│   ├── dates/
│   ├── scraper/
│   │   ├── base.ts
│   │   ├── kamata.ts
│   │   ├── oimachi.ts
│   │   └── sugamo.ts
│   ├── import/
│   │   ├── workbook-parser.ts
│   │   ├── header-detector.ts
│   │   ├── row-classifier.ts
│   │   ├── normalizer.ts
│   │   └── validator.ts
│   ├── posting/
│   │   ├── planner.ts
│   │   ├── therapist-selector.ts
│   │   ├── fixed-template.ts
│   │   ├── ai-generator.ts
│   │   ├── post-validator.ts
│   │   └── x-client.ts
│   ├── analytics/
│   │   ├── store-metrics.ts
│   │   ├── therapist-metrics.ts
│   │   ├── post-metrics.ts
│   │   └── sample-quality.ts
│   ├── redis/
│   │   ├── client.ts
│   │   └── lock.ts
│   ├── tracking/
│   ├── logger/
│   └── errors/
│
├── supabase/
│   ├── migrations/
│   └── seed.sql
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── fixtures/
│   └── e2e/
│
├── public/
├── scripts/
│   ├── seed-demo.ts
│   ├── test-scrapers.ts
│   └── import-sample.ts
├── .env.example
├── vercel.json
├── package.json
├── tsconfig.json
├── README.md
└── SPEC.md
25. 非機能要件
25.1 可用性
外部API失敗時も管理画面は表示可能

AI失敗時は固定テンプレート

画像失敗時はテキスト投稿

Redis失敗時は投稿を停止し、重複リスクを避ける

DB失敗時は投稿しない

25.2 性能
ダッシュボード初期表示3秒以内を目標

一覧APIはページネーション

画像をDBへ保存しない

集計はSQL viewまたはRPCを利用

大量Excelは行単位でメモリを圧迫しない設計

25.3 セキュリティ
秘密情報は環境変数

service role keyをクライアントへ公開しない

RLSを設定

Cron secret検証

管理APIは認証必須

ファイルサイズ上限

MIME type検証

SSRF対策として画像取得先を許可ドメイン制にする

HTMLサニタイズ

XSS対策

IP平文保存禁止

ログへAPIキーを出さない

25.4 監査性
以下を保存する。

誰が売上取込を確定したか

誰が投稿を承認したか

どのデータをもとにAI生成したか

AI model

prompt

raw response

fixed fallback

X post id

エラー内容

再実行回数

25.5 保守性
店舗固有DOMはscraper実装へ分離

AIモデル名は環境変数

X APIクライアントは独立

分析ロジックはUIから分離

DB migrationを必須化

主要ロジックは単体テスト

26. エラーコード
code	内容
SCHEDULE_FETCH_FAILED	スケジュール取得失敗
SCHEDULE_PARSE_FAILED	HTML解析失敗
TODAY_TAB_NOT_FOUND	当日タブなし
THERAPIST_NOT_MATCHED	セラピストマスタ未一致
INVALID_SHIFT_TIME	出勤時刻異常
IMAGE_FETCH_FAILED	画像取得失敗
AI_GENERATION_FAILED	AI生成失敗
AI_VALIDATION_FAILED	AI文検証失敗
X_AUTH_FAILED	X認証失敗
X_MEDIA_UPLOAD_FAILED	X画像登録失敗
X_POST_FAILED	X投稿失敗
DUPLICATE_POST	重複投稿
IMPORT_PARSE_FAILED	売上取込解析失敗
IMPORT_REVIEW_REQUIRED	要確認行あり
DB_ERROR	DB異常
LOCK_ACQUISITION_FAILED	排他ロック失敗
27. テスト仕様
27.1 Unit Test
JST日付変換

スケジュールHTML解析

セラピスト名正規化

出勤時間解析

行分類

合計行除外

金額変換

confidence計算

投稿対象選定

固定テンプレート生成

AI出力検証

X文字数検証

content hash

分析指標計算

サンプル不足判定

27.2 Integration Test
Supabase接続

Upstash lock

売上ファイル取込

投稿生成からDB保存

X mock投稿

tracking redirect

Cron全体フロー

27.3 E2E Test
ログイン

ダッシュボード表示

Excelアップロード

取込レビュー

投稿プレビュー

手動投稿

セラピスト分析表示

ジョブエラー表示

27.4 Fixture
以下を用意する。

正常な蒲田スケジュールHTML

DOM変更されたHTML

セラピスト0名HTML

画像URL欠損HTML

正常な売上CSV

ヘッダ位置不定Excel

合計行混入Excel

日次集計行Excel

列崩れExcel

マスタ未登録セラピスト

28. Seedデータ
28.1 店舗
蒲田

大井町

巣鴨

28.2 月次目標
店舗	月次目標
蒲田	2,600,000円
大井町	2,800,000円
巣鴨	1,600,000円
28.3 部屋数
全店舗2室。

28.4 コース料金
{
  "蒲田": {
    "90": 12000,
    "120": 16000,
    "150": 20000,
    "180": 24000
  },
  "大井町": {
    "90": 12000,
    "120": 16000,
    "150": 20000,
    "180": 24000
  },
  "巣鴨": {
    "60": 8000,
    "90": 12000,
    "120": 16000,
    "150": 20000,
    "180": 24000
  }
}
28.5 取り分率目安
0.56
28.6 セラピスト
以下をseedする。

あんず

ちなつ

えみり

えりか

かすみ

かずは

くみ

くれは

しおん

しずか

しのぶ

すみれ

ちあき

ちひろ

てるみ

ののは

ひより

ほのか

ますみ

まな

みこ

やすの

ゆい

ゆかり

わか

publication_consentはデフォルトfalseとし、デモ環境のみ一部をtrueにする。

29. 実装フェーズ
Phase 1: 基盤
Next.js初期化

Supabase接続

Auth

migration

seed

共通レイアウト

店舗 / セラピストマスタ

モックモード

Phase 2: スケジュール同期
蒲田scraper

大井町 / 巣鴨の設定枠

正規化

shifts保存

同期ログ

管理画面表示

Phase 3: 売上取込
CSV / Excelアップロード

ヘッダ検出

行分類

JSON正規化

取込レビュー

DB保存

Phase 4: 投稿生成
variant

投稿対象選定

固定テンプレート

Gemini

AI出力検証

プレビュー

Phase 5: X投稿
X mock client

X real client

media upload

post create

Redis lock

history

retry

error display

Phase 6: 3店舗統合管理画面
dashboard

store details

posts

jobs

alerts

Phase 7: 分析
店舗別

セラピスト別

投稿別

variant別

掲載 / 非掲載比較

サンプル不足表示

Phase 8: PoC運用準備
tracking URL

README

env example

Vercel設定

Supabase設定

テスト

デモデータ

運用手順

30. PoC運用段階
Stage 1: ドライラン
3店舗同期

AI生成

X投稿なし

2から3日

Stage 2: テキスト投稿
固定テンプレート

画像なし

1週間

Stage 3: 画像投稿
最大4枚

1週間

Stage 4: AI variant比較
4パターン

ラウンドロビン

最低2週間

Stage 5: 売上分析
売上ファイル取込

セラピスト別分析

投稿別分析

公式アカウント移行判断

31. 本番移行時の変更
項目	PoC	公式移行後
Vercel	無料枠	商用プラン
Xアカウント	テスト	公式
X認証情報	テスト用	公式用
投稿承認	自動または簡易	初期は承認制推奨
ログ保持	45日程度	90日以上
エラー通知	管理画面	Webhook / メール
Cron	1日1回	必要に応じ複数回
対象投稿	出勤情報	空き枠 / キャンセル / 販促
分析	PoC比較	継続KPI
権限	admin / viewer	店舗別権限追加
32. Definition of Done
以下をすべて満たした時点でPoC実装完了とする。

 Vercelへデプロイできる

 Supabase migrationが適用できる

 seedを実行できる

 ログインできる

 3店舗がダッシュボードへ表示される

 蒲田スケジュールを同期できる

 他2店舗はURL / selector設定後に同一方式で動く

 売上Excel / CSVを取込できる

 異常行をレビューできる

 セラピスト別売上を表示できる

 4種類の投稿variantを生成できる

 Gemini失敗時に固定文へ戻る

 投稿対象者を最大4名選定できる

 X mock modeで投稿フローを確認できる

 X real modeで画像付き投稿できる

 重複投稿を防止できる

 X投稿URLを保存できる

 tracking URLでクリックを記録できる

 掲載日 / 非掲載日の売上比較ができる

 variant別比較ができる

 サンプル不足を表示できる

 ジョブ失敗を管理画面で確認できる

 手動再実行できる

 Unit / Integration / E2Eテストがある

 READMEにセットアップ手順がある

 .env.exampleがある

 APIキーがコードやログに含まれない

33. Codexの最終成果物
Codexは以下を出力すること。

実行可能なNext.jsプロジェクト

Supabase migration

seed.sql

.env.example

Vercel Cron設定

Upstash Redis設定

Gemini連携

X mock / real client

3店舗統合管理画面

売上取込画面

投稿管理画面

セラピスト分析画面

店舗 / 投稿 / variant分析

Unit / Integration / E2Eテスト

README

デモデータ

既知の制約一覧

本番移行手順

34. Codexへの優先順位
実装判断に迷った場合は、以下の順で優先する。

誤投稿防止

重複防止

データの正確性

売上分析可能性

3店舗横断性

自動化

低コスト

UIの見栄え

高度なAI表現

AI表現の高度さよりも、名前、時間、店舗、売上の正確性を優先すること。
