create table if not exists app_settings (
  id text primary key,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists app_secrets (
  key text primary key,
  encrypted_value text not null,
  iv text not null,
  auth_tag text not null,
  updated_at timestamptz not null default now()
);

alter table posts
  add column if not exists control_therapist_ids jsonb not null default '[]'::jsonb,
  add column if not exists measurement_mode text not null default 'operations_only';

alter table posts drop constraint if exists posts_measurement_mode_check;
alter table posts
  add constraint posts_measurement_mode_check
  check (measurement_mode in ('operations_only', 'randomized_holdout'));

alter table tracking_clicks
  add column if not exists is_bot boolean not null default false,
  add column if not exists bot_reason text,
  add column if not exists counted boolean not null default true;

alter table sales_records drop constraint if exists sales_records_customer_type_check;
alter table sales_records
  add constraint sales_records_customer_type_check
  check (customer_type in ('新規','再来'));

alter table sales_records drop constraint if exists sales_records_nomination_check;
alter table sales_records
  add constraint sales_records_nomination_check
  check (nomination in ('Y','N','不明'));

alter table sales_records drop constraint if exists sales_records_status_check;
alter table sales_records
  add constraint sales_records_status_check
  check (status in ('来店済','予約済','キャンセル'));

insert into app_settings (id, config)
values (
  'default',
  '{
    "measurementMode": "operations_only",
    "postingEnabled": true,
    "dailyPostLimit": 3,
    "monthlyXBudgetYen": 5000,
    "estimatedXCostPerPostYen": 15,
    "useGemini": false,
    "geminiModel": "gemini-2.5-flash",
    "xMockMode": true,
    "xApiBaseUrl": "https://api.x.com",
    "xUploadBaseUrl": "https://upload.twitter.com",
    "botFilterEnabled": true,
    "botUserAgentPatterns": ["bot","crawler","spider","preview","Twitterbot","facebookexternalhit","Slackbot","Discordbot","Googlebot","bingbot"],
    "reachMonitoringEnabled": true,
    "minimumImpressionsAfter24h": 50,
    "grossProfitIsEstimate": true,
    "defaultTherapistPaymentRate": 0.56
  }'::jsonb
)
on conflict (id) do nothing;

alter table app_settings enable row level security;
alter table app_secrets enable row level security;

drop policy if exists authenticated_read on app_settings;
create policy authenticated_read
  on app_settings for select to authenticated using (true);

create index if not exists tracking_clicks_counted_idx
  on tracking_clicks(post_id, clicked_at)
  where counted = true;
