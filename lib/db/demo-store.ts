import { addDays, format, subDays } from "date-fns";
import { getEnv } from "@/lib/config/env";
import { getJstDateString, jstDateTimeToUtc } from "@/lib/dates/jst";
import type {
  AppData,
  ImportBatch,
  JobRun,
  PostMetric,
  PostVariant,
  SalesRecord,
  Shift,
  SocialPost,
  Store,
  Therapist,
  TrackingClick,
  VariantCode,
} from "@/lib/types";
import {
  createDefaultSystemSettings,
  normalizePostingConfig,
  normalizeScraperConfig,
} from "@/lib/settings/defaults";

const now = new Date();
const today = getJstDateString(now);
const isoNow = now.toISOString();

const stores: Store[] = [
  {
    id: "store-kamata",
    code: "kamata",
    canonical_name: "蒲田",
    display_name: "ザ・リッツ蒲田",
    schedule_url: "https://the-ritz-kamata.com/schedule/",
    booking_url: "https://example.com/kamata/reserve",
    x_account_name: "@ritz_kamata_demo",
    monthly_target: 2_600_000,
    room_capacity: 2,
    enabled: true,
    auto_scrape_enabled: true,
    auto_post_enabled: true,
    scraper_config: {
      dateTabSelector: "[id^='tlsp-']",
      dateIdPattern: "tlsp-YYYY-MM-DD",
      cardSelector: ".tl-schedule-card",
      nameSelector: ".therapist-name",
      timeSelector: ".schedule-time",
      imageSelector: "img",
      profileLinkSelector: "a",
      fallbackActiveTabSelector: ".is-active",
      timezone: "Asia/Tokyo",
    },
    posting_config: {
      postTime: "10:00",
      includeUrlRate: 0.5,
      maxTherapists: 4,
      approvalRequired: false,
      hashtags: ["蒲田", "メンズエステ"],
      imageAllowedDomains: ["the-ritz-kamata.com", "images.unsplash.com"],
      accountHealthStatus: "unknown",
      blockWhenAccountRestricted: true,
      lastHealthCheckAt: null,
    },
    created_at: isoNow,
    updated_at: isoNow,
  },
  {
    id: "store-oimachi",
    code: "oimachi",
    canonical_name: "大井町",
    display_name: "スパラウンジ大井町",
    schedule_url: "https://esthe-spa-lounge.com/schedule/",
    booking_url: "https://example.com/oimachi/reserve",
    x_account_name: "@spa_oimachi_demo",
    monthly_target: 2_800_000,
    room_capacity: 2,
    enabled: true,
    auto_scrape_enabled: true,
    auto_post_enabled: false,
    scraper_config: {
      dateTabSelector: ".tl-tabs__panel",
      dateIdPattern: "tlsp-YYYY-MM-DD",
      cardSelector: ".tl-schedule-card",
      nameSelector: ".tl-schedule-card__name",
      timeSelector: ".tl-schedule-card__time",
      imageSelector: "img",
      profileLinkSelector: ".tl-schedule-card__name a",
      fallbackActiveTabSelector: ".is-active",
      timezone: "Asia/Tokyo",
    },
    posting_config: {
      postTime: "10:15",
      includeUrlRate: 0.5,
      maxTherapists: 4,
      approvalRequired: true,
      hashtags: ["大井町", "メンズエステ"],
      imageAllowedDomains: ["esthe-spa-lounge.com", "images.unsplash.com"],
      accountHealthStatus: "unknown",
      blockWhenAccountRestricted: true,
      lastHealthCheckAt: null,
    },
    created_at: isoNow,
    updated_at: isoNow,
  },
  {
    id: "store-sugamo",
    code: "sugamo",
    canonical_name: "巣鴨",
    display_name: "巣鴨店",
    schedule_url: null,
    booking_url: "https://example.com/sugamo/reserve",
    x_account_name: "@sugamo_demo",
    monthly_target: 1_600_000,
    room_capacity: 2,
    enabled: true,
    auto_scrape_enabled: false,
    auto_post_enabled: false,
    scraper_config: normalizeScraperConfig("sugamo", {}),
    posting_config: {
      postTime: "10:30",
      includeUrlRate: 0.5,
      maxTherapists: 4,
      approvalRequired: false,
      hashtags: ["巣鴨", "メンズエステ"],
      imageAllowedDomains: ["images.unsplash.com"],
      accountHealthStatus: "unknown",
      blockWhenAccountRestricted: true,
      lastHealthCheckAt: null,
    },
    created_at: isoNow,
    updated_at: isoNow,
  },
];

