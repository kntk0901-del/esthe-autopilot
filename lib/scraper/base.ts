import { load } from "cheerio";
import { randomUUID } from "node:crypto";
import { AppError } from "@/lib/errors/app-error";
import type {
  Shift,
  Store,
  StoreScraperConfig,
  Therapist,
} from "@/lib/types";

export interface ScrapedSchedule {
  shifts: Shift[];
  images: Record<string, string | null>;
  profileUrls: Record<string, string | null>;
}

const defaultConfig: StoreScraperConfig = {
  dateTabSelector: "[id^='tlsp-']",
  dateIdPattern: "tlsp-YYYY-MM-DD",
  cardSelector: ".tl-schedule-card",
  nameSelector: ".therapist-name",
  timeSelector: ".schedule-time",
  imageSelector: "img",
  profileLinkSelector: "a",
  fallbackActiveTabSelector: ".is-active",
  timezone: "Asia/Tokyo",
};

export function normalizeTherapistName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\s　\r\n]+/g, "")
    .replace(/(?:\d{1,2}[/-]\d{1,2})?初出勤[!！]?$/gi, "")
    .replace(/(?:NEW|新人|本日出勤|出勤)$/gi, "")
    .trim();
}

export function parseShiftTime(value: string): {
  start: string | null;
  end: string | null;
} {
  const normalized = value
    .normalize("NFKC")
    .replace(/[〜～―ー]/g, "-")
    .replace(/\s+/g, "");
  const match = normalized.match(
    /(\d{1,2}):(\d{2})-(?:翌)?(\d{1,2}):(\d{2})/,
  );
  if (!match) {
    return { start: null, end: null };
  }
  const [, startHour, startMinute, endHour, endMinute] = match;
  const valid = [startHour, endHour].every(
    (hour) => Number(hour) >= 0 && Number(hour) <= 29,
  );
  if (!valid || Number(startMinute) > 59 || Number(endMinute) > 59) {
    return { start: null, end: null };
  }
  return {
    start: `${startHour.padStart(2, "0")}:${startMinute}`,
    end: `${endHour.padStart(2, "0")}:${endMinute}`,
  };
}

function resolveTherapist(
  rawName: string,
  store: Store,
  therapists: Therapist[],
): Therapist | null {
  const normalized = normalizeTherapistName(rawName);
  return (
    therapists.find(
      (therapist) =>
        therapist.primary_store_id === store.id &&
        (normalizeTherapistName(therapist.canonical_name) === normalized ||
          therapist.aliases.some(
            (alias) => normalizeTherapistName(alias) === normalized,
          )),
    ) ?? null
  );
}

function resolvePageUrl(value: string | null, pageUrl: string | null): string | null {
  if (!value || !pageUrl) return value;
  try {
    return new URL(value, pageUrl).toString();
  } catch {
    return value;
  }
}

export function parseScheduleHtml(input: {
  html: string;
  store: Store;
  date: string;
  therapists: Therapist[];
  source?: string;
}): ScrapedSchedule {
  if (input.html.length < 20 || input.html.length > 5_000_000) {
    throw new AppError("SCHEDULE_PARSE_FAILED", "HTMLサイズが不正です");
  }
  const config = { ...defaultConfig, ...input.store.scraper_config };
  const $ = load(input.html);
  const expectedId = config.dateIdPattern.replace("YYYY-MM-DD", input.date);
  let scope = $(`#${expectedId}`);
  if (scope.length === 0) {
    const tabs = $(config.dateTabSelector);
    scope = tabs.filter(config.fallbackActiveTabSelector).first();
  }
  if (scope.length === 0) {
    throw new AppError("TODAY_TAB_NOT_FOUND");
  }

  const records: Shift[] = [];
  const images: Record<string, string | null> = {};
  const profileUrls: Record<string, string | null> = {};
  scope.find(config.cardSelector).each((index, element) => {
    const card = $(element);
    const rawName = card.find(config.nameSelector).first().text().trim();
    if (!rawName) {
      return;
    }
    const timeText = card.find(config.timeSelector).first().text();
    const time = parseShiftTime(timeText);
    const therapist = resolveTherapist(rawName, input.store, input.therapists);
    const normalizedName = normalizeTherapistName(rawName);
    const anomalies: string[] = [];
    const missingFields: string[] = [];
    if (!time.start || !time.end) {
      anomalies.push("INVALID_SHIFT_TIME");
      missingFields.push("start_time", "end_time");
    }
    if (!therapist) {
      anomalies.push("THERAPIST_NOT_MATCHED");
    }
    const imageUrl = resolvePageUrl(
      card.find(config.imageSelector).first().attr("src") ??
      card.find(config.imageSelector).first().attr("data-src") ??
      null,
      input.store.schedule_url,
    );
    const profileUrl = resolvePageUrl(
      card.find(config.profileLinkSelector).first().attr("href") ?? null,
      input.store.schedule_url,
    );
    const sourceKey = `${input.store.code}:${input.date}:${normalizedName}:${time.start ?? "unknown"}`;
    records.push({
      id: randomUUID(),
      store_id: input.store.id,
      therapist_id: therapist?.id ?? null,
      therapist_raw: normalizedName,
      shift_date: input.date,
      start_time: time.start,
      end_time: time.end,
      source: input.source ?? "website",
      source_url: input.store.schedule_url,
      source_key: sourceKey,
      confidence: therapist && time.start && time.end ? 100 : therapist ? 70 : 45,
      review_required: !therapist || !time.start || !time.end,
      inferred_fields: [],
      missing_fields: missingFields,
      anomalies,
      raw_payload: { html: $.html(element), index },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    images[sourceKey] = imageUrl;
    profileUrls[sourceKey] = profileUrl;
  });

  if (records.length === 0) {
    throw new AppError("SCHEDULE_PARSE_FAILED", "出勤者が0名でした");
  }
  if (records.length > 20) {
    throw new AppError(
      "SCHEDULE_PARSE_FAILED",
      "取得件数が通常範囲を超えています",
    );
  }
  return { shifts: records, images, profileUrls };
}

export async function fetchScheduleHtml(url: string): Promise<string> {
  const parsed = new URL(url);
  if (!["https:", "http:"].includes(parsed.protocol)) {
    throw new AppError("SCHEDULE_FETCH_FAILED", "URLの形式が不正です");
  }
  const response = await fetch(url, {
    headers: { "user-agent": "EstheGrowthAutopilot/0.1 (+schedule sync)" },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("text/html")) {
    throw new AppError(
      "SCHEDULE_FETCH_FAILED",
      `HTTP ${response.status}: HTMLを取得できませんでした`,
    );
  }
  return response.text();
}
