import { randomUUID } from "node:crypto";
import { isSupabaseConfigured } from "@/lib/config/env";
import { getDemoStore } from "@/lib/db/demo-store";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type {
  AppData,
  ImportBatch,
  JobRun,
  SalesRecord,
  Shift,
  SocialPost,
  Store,
  SystemSettings,
  Therapist,
  TrackingClick,
} from "@/lib/types";
import {
  createDefaultSystemSettings,
  normalizePostingConfig,
  normalizeScraperConfig,
} from "@/lib/settings/defaults";

async function getSupabaseData(): Promise<AppData> {
  const client = getSupabaseAdmin();
  const [
    stores,
    therapists,
    shifts,
    salesRecords,
    variants,
    posts,
    postTherapists,
    clicks,
    postMetrics,
    jobs,
    imports,
    appSettings,
  ] = await Promise.all([
    client.from("stores").select("*").order("code"),
    client.from("therapists").select("*").order("display_name"),
    client.from("shifts").select("*").order("shift_date", { ascending: false }),
    client.from("sales_records").select("*").order("sales_date", { ascending: false }),
    client.from("post_variants").select("*").order("created_at"),
    client.from("posts").select("*").order("post_date", { ascending: false }),
    client.from("post_therapists").select("*").order("display_order"),
    client.from("tracking_clicks").select("*").order("clicked_at", { ascending: false }),
    client.from("post_metrics").select("*").order("measured_at", { ascending: false }),
    client.from("job_runs").select("*").order("started_at", { ascending: false }),
    client
      .from("sales_import_batches")
      .select("*, sales_import_rows(*)")
      .order("created_at", { ascending: false }),
    client.from("app_settings").select("*").eq("id", "default").maybeSingle(),
  ]);

  const errors = [
    stores.error,
    therapists.error,
    shifts.error,
    salesRecords.error,
    variants.error,
    posts.error,
    postTherapists.error,
    clicks.error,
    postMetrics.error,
    jobs.error,
    imports.error,
    appSettings.error,
  ].filter(Boolean);
  if (errors.length > 0) {
    throw new Error(errors.map((error) => error?.message).join("; "));
  }

  const links = (postTherapists.data ?? []) as Array<{
    post_id: string;
    therapist_id: string;
  }>;
  const mappedPosts = ((posts.data ?? []) as SocialPost[]).map((post) => ({
    ...post,
    control_therapist_ids: post.control_therapist_ids ?? [],
    measurement_mode: post.measurement_mode ?? "operations_only",
    therapist_ids: links
      .filter((link) => link.post_id === post.id)
      .map((link) => link.therapist_id),
  }));
  const mappedImports = ((imports.data ?? []) as Array<
    Omit<ImportBatch, "rows"> & { sales_import_rows?: ImportBatch["rows"] }
  >).map((batch) => ({
    ...batch,
    rows: batch.sales_import_rows ?? [],
  }));

  return {
    stores: ((stores.data ?? []) as Store[]).map((store) => ({
      ...store,
      auto_scrape_enabled: store.auto_scrape_enabled ?? true,
      auto_post_enabled: store.auto_post_enabled ?? true,
      scraper_config: normalizeScraperConfig(store.code, store.scraper_config),
      posting_config: normalizePostingConfig(store.posting_config),
    })),
    therapists: (therapists.data ?? []) as Therapist[],
    shifts: (shifts.data ?? []) as Shift[],
    salesRecords: (salesRecords.data ?? []) as SalesRecord[],
    variants: (variants.data ?? []) as AppData["variants"],
    posts: mappedPosts,
    clicks: ((clicks.data ?? []) as AppData["clicks"]).map((click) => ({
      ...click,
      is_bot: click.is_bot ?? false,
      bot_reason: click.bot_reason ?? null,
      counted: click.counted ?? true,
    })),
    postMetrics: (postMetrics.data ?? []) as AppData["postMetrics"],
    jobs: (jobs.data ?? []) as JobRun[],
    imports: mappedImports,
    systemSettings: {
      ...createDefaultSystemSettings(),
      ...((appSettings.data?.config as Partial<SystemSettings> | undefined) ?? {}),
      id: "default",
      updated_at:
        appSettings.data?.updated_at ?? createDefaultSystemSettings().updated_at,
    },
  };
}

export async function getAppData(): Promise<AppData> {
  return isSupabaseConfigured() ? getSupabaseData() : getDemoStore();
}

