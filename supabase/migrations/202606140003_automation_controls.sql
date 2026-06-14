alter table stores
  add column if not exists auto_scrape_enabled boolean not null default true,
  add column if not exists auto_post_enabled boolean not null default false;

update stores
set
  schedule_url = 'https://esthe-spa-lounge.com/schedule/',
  auto_scrape_enabled = true,
  auto_post_enabled = false,
  scraper_config = '{
    "dateTabSelector": ".tl-tabs__panel",
    "dateIdPattern": "tlsp-YYYY-MM-DD",
    "cardSelector": ".tl-schedule-card",
    "nameSelector": ".tl-schedule-card__name",
    "timeSelector": ".tl-schedule-card__time",
    "imageSelector": "img",
    "profileLinkSelector": ".tl-schedule-card__name a",
    "fallbackActiveTabSelector": ".is-active",
    "timezone": "Asia/Tokyo"
  }'::jsonb,
  posting_config = posting_config || '{
    "imageAllowedDomains": ["esthe-spa-lounge.com"],
    "accountHealthStatus": "unknown",
    "blockWhenAccountRestricted": true,
    "lastHealthCheckAt": null
  }'::jsonb
where code = 'oimachi';

update app_settings
set config = config || jsonb_build_object(
  'schedulerMode', 'vercel_daily',
  'appBaseUrl', coalesce(config->>'appBaseUrl', 'http://localhost:3100')
)
where id = 'default';