const therapistNames = [
  "あんず",
  "ちなつ",
  "えみり",
  "えりか",
  "かすみ",
  "かずは",
  "くみ",
  "くれは",
  "しおん",
  "しずか",
  "しのぶ",
  "すみれ",
  "ちあき",
  "ちひろ",
  "てるみ",
  "ののは",
  "ひより",
  "ほのか",
  "ますみ",
  "まな",
  "みこ",
  "やすの",
  "ゆい",
  "ゆかり",
  "わか",
];

const therapists: Therapist[] = therapistNames.map((name, index) => {
  const store = stores[index % stores.length];
  return {
    id: `therapist-${index + 1}`,
    canonical_name: name,
    display_name: name,
    primary_store_id: store.id,
    aliases: index % 7 === 0 ? [`${name}さん`] : [],
    profile_url: `https://example.com/${store.code}/therapists/${index + 1}`,
    profile_image_url:
      index < 12
        ? `https://images.unsplash.com/photo-1544005313-94ddf0286df2?fit=crop&w=640&h=640&sig=${index}`
        : null,
    publication_consent: true,
    active: true,
    priority_flag: index === 3 || index === 13,
    newcomer_flag: index === 8 || index === 17,
    created_at: isoNow,
    updated_at: isoNow,
  };
});

const shifts: Shift[] = [];
for (let dayOffset = -14; dayOffset <= 2; dayOffset += 1) {
  const date = format(addDays(new Date(`${today}T00:00:00`), dayOffset), "yyyy-MM-dd");
  stores.forEach((store, storeIndex) => {
    const candidates = therapists.filter(
      (therapist) => therapist.primary_store_id === store.id,
    );
    candidates.slice(dayOffset % 2 === 0 ? 0 : 1, 4).forEach((therapist, index) => {
      const startHour = 11 + index * 2 + storeIndex;
      const endHour = startHour + 8;
      const startTime = `${String(startHour).padStart(2, "0")}:00`;
      shifts.push({
        id: `shift-${date}-${store.code}-${therapist.id}`,
        store_id: store.id,
        therapist_id: therapist.id,
        therapist_raw: therapist.display_name,
        shift_date: date,
        start_time: startTime,
        end_time: `${String(endHour % 24).padStart(2, "0")}:00`,
        source: dayOffset === 0 ? "mock-sync" : "demo-seed",
        source_url: store.schedule_url,
        source_key:
          dayOffset === 0
            ? `${store.code}:${date}:${therapist.display_name}:${startTime}`
            : `${store.code}:${date}:${therapist.id}`,
        confidence: 100,
        review_required: false,
        inferred_fields: [],
        missing_fields: [],
        anomalies: [],
        raw_payload: { demo: true },
        created_at: isoNow,
        updated_at: isoNow,
      });
    });
  });
}

const salesRecords: SalesRecord[] = [];
for (let dayOffset = -27; dayOffset <= 0; dayOffset += 1) {
  const salesDate = format(
    addDays(new Date(`${today}T00:00:00`), dayOffset),
    "yyyy-MM-dd",
  );
  stores.forEach((store, storeIndex) => {
    const dailyTherapists = therapists
      .filter((therapist) => therapist.primary_store_id === store.id)
      .slice(0, 3);
    dailyTherapists.forEach((therapist, therapistIndex) => {
      const count = 1 + ((dayOffset + therapistIndex + 30) % 3);
      for (let booking = 0; booking < count; booking += 1) {
        const courseMinutes = [90, 120, 150][
          (booking + therapistIndex) % 3
        ];
        const base =
          courseMinutes === 90 ? 12_000 : courseMinutes === 120 ? 16_000 : 20_000;
        const sales = base - ((dayOffset + storeIndex) % 4 === 0 ? 1_000 : 0);
        salesRecords.push({
          id: `sale-${salesDate}-${store.code}-${therapist.id}-${booking}`,
          batch_id: "batch-demo-confirmed",
          raw_id: null,
          record_type: "reservation",
          sales_date: salesDate,
          store_id: store.id,
          therapist_id: therapist.id,
          therapist_raw: therapist.display_name,
          start_time: `${12 + booking * 3}:00`,
          course_minutes: courseMinutes,
          sales_amount: sales,
          therapist_payment: Math.round(sales * 0.56),
          gross_profit: Math.round(sales * 0.44),
          discount: sales < base ? base - sales : 0,
          customer_type: booking % 3 === 0 ? "新規" : "再来",
          nomination: booking % 2 === 0 ? "Y" : "N",
          source: booking === 0 && dayOffset % 4 === 0 ? "X" : "demo",
          status: "来店済",
          confidence: 100,
          review_required: false,
          inferred_fields: [],
          missing_fields: [],
          anomalies: [],
          raw_payload: { demo: true },
          source_key: `demo:${salesDate}:${store.code}:${therapist.id}:${booking}`,
          created_at: isoNow,
          updated_at: isoNow,
        });
      }
    });
  });
}

