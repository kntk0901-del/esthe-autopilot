import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/config/env";
import {
  getAppData,
  getStoreByCode,
  ensureTherapistCandidate,
  saveJob,
  replaceDailyShifts,
} from "@/lib/db/repository";
import { AppError } from "@/lib/errors/app-error";
import { fetchScheduleHtml, parseScheduleHtml } from "@/lib/scraper/base";
import { createMockScheduleHtml } from "@/lib/scraper/mock";
import type { JobRun, StoreCode } from "@/lib/types";

export async function syncSchedule(input: {
  storeCode: StoreCode;
  date: string;
  forceLive?: boolean;
}): Promise<JobRun> {
  const startedAt = new Date().toISOString();
  const store = await getStoreByCode(input.storeCode);
  const data = await getAppData();
  if (!store) throw new Error("店舗が見つかりません");
  const job: JobRun = {
    id: randomUUID(),
    job_type: "schedule_sync",
    store_id: store.id,
    target_date: input.date,
    status: "running",
    started_at: startedAt,
    finished_at: null,
    processed_count: 0,
    success_count: 0,
    error_count: 0,
    error_message: null,
    metadata: {},
  };
  try {
    let html: string;
    const useMock = getEnv().DATA_MODE === "mock" && !input.forceLive;
    if (useMock) {
      html = createMockScheduleHtml(store, input.date, data.therapists);
    } else {
      if (!store.schedule_url) {
        throw new AppError(
          "SCHEDULE_FETCH_FAILED",
          `${store.display_name}: スケジュールURLが未設定です`,
        );
      }
      html = await fetchScheduleHtml(store.schedule_url);
    }
    const result = parseScheduleHtml({
      html,
      store,
      date: input.date,
      therapists: data.therapists,
      source: useMock ? "mock-sync" : "website",
    });
    for (const shift of result.shifts.filter((item) => !item.therapist_id)) {
      const candidate = await ensureTherapistCandidate({
        canonicalName: shift.therapist_raw,
        storeId: store.id,
        profileUrl: result.profileUrls[shift.source_key] ?? null,
        profileImageUrl: result.images[shift.source_key] ?? null,
      });
      shift.therapist_id = candidate.id;
      // 掲載同意は契約時に取得済みの運用のため、新規名でも同意確認では止めない。
      // マスタへ自動登録し、残る実データ異常(時刻解析不能等)がある場合のみ要確認とする。
      shift.anomalies = shift.anomalies.filter(
        (item) => item !== "THERAPIST_NOT_MATCHED",
      );
      shift.review_required = shift.anomalies.length > 0;
      shift.confidence = Math.max(
        shift.confidence,
        shift.review_required ? 70 : 90,
      );
    }
    await replaceDailyShifts(store.id, input.date, result.shifts);
    Object.assign(job, {
      status: result.shifts.some((shift) => shift.review_required)
        ? "partial"
        : "success",
      finished_at: new Date().toISOString(),
      processed_count: result.shifts.length,
      success_count: result.shifts.filter((shift) => !shift.review_required)
        .length,
      error_count: result.shifts.filter((shift) => shift.review_required).length,
      metadata: {
        images: result.images,
        profileUrls: result.profileUrls,
      },
    } satisfies Partial<JobRun>);
  } catch (error) {
    Object.assign(job, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error_count: 1,
      error_message: error instanceof Error ? error.message : String(error),
    } satisfies Partial<JobRun>);
  }
  await saveJob(job);
  return job;
}