export async function getStoreByCode(code: string): Promise<Store | null> {
  return (await getAppData()).stores.find((store) => store.code === code) ?? null;
}

export async function getTherapistById(id: string): Promise<Therapist | null> {
  return (
    (await getAppData()).therapists.find((therapist) => therapist.id === id) ??
    null
  );
}

export async function getPostById(id: string): Promise<SocialPost | null> {
  return (await getAppData()).posts.find((post) => post.id === id) ?? null;
}

export async function getImportById(id: string): Promise<ImportBatch | null> {
  return (await getAppData()).imports.find((batch) => batch.id === id) ?? null;
}

export async function saveJob(job: JobRun): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseAdmin().from("job_runs").insert(job);
    if (error) throw error;
    return;
  }
  getDemoStore().jobs.unshift(job);
}

export async function saveShifts(records: Shift[]): Promise<void> {
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseAdmin()
      .from("shifts")
      .upsert(records, { onConflict: "source,source_key" });
    if (error) throw error;
    return;
  }
  const store = getDemoStore();
  records.forEach((record) => {
    const index = store.shifts.findIndex(
      (item) =>
        (item.source === record.source &&
          item.source_key === record.source_key) ||
        (item.store_id === record.store_id &&
          item.shift_date === record.shift_date &&
          item.therapist_id === record.therapist_id &&
          item.start_time === record.start_time),
    );
    if (index >= 0) {
      store.shifts[index] = record;
    } else {
      store.shifts.push(record);
    }
  });
}

// スケジュール再取得は「その店舗・その日」の正本を最新の取得結果で置き換える。
// 古い取得分や重複（時刻変更による source_key 違い）を残さないため、対象日の
// 既存shiftをクリアしてから保存する。手動登録(source = "manual")は人手の正本
// なので保持する。
export async function replaceDailyShifts(
  storeId: string,
  date: string,
  records: Shift[],
): Promise<void> {
  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin();
    const { error: deleteError } = await client
      .from("shifts")
      .delete()
      .eq("store_id", storeId)
      .eq("shift_date", date)
      .neq("source", "manual");
    if (deleteError) throw deleteError;
    if (records.length > 0) {
      const { error } = await client.from("shifts").insert(records);
      if (error) throw error;
    }
    return;
  }
  const store = getDemoStore();
  store.shifts = store.shifts.filter(
    (item) =>
      item.source === "manual" ||
      !(item.store_id === storeId && item.shift_date === date),
  );
  store.shifts.push(...records);
}

export async function savePost(post: SocialPost): Promise<void> {
  if (isSupabaseConfigured()) {
    const { therapist_ids: therapistIds, ...record } = post;
    const { error } = await getSupabaseAdmin()
      .from("posts")
      .upsert(record, { onConflict: "store_id,post_date,post_type" });
    if (error) throw error;
    if (therapistIds.length > 0) {
      await getSupabaseAdmin().from("post_therapists").upsert(
        therapistIds.map((therapistId, index) => ({
          post_id: post.id,
          therapist_id: therapistId,
          display_order: index + 1,
          selection_reason: "自動選定",
        })),
      );
    }
    return;
  }
  const store = getDemoStore();
  const index = store.posts.findIndex((item) => item.id === post.id);
  if (index >= 0) {
    store.posts[index] = post;
  } else {
    store.posts.unshift(post);
  }
}

export async function deletePost(id: string): Promise<void> {
  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin();
    // 依存行を先に削除(post_therapistsはcascade、clicks/metricsはFK制約のため明示削除)。
    await client.from("tracking_clicks").delete().eq("post_id", id);
    await client.from("post_metrics").delete().eq("post_id", id);
    const { error } = await client.from("posts").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const store = getDemoStore();
  store.posts = store.posts.filter((item) => item.id !== id);
  store.clicks = store.clicks.filter((item) => item.post_id !== id);
  store.postMetrics = store.postMetrics.filter((item) => item.post_id !== id);
}

export async function saveImportBatch(batch: ImportBatch): Promise<void> {
  if (isSupabaseConfigured()) {
    const { rows, ...batchRecord } = batch;
    const { error } = await getSupabaseAdmin()
      .from("sales_import_batches")
      .upsert(batchRecord);
    if (error) throw error;
    if (rows.length > 0) {
      const { error: rowError } = await getSupabaseAdmin()
        .from("sales_import_rows")
        .upsert(rows);
      if (rowError) throw rowError;
    }
    return;
  }
  const store = getDemoStore();
  const index = store.imports.findIndex((item) => item.id === batch.id);
  if (index >= 0) {
    store.imports[index] = batch;
  } else {
    store.imports.unshift(batch);
  }
}