const variantSeed: Array<[VariantCode, string, string]> = [
  ["schedule_info", "出勤情報型", "事実を簡潔に伝える基本パターン"],
  ["therapist_focus", "セラピスト訴求型", "本日のメンバー紹介に重点"],
  ["reservation_push", "予約促進型", "詳細確認への行動を促す"],
  ["brand_message", "ブランド訴求型", "店舗の世界観と出勤情報を両立"],
];

const variants: PostVariant[] = variantSeed.map(([code, name, description]) => ({
  id: `variant-${code}`,
  code,
  name,
  description,
  prompt_template: `${code}の方針に従い、入力された事実だけで投稿文を生成する。`,
  fixed_template:
    "【本日の出勤情報】\\n\\n{store_display_name}\\n\\n{therapist_lines}\\n\\n本日もご予約をお待ちしております。\\n{cta_line}\\n{hashtags}",
  active: true,
  created_at: isoNow,
  updated_at: isoNow,
}));

const posts: SocialPost[] = [];
for (let dayOffset = -9; dayOffset <= 0; dayOffset += 1) {
  const postDate = format(
    addDays(new Date(`${today}T00:00:00`), dayOffset),
    "yyyy-MM-dd",
  );
  stores.forEach((store, storeIndex) => {
    const variant = variants[(dayOffset + 12 + storeIndex) % variants.length];
    const dayShifts = shifts
      .filter((shift) => shift.store_id === store.id && shift.shift_date === postDate)
      .slice(0, 3);
    const therapistLines = dayShifts
      .map(
        (shift) =>
          `・${shift.therapist_raw} ${shift.start_time}〜${shift.end_time}`,
      )
      .join("\n");
    const isToday = dayOffset === 0;
    const failed = dayOffset === -2 && store.code === "oimachi";
    const status = isToday ? "scheduled" : failed ? "failed" : "posted";
    const id = `post-${postDate}-${store.code}`;
    posts.push({
      id,
      store_id: store.id,
      post_date: postDate,
      post_type: "daily_schedule",
      variant_id: variant.id,
      status,
      approval_status:
        isToday && store.posting_config.approvalRequired ? "pending" : "auto",
      scheduled_at: jstDateTimeToUtc(postDate, store.posting_config.postTime),
      posted_at:
        status === "posted"
          ? jstDateTimeToUtc(postDate, store.posting_config.postTime)
          : null,
      text_content: `【本日の出勤情報】\n\n${store.display_name}\n\n${therapistLines}\n\n本日もご予約をお待ちしております。\n詳細はプロフィールからご確認ください。\n#${store.canonical_name}`,
      fallback_text: `【本日の出勤情報】\n\n${store.display_name}\n\n${therapistLines}`,
      used_ai: dayOffset % 2 === 0,
      ai_model: dayOffset % 2 === 0 ? "gemini-2.5-flash" : null,
      ai_prompt: dayOffset % 2 === 0 ? "demo prompt" : null,
      ai_raw_response: dayOffset % 2 === 0 ? "demo response" : null,
      include_url: (dayOffset + storeIndex) % 2 === 0,
      tracking_url: `${getEnv().NEXT_PUBLIC_APP_URL}/r/x/${id}`,
      image_urls: dayShifts
        .map(
          (shift) =>
            therapists.find((therapist) => therapist.id === shift.therapist_id)
              ?.profile_image_url,
        )
        .filter((url): url is string => Boolean(url))
        .slice(0, 4),
      x_media_ids: [],
      x_post_id: status === "posted" ? `mock-${postDate}-${store.code}` : null,
      x_post_url:
        status === "posted"
          ? `https://x.com/${store.x_account_name?.replace("@", "")}/status/mock-${postDate}-${store.code}`
          : null,
      content_hash: `hash-${postDate}-${store.code}`,
      attempt_count: failed ? 3 : status === "posted" ? 1 : 0,
      last_error_code: failed ? "X_POST_FAILED" : null,
      last_error_message: failed
        ? "X APIが一時的に応答しませんでした（デモ）"
        : null,
      therapist_ids: dayShifts
        .map((shift) => shift.therapist_id)
        .filter((id): id is string => Boolean(id)),
      control_therapist_ids: [],
      measurement_mode: "operations_only",
      created_at: jstDateTimeToUtc(postDate, "09:30"),
      updated_at: isoNow,
    });
  });
}

