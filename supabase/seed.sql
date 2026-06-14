insert into stores (
  code, canonical_name, display_name, schedule_url, booking_url,
  x_account_name, monthly_target, room_capacity, auto_scrape_enabled,
  auto_post_enabled, scraper_config, posting_config
) values
(
  'kamata', '蒲田', 'ザ・リッツ蒲田',
  'https://the-ritz-kamata.com/schedule/', 'https://example.com/kamata/reserve',
  '@ritz_kamata_demo', 2600000, 2, true, false,
  '{"dateTabSelector":"[id^=''tlsp-'']","dateIdPattern":"tlsp-YYYY-MM-DD","cardSelector":".tl-schedule-card","nameSelector":".therapist-name","timeSelector":".schedule-time","imageSelector":"img","profileLinkSelector":"a","fallbackActiveTabSelector":".is-active","timezone":"Asia/Tokyo"}',
  '{"postTime":"10:00","includeUrlRate":0.5,"maxTherapists":4,"approvalRequired":false,"hashtags":["蒲田","メンズエステ"],"imageAllowedDomains":["the-ritz-kamata.com"]}'
),
(
  'oimachi', '大井町', 'スパラウンジ大井町',
  'https://esthe-spa-lounge.com/schedule/', 'https://example.com/oimachi/reserve',
  '@spa_oimachi_demo', 2800000, 2, true, false,
  '{"dateTabSelector":".tl-tabs__panel","dateIdPattern":"tlsp-YYYY-MM-DD","cardSelector":".tl-schedule-card","nameSelector":".tl-schedule-card__name","timeSelector":".tl-schedule-card__time","imageSelector":"img","profileLinkSelector":".tl-schedule-card__name a","fallbackActiveTabSelector":".is-active","timezone":"Asia/Tokyo"}',
  '{"postTime":"10:15","includeUrlRate":0.5,"maxTherapists":4,"approvalRequired":true,"hashtags":["大井町","メンズエステ"],"imageAllowedDomains":["esthe-spa-lounge.com"]}'
),
(
  'sugamo', '巣鴨', '巣鴨店',
  null, 'https://example.com/sugamo/reserve',
  '@sugamo_demo', 1600000, 2, false, false, '{}',
  '{"postTime":"10:30","includeUrlRate":0.5,"maxTherapists":4,"approvalRequired":false,"hashtags":["巣鴨","メンズエステ"],"imageAllowedDomains":[]}'
)
on conflict (code) do update set
  canonical_name = excluded.canonical_name,
  display_name = excluded.display_name,
  schedule_url = excluded.schedule_url,
  monthly_target = excluded.monthly_target,
  auto_scrape_enabled = excluded.auto_scrape_enabled,
  auto_post_enabled = excluded.auto_post_enabled,
  scraper_config = excluded.scraper_config,
  posting_config = excluded.posting_config;

insert into post_variants (code, name, description, prompt_template, fixed_template)
values
('schedule_info', '出勤情報型', '事実を簡潔に伝える', '事実を簡潔に伝える。全員の名前と時間を保持する。', '【本日の出勤情報】\n\n{store_display_name}\n\n{therapist_lines}\n\n本日もご予約をお待ちしております。\n{cta_line}\n{hashtags}'),
('therapist_focus', 'セラピスト訴求型', '本日の出勤メンバー紹介に重点', '未提供の性格や施術特徴を生成せず、メンバー紹介に重点を置く。', '【本日の出勤情報】\n\n{store_display_name}\n\n{therapist_lines}\n\n本日もご予約をお待ちしております。\n{cta_line}\n{hashtags}'),
('reservation_push', '予約促進型', '詳細確認への行動を促す', '空き枠を断定せず、詳細確認先を案内する。', '【本日の出勤情報】\n\n{store_display_name}\n\n{therapist_lines}\n\n本日もご予約をお待ちしております。\n{cta_line}\n{hashtags}'),
('brand_message', 'ブランド訴求型', '店舗の世界観を伝える', '誇大表現を避け、出勤情報を必ず保持する。', '【本日の出勤情報】\n\n{store_display_name}\n\n{therapist_lines}\n\n本日もご予約をお待ちしております。\n{cta_line}\n{hashtags}')
on conflict (code) do update set name = excluded.name, description = excluded.description;