export async function confirmImport(
  batch: ImportBatch,
  records: SalesRecord[],
): Promise<void> {
  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin();
    const { error } = await client
      .from("sales_records")
      .upsert(records, { onConflict: "source_key" });
    if (error) throw error;
    await client
      .from("sales_import_batches")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("id", batch.id);
    return;
  }
  const store = getDemoStore();
  records.forEach((record) => {
    if (!store.salesRecords.some((item) => item.source_key === record.source_key)) {
      store.salesRecords.push(record);
    }
  });
  batch.status = "confirmed";
  batch.confirmed_at = new Date().toISOString();
}

export async function saveClick(
  click: Omit<TrackingClick, "id">,
): Promise<void> {
  const record: TrackingClick = { id: randomUUID(), ...click };
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseAdmin()
      .from("tracking_clicks")
      .insert(record);
    if (error) throw error;
    return;
  }
  getDemoStore().clicks.push(record);
}

export async function updateStore(
  id: string,
  patch: Partial<Store>,
): Promise<Store> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin()
      .from("stores")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return data as Store;
  }
  const store = getDemoStore().stores.find((item) => item.id === id);
  if (!store) throw new Error("店舗が見つかりません");
  Object.assign(store, patch, { updated_at: new Date().toISOString() });
  return store;
}

export async function updateSystemSettings(
  patch: Partial<Omit<SystemSettings, "id" | "updated_at">>,
): Promise<SystemSettings> {
  const current = (await getAppData()).systemSettings;
  const updated: SystemSettings = {
    ...current,
    ...patch,
    id: "default",
    updated_at: new Date().toISOString(),
  };
  if (isSupabaseConfigured()) {
    const { error } = await getSupabaseAdmin().from("app_settings").upsert({
      id: "default",
      config: updated,
      updated_at: updated.updated_at,
    });
    if (error) throw error;
    return updated;
  }
  getDemoStore().systemSettings = updated;
  return updated;
}

export async function saveTherapist(
  therapist: Therapist,
): Promise<Therapist> {
  if (isSupabaseConfigured()) {
    const { data, error } = await getSupabaseAdmin()
      .from("therapists")
      .upsert(therapist)
      .select("*")
      .single();
    if (error) throw error;
    return data as Therapist;
  }
  const store = getDemoStore();
  const index = store.therapists.findIndex((item) => item.id === therapist.id);
  if (index >= 0) {
    store.therapists[index] = therapist;
  } else {
    store.therapists.push(therapist);
  }
  return therapist;
}

export async function ensureTherapistCandidate(input: {
  canonicalName: string;
  storeId: string;
  profileUrl: string | null;
  profileImageUrl: string | null;
}): Promise<Therapist> {
  const current = (await getAppData()).therapists.find(
    (therapist) =>
      therapist.primary_store_id === input.storeId &&
      therapist.canonical_name === input.canonicalName,
  );
  if (current) return current;
  const now = new Date().toISOString();
  const candidate: Therapist = {
    id: randomUUID(),
    canonical_name: input.canonicalName,
    display_name: input.canonicalName,
    primary_store_id: input.storeId,
    aliases: [],
    profile_url: input.profileUrl,
    profile_image_url: input.profileImageUrl,
    // 掲載同意は契約時取得済みの運用のため、自動登録の新規名も同意済み扱い。
    publication_consent: true,
    active: true,
    priority_flag: false,
    newcomer_flag: true,
    created_at: now,
    updated_at: now,
  };
  if (isSupabaseConfigured()) {
    const client = getSupabaseAdmin();
    const { data: existing, error: selectError } = await client
      .from("therapists")
      .select("*")
      .eq("canonical_name", input.canonicalName)
      .eq("primary_store_id", input.storeId)
      .maybeSingle();
    if (selectError) throw selectError;
    if (existing) return existing as Therapist;
    const { data, error } = await client
      .from("therapists")
      .insert(candidate)
      .select("*")
      .single();
    if (error) throw error;
    return data as Therapist;
  }
  getDemoStore().therapists.push(candidate);
  return candidate;
}