const clicks: TrackingClick[] = posts
  .filter((post) => post.status === "posted")
  .flatMap((post, postIndex) =>
    Array.from({ length: (postIndex % 7) + 2 }, (_, clickIndex) => ({
      id: `click-${post.id}-${clickIndex}`,
      post_id: post.id,
      clicked_at: subDays(now, postIndex % 8).toISOString(),
      user_agent: "Demo Browser",
      referer: "https://x.com/",
      ip_hash: `demo-hash-${clickIndex}`,
      destination_url:
        stores.find((store) => store.id === post.store_id)?.booking_url ?? "",
      is_bot: false,
      bot_reason: null,
      counted: true,
    })),
  );

const postMetrics: PostMetric[] = posts
  .filter((post) => post.status === "posted")
  .map((post, index) => ({
    id: `metric-${post.id}`,
    post_id: post.id,
    measured_at: isoNow,
    impressions: 320 + index * 41,
    likes: 4 + (index % 11),
    reposts: index % 4,
    replies: index % 3,
    bookmarks: 1 + (index % 5),
    profile_clicks: 7 + (index % 13),
    link_clicks: clicks.filter((click) => click.post_id === post.id).length,
    reservations: index % 4,
    attributed_sales: (index % 4) * 12_000,
    metric_source: "demo",
  }));

const jobs: JobRun[] = [
  {
    id: "job-daily-latest",
    job_type: "daily_orchestration",
    store_id: null,
    target_date: today,
    status: "partial",
    started_at: jstDateTimeToUtc(today, "09:55"),
    finished_at: jstDateTimeToUtc(today, "09:56"),
    processed_count: 12,
    success_count: 11,
    error_count: 1,
    error_message: "大井町: スケジュールURLが未設定です",
    metadata: { mock: true },
  },
  {
    id: "job-import-latest",
    job_type: "sales_import",
    store_id: "store-kamata",
    target_date: today,
    status: "success",
    started_at: subDays(now, 1).toISOString(),
    finished_at: subDays(now, 1).toISOString(),
    processed_count: 84,
    success_count: 84,
    error_count: 0,
    error_message: null,
    metadata: { file: "demo-sales.csv" },
  },
  {
    id: "job-post-failed",
    job_type: "x_publish",
    store_id: "store-oimachi",
    target_date: format(subDays(now, 2), "yyyy-MM-dd"),
    status: "failed",
    started_at: subDays(now, 2).toISOString(),
    finished_at: subDays(now, 2).toISOString(),
    processed_count: 1,
    success_count: 0,
    error_count: 1,
    error_message: "X_POST_FAILED: 3回の再試行後に失敗",
    metadata: { attemptCount: 3 },
  },
];

const imports: ImportBatch[] = [
  {
    id: "batch-demo-confirmed",
    file_name: "2026-06_3stores_sales.xlsx",
    file_hash: "demo-confirmed-hash",
    store_id: null,
    source_sheet: "全店舗",
    period_from: `${today.slice(0, 7)}-01`,
    period_to: today,
    status: "confirmed",
    total_rows: salesRecords.length,
    accepted_rows: salesRecords.length,
    rejected_rows: 0,
    warning_rows: 0,
    uploaded_by: "demo-admin",
    error_message: null,
    created_at: subDays(now, 1).toISOString(),
    confirmed_at: subDays(now, 1).toISOString(),
    rows: [],
  },
];

function createDemoData(): AppData {
  return {
    stores,
    therapists,
    shifts,
    salesRecords,
    variants,
    posts,
    clicks,
    postMetrics,
    jobs,
    imports,
    systemSettings: createDefaultSystemSettings(),
  };
}

declare global {
  var __ESTHE_AUTOPILOT_DEMO__: AppData | undefined;
}

export function getDemoStore(): AppData {
  if (!globalThis.__ESTHE_AUTOPILOT_DEMO__) {
    globalThis.__ESTHE_AUTOPILOT_DEMO__ = createDemoData();
  }
  const data = globalThis.__ESTHE_AUTOPILOT_DEMO__;
  data.systemSettings ??= createDefaultSystemSettings();
  data.stores = data.stores.map((store) => ({
    ...store,
    schedule_url:
      store.code === "oimachi" && !store.schedule_url
        ? "https://esthe-spa-lounge.com/schedule/"
        : store.schedule_url,
    auto_scrape_enabled: store.auto_scrape_enabled ?? true,
    auto_post_enabled:
      store.auto_post_enabled ?? (store.code === "kamata"),
    scraper_config: normalizeScraperConfig(store.code, store.scraper_config),
    posting_config: normalizePostingConfig(store.posting_config),
  }));
  data.posts = data.posts.map((post) => ({
    ...post,
    control_therapist_ids: post.control_therapist_ids ?? [],
    measurement_mode: post.measurement_mode ?? "operations_only",
  }));
  data.clicks = data.clicks.map((click) => ({
    ...click,
    is_bot: click.is_bot ?? false,
    bot_reason: click.bot_reason ?? null,
    counted: click.counted ?? true,
  }));
  return data;
}
