import { getEnv } from "@/lib/config/env";
import type {
  Store,
  StoreCode,
  StoreScraperConfig,
  SystemSettings,
} from "@/lib/types";

// 未知の店舗コードでも動作させるための汎用スクレイパ既定。
// 多くの店舗が利用する tl-schedule-card テーマを基準にする。
// 個別の差異は店舗設定画面(scraper_config)で上書きできる。
const genericScraperDefault: StoreScraperConfig = {
  dateTabSelector: ".tl-tabs__panel",
  dateIdPattern: "tlsp-YYYY-MM-DD",
  cardSelector: ".tl-schedule-card",
  nameSelector: ".tl-schedule-card__name",
  timeSelector: ".tl-schedule-card__time",
  imageSelector: "img",
  profileLinkSelector: ".tl-schedule-card__name a",
  fallbackActiveTabSelector: ".is-active",
  timezone: "Asia/Tokyo",
};

// 既知店舗の上書き(汎用既定から差分のみ)。新店舗はここに追記しなくても汎用既定で動く。
const scraperOverrides: Record<string, Partial<StoreScraperConfig>> = {
  // ザ・リッツ蒲田・スパラウンジ大井町は汎用既定(tl-schedule-card)のまま。
  kamata: {},
  oimachi: {},
  sugamo: {
    dateTabSelector: "[id^='tlsp-']",
    nameSelector: ".therapist-name",
    timeSelector: ".schedule-time",
    profileLinkSelector: "a",
  },
};

export function createDefaultSystemSettings(): SystemSettings {
  const env = getEnv();
  return {
    id: "default",
    measurementMode: "operations_only",
    schedulerMode: "vercel_daily",
    appBaseUrl: env.NEXT_PUBLIC_APP_URL,
    postingEnabled: true,
    dailyPostLimit: 3,
    monthlyXBudgetYen: 5_000,
    estimatedXCostPerPostYen: 15,
    useGemini: env.USE_GEMINI,
    geminiModel: env.GEMINI_MODEL,
    xMockMode: env.X_MOCK_MODE,
    xApiBaseUrl: "https://api.x.com",
    xUploadBaseUrl: "https://upload.twitter.com",
    botFilterEnabled: true,
    botUserAgentPatterns: [
      "bot",
      "crawler",
      "spider",
      "preview",
      "Twitterbot",
      "facebookexternalhit",
      "Slackbot",
      "Discordbot",
      "Googlebot",
      "bingbot",
    ],
    reachMonitoringEnabled: true,
    minimumImpressionsAfter24h: 50,
    grossProfitIsEstimate: true,
    defaultTherapistPaymentRate: 0.56,
    updated_at: new Date().toISOString(),
  };
}

export function normalizeScraperConfig(
  code: StoreCode,
  config: Partial<StoreScraperConfig> | null | undefined,
): StoreScraperConfig {
  return {
    ...genericScraperDefault,
    ...(scraperOverrides[code] ?? {}),
    ...config,
  };
}

export function normalizePostingConfig(
  config: Partial<Store["posting_config"]> | null | undefined,
): Store["posting_config"] {
  return {
    postTime: config?.postTime ?? "12:00",
    includeUrlRate: config?.includeUrlRate ?? 0.5,
    maxTherapists: config?.maxTherapists ?? 4,
    approvalRequired: config?.approvalRequired ?? false,
    hashtags: config?.hashtags ?? [],
    imageAllowedDomains: config?.imageAllowedDomains ?? [],
    accountHealthStatus: config?.accountHealthStatus ?? "unknown",
    blockWhenAccountRestricted: config?.blockWhenAccountRestricted ?? true,
    lastHealthCheckAt: config?.lastHealthCheckAt ?? null,
  };
}
