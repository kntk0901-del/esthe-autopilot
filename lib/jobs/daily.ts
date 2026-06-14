import { randomUUID } from "node:crypto";
import { getAppData, saveJob, savePost } from "@/lib/db/repository";
import { getJstDateString } from "@/lib/dates/jst";
import { syncSchedule } from "@/lib/jobs/schedule-sync";
import { planPost } from "@/lib/posting/planner";
import { publishPostById } from "@/lib/posting/publisher";
import type { JobRun, StoreCode } from "@/lib/types";

export async function runStoreDailyJob(
  storeCode: StoreCode,
  date = getJstDateString(),
): Promise<JobRun> {
  const data = await getAppData();
  const store = data.stores.find((item) => item.code === storeCode);
  if (!store || !store.enabled) throw new Error("有効な店舗が見つかりません");
  const job: JobRun = {
    id: randomUUID(),
    job_type: "daily_store",
    store_id: store.id,
    target_date: date,
    status: "running",
    started_at: new Date().toISOString(),
    finished_at: null,
    processed_count: 0,
    success_count: 0,
    error_count: 0,
    error_message: null,
    metadata: { steps: [] },
  };
  const steps: Array<Record<string, unknown>> = [];
  if (!store.auto_scrape_enabled && !store.auto_post_enabled) {
    job.status = "skipped";
    job.finished_at = new Date().toISOString();
    job.metadata = { steps: [{ action: "automation", status: "disabled" }] };
    await saveJob(job);
    return job;
  }
  try {
    if (store.auto_scrape_enabled) {
      const sync = await syncSchedule({ storeCode, date });
      job.processed_count += 1;
      steps.push({ action: "sync", status: sync.status });
      if (sync.status !== "success") {
        throw new Error(
          sync.error_message ??
            "取得データに未一致または不正な出勤情報があるため自動投稿を停止しました",
        );
      }
    } else {
      steps.push({ action: "sync", status: "skipped", reason: "auto_scrape_off" });
    }

    const refreshed = await getAppData();
    const refreshedStore = refreshed.stores.find((item) => item.id === store.id) ?? store;
    const post = await planPost({ data: refreshed, store: refreshedStore, date });
    await savePost(post);
    job.processed_count += 1;
    job.success_count += 1;
    steps.push({ action: "generate", status: "success", postId: post.id });

    if (!store.auto_post_enabled) {
      steps.push({ action: "publish", status: "skipped", reason: "auto_post_off" });
    } else if (!refreshed.systemSettings.postingEnabled) {
      steps.push({
        action: "publish",
        status: "skipped",
        reason: "global_posting_disabled",
      });
    } else if (post.status === "posted") {
      steps.push({ action: "publish", status: "skipped", reason: "already_posted" });
    } else if (post.approval_status === "pending") {
      steps.push({ action: "publish", status: "skipped", reason: "approval_pending" });
    } else {
      await publishPostById(post.id);
      job.processed_count += 1;
      job.success_count += 1;
      steps.push({ action: "publish", status: "success" });
    }
    job.status = "success";
  } catch (error) {
    job.status = job.success_count > 0 ? "partial" : "failed";
    job.error_count += 1;
    job.error_message = error instanceof Error ? error.message : String(error);
  }
  job.finished_at = new Date().toISOString();
  job.metadata = { steps };
  await saveJob(job);
  return job;
}

export async function runDailyJob(date = getJstDateString()): Promise<JobRun> {
  const data = await getAppData();
  const results = await Promise.allSettled(
    data.stores
      .filter(
        (store) =>
          store.enabled &&
          (store.auto_scrape_enabled || store.auto_post_enabled),
      )
      .map((store) => runStoreDailyJob(store.code, date)),
  );
  const jobs = results
    .filter((result): result is PromiseFulfilledResult<JobRun> => result.status === "fulfilled")
    .map((result) => result.value);
  const failures = results.filter((result) => result.status === "rejected");
  const errorCount =
    jobs.reduce((sum, job) => sum + job.error_count, 0) + failures.length;
  const successCount = jobs.reduce((sum, job) => sum + job.success_count, 0);
  const orchestration: JobRun = {
    id: randomUUID(),
    job_type: "daily_orchestration",
    store_id: null,
    target_date: date,
    status: errorCount === 0 ? "success" : successCount > 0 ? "partial" : "failed",
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    processed_count: results.length,
    success_count: jobs.filter((job) => job.status === "success").length,
    error_count: errorCount,
    error_message:
      failures.length > 0
        ? failures
            .map((result) =>
              result.status === "rejected" ? String(result.reason) : "",
            )
            .join(" / ")
        : jobs
            .map((job) => job.error_message)
            .filter(Boolean)
            .join(" / ") || null,
    metadata: { childJobIds: jobs.map((job) => job.id), fanOut: true },
  };
  await saveJob(orchestration);
  return orchestration;
}