with names(name, position) as (
  values
  ('あんず', 1), ('ちなつ', 2), ('えみり', 3), ('えりか', 4), ('かすみ', 5),
  ('かずは', 6), ('くみ', 7), ('くれは', 8), ('しおん', 9), ('しずか', 10),
  ('しのぶ', 11), ('すみれ', 12), ('ちあき', 13), ('ちひろ', 14), ('てるみ', 15),
  ('ののは', 16), ('ひより', 17), ('ほのか', 18), ('ますみ', 19), ('まな', 20),
  ('みこ', 21), ('やすの', 22), ('ゆい', 23), ('ゆかり', 24), ('わか', 25)
)
insert into therapists (
  canonical_name, display_name, primary_store_id, publication_consent,
  priority_flag, newcomer_flag
)
select
  name,
  name,
  (
    select id from stores
    where code = case position % 3 when 1 then 'kamata' when 2 then 'oimachi' else 'sugamo' end
  ),
  true,
  position in (4, 14),
  position in (9, 18)
from names
on conflict (canonical_name, primary_store_id) do nothing;

insert into shifts (
  store_id, therapist_id, therapist_raw, shift_date, start_time, end_time,
  source, source_key, confidence, raw_payload
)
select
  t.primary_store_id,
  t.id,
  t.display_name,
  current_date,
  (time '11:00' + ((row_number() over (partition by t.primary_store_id order by t.display_name) - 1) * interval '2 hours'))::time,
  (time '19:00' + ((row_number() over (partition by t.primary_store_id order by t.display_name) - 1) * interval '2 hours'))::time,
  'website',
  (select code from stores where id = t.primary_store_id) || ':' ||
    current_date || ':' || t.display_name || ':' ||
    to_char(
      (time '11:00' + ((row_number() over (partition by t.primary_store_id order by t.display_name) - 1) * interval '2 hours'))::time,
      'HH24:MI'
    ),
  100,
  '{"demo":true}'
from therapists t
where t.publication_consent
and (select count(*) from therapists t2 where t2.primary_store_id = t.primary_store_id and t2.display_name <= t.display_name) <= 4
on conflict (source, source_key) do nothing;

insert into sales_import_batches (
  file_name, file_hash, source_sheet, period_from, period_to, status,
  total_rows, accepted_rows, confirmed_at
) values (
  'seed-demo-sales.csv', 'seed-demo-sales-v1', 'demo',
  current_date - 27, current_date, 'confirmed', 252, 252, now()
) on conflict (file_hash) do nothing;

insert into sales_records (
  batch_id, record_type, sales_date, store_id, therapist_id, therapist_raw,
  course_minutes, sales_amount, therapist_payment, gross_profit,
  customer_type, nomination, source, status, source_key
)
select
  (select id from sales_import_batches where file_hash = 'seed-demo-sales-v1'),
  'reservation',
  day::date,
  t.primary_store_id,
  t.id,
  t.display_name,
  90 + ((extract(day from day)::int + seq) % 3) * 30,
  12000 + ((extract(day from day)::int + seq) % 3) * 4000,
  round((12000 + ((extract(day from day)::int + seq) % 3) * 4000) * 0.56),
  round((12000 + ((extract(day from day)::int + seq) % 3) * 4000) * 0.44),
  case when seq % 3 = 0 then '新規' else '再来' end,
  case when seq % 2 = 0 then 'Y' else 'N' end,
  case when extract(day from day)::int % 4 = 0 then 'X' else 'seed' end,
  '来店済',
  'seed:' || day::date || ':' || t.id || ':' || seq
from generate_series(current_date - 27, current_date, interval '1 day') day
cross join lateral (values (0), (1)) bookings(seq)
cross join therapists t
where (abs(hashtext(t.id::text || day::text)) % 3) = seq
and t.publication_consent
on conflict (source_key) do nothing;
