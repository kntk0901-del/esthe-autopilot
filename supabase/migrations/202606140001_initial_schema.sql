create extension if not exists pgcrypto;

create table if not exists stores (
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

create table if not exists therapists (
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

create table if not exists shifts (
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
  confidence integer not null default 100 check (confidence between 0 and 100),
  review_required boolean not null default false,
  inferred_fields jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  anomalies jsonb not null default '[]'::jsonb,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source, source_key)
);

create table if not exists sales_import_batches (
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
  confirmed_by uuid,
  error_message text,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

create table if not exists sales_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references sales_import_batches(id) on delete cascade,
  row_number integer not null,
  classification text not null,
  normalized jsonb not null default '{}'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  confidence integer not null default 100 check (confidence between 0 and 100),
  review_required boolean not null default false,
  errors jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  unique(batch_id, row_number)
);

create table if not exists sales_records (
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
  nomination text check (nomination in ('Y','N','不明') or nomination is null),
  source text,
  status text check (status in ('来店済','予約済','キャンセル') or status is null),
  confidence integer not null default 100 check (confidence between 0 and 100),
  review_required boolean not null default false,
  inferred_fields jsonb not null default '[]'::jsonb,
  missing_fields jsonb not null default '[]'::jsonb,
  anomalies jsonb not null default '[]'::jsonb,
  raw_payload jsonb,
  source_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists post_variants (
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

create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references stores(id),
  post_date date not null,
  post_type text not null default 'daily_schedule',
  variant_id uuid references post_variants(id),
  status text not null check (status in ('draft','scheduled','processing','posted','failed','cancelled')),
  approval_status text not null default 'auto' check (approval_status in ('auto','pending','approved','rejected')),
  approved_by uuid,
  approved_at timestamptz,
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

create unique index if not exists posts_posted_content_hash_unique
  on posts(content_hash)
  where status = 'posted';

create table if not exists post_therapists (
  post_id uuid not null references posts(id) on delete cascade,
  therapist_id uuid not null references therapists(id),
  display_order integer not null,
  selection_reason text,
  image_url text,
  primary key(post_id, therapist_id)
);

create table if not exists tracking_clicks (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references posts(id),
  clicked_at timestamptz not null default now(),
  user_agent text,
  referer text,
  ip_hash text,
  destination_url text not null
);

create table if not exists post_metrics (
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

create table if not exists job_runs (
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

create index if not exists shifts_date_store_idx on shifts(shift_date, store_id);
create index if not exists sales_date_store_idx on sales_records(sales_date, store_id);
create index if not exists sales_therapist_date_idx on sales_records(therapist_id, sales_date);
create index if not exists posts_date_store_idx on posts(post_date, store_id);
create index if not exists tracking_clicks_post_idx on tracking_clicks(post_id, clicked_at);
create index if not exists job_runs_started_idx on job_runs(started_at desc);

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'stores', 'therapists', 'shifts', 'sales_records', 'post_variants', 'posts'
  ]
  loop
    execute format('drop trigger if exists set_%I_updated_at on %I', table_name, table_name);
    execute format(
      'create trigger set_%I_updated_at before update on %I for each row execute function set_updated_at()',
      table_name,
      table_name
    );
  end loop;
end;
$$;

create or replace view store_daily_metrics as
select
  sales_date,
  store_id,
  sum(sales_amount) as sales,
  count(*) filter (where record_type = 'reservation') as bookings,
  sum(gross_profit) as gross_profit,
  count(*) filter (where customer_type = '新規') as new_customers,
  count(*) filter (where customer_type = '再来') as repeat_customers,
  count(*) filter (where nomination = 'Y') as nominations
from sales_records
where status is distinct from 'キャンセル'
group by sales_date, store_id;

alter table stores enable row level security;
alter table therapists enable row level security;
alter table shifts enable row level security;
alter table sales_import_batches enable row level security;
alter table sales_import_rows enable row level security;
alter table sales_records enable row level security;
alter table post_variants enable row level security;
alter table posts enable row level security;
alter table post_therapists enable row level security;
alter table tracking_clicks enable row level security;
alter table post_metrics enable row level security;
alter table job_runs enable row level security;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'stores', 'therapists', 'shifts', 'sales_import_batches',
    'sales_import_rows', 'sales_records', 'post_variants', 'posts',
    'post_therapists', 'tracking_clicks', 'post_metrics', 'job_runs'
  ]
  loop
    execute format('drop policy if exists authenticated_read on %I', table_name);
    execute format(
      'create policy authenticated_read on %I for select to authenticated using (true)',
      table_name
    );
  end loop;
end;
$$;
