import { randomUUID } from "node:crypto";
import { jstDateTimeToUtc } from "@/lib/dates/jst";
import { createFixedPost } from "@/lib/posting/fixed-template";
import { createPostContentHash } from "@/lib/posting/content-hash";
import { generatePostWithAi } from "@/lib/posting/ai-generator";
import { validatePostText } from "@/lib/posting/post-validator";
import {
  assignRandomizedHoldout,
  selectTherapists,
} from "@/lib/posting/therapist-selector";
import type { AppData, SocialPost, Store, VariantCode } from "@/lib/types";

export async function planPost(input: {
  data: AppData;
  store: Store;
  date: string;
  force?: boolean;
}): Promise<SocialPost> {
  const existing = input.data.posts.find(
    (post) =>
      post.store_id === input.store.id &&
      post.post_date === input.date &&
      post.post_type === "daily_schedule",
  );
  if (existing && !input.force) {
    return existing;
  }
  const shifts = input.data.shifts.filter(
    (shift) =>
      shift.store_id === input.store.id &&
      shift.shift_date === input.date &&
      !shift.review_required,
  );
  if (shifts.length === 0) {
    throw new Error(`${input.store.display_name}: 投稿可能な出勤情報がありません`);
  }
  const selectionInput = {
    date: input.date,
    shifts,
    therapists: input.data.therapists,
    posts: input.data.posts,
    salesRecords: input.data.salesRecords,
    max: input.store.posting_config.maxTherapists,
  };
  const holdout =
    input.data.systemSettings.measurementMode === "randomized_holdout"
      ? assignRandomizedHoldout(selectionInput)
      : null;
  const selected = holdout?.treatment ?? selectTherapists(selectionInput);
  if (selected.length === 0) {
    throw new Error(`${input.store.display_name}: 掲載同意済みの出勤者がいません`);
  }
  const selectedShifts = selected.map((item) => item.shift);
  const selectedTherapists = selected.map((item) => item.therapist);
  const storePosts = input.data.posts
    .filter((post) => post.store_id === input.store.id && post.post_date < input.date)
    .sort((a, b) => b.post_date.localeCompare(a.post_date));
  const activeVariants = input.data.variants.filter((variant) => variant.active);
  const weekday = new Date(`${input.date}T12:00:00+09:00`).getDay();
  const variant = [...activeVariants].sort((a, b) => {
    const count = (variantId: string) =>
      storePosts.filter(
        (post) =>
          post.variant_id === variantId &&
          new Date(`${post.post_date}T12:00:00+09:00`).getDay() === weekday,
      ).length;
    return count(a.id) - count(b.id) || a.code.localeCompare(b.code);
  })[0];
  const variantCode = (variant?.code ?? "schedule_info") as VariantCode;
  const includeUrl =
    (storePosts.length % 10) / 10 < input.store.posting_config.includeUrlRate;
  const id = existing?.id ?? randomUUID();
  const trackingUrl = includeUrl
    ? `${input.data.systemSettings.appBaseUrl.replace(/\/$/, "")}/r/x/${id}`
    : null;
  const fallback = createFixedPost({
    store: input.store,
    shifts: selectedShifts,
    therapists: selectedTherapists,
    includeUrl,
    trackingUrl,
  });
  const ai = await generatePostWithAi({
    store: input.store,
    date: input.date,
    shifts: selectedShifts,
    therapists: selectedTherapists,
    variant: variantCode,
    includeUrl,
    url: trackingUrl,
    settings: input.data.systemSettings,
  });
  const candidate = ai?.text ?? fallback;
  const validation = validatePostText({
    text: candidate,
    store: input.store,
    shifts: selectedShifts,
    selectedTherapists,
    allTherapists: input.data.therapists,
    includeUrl,
    url: trackingUrl,
  });
  const text = validation.valid ? candidate : fallback;
  const contentHash = createPostContentHash({
    storeId: input.store.id,
    postDate: input.date,
    variantCode,
    text,
    therapistIds: selectedTherapists.map((item) => item.id),
  });
  const now = new Date().toISOString();
  return {
    id,
    store_id: input.store.id,
    post_date: input.date,
    post_type: "daily_schedule",
    variant_id: variant?.id ?? input.data.variants[0]?.id ?? "",
    status: "scheduled",
    approval_status: input.store.posting_config.approvalRequired
      ? "pending"
      : "auto",
    scheduled_at: jstDateTimeToUtc(
      input.date,
      input.store.posting_config.postTime,
    ),
    posted_at: null,
    text_content: text,
    fallback_text: fallback,
    used_ai: Boolean(ai && validation.valid),
    ai_model: ai?.model ?? null,
    ai_prompt: ai?.prompt ?? null,
    ai_raw_response: ai?.rawResponse ?? null,
    include_url: includeUrl,
    tracking_url: trackingUrl,
    image_urls: selectedTherapists
      .map((therapist) => therapist.profile_image_url)
      .filter((url): url is string => Boolean(url))
      .slice(0, 4),
    x_media_ids: [],
    x_post_id: null,
    x_post_url: null,
    content_hash: contentHash,
    attempt_count: existing?.attempt_count ?? 0,
    last_error_code: validation.valid ? null : "AI_VALIDATION_FAILED",
    last_error_message: validation.valid
      ? null
      : validation.errors.join(" / "),
    therapist_ids: selectedTherapists.map((item) => item.id),
    control_therapist_ids:
      holdout?.control.map((item) => item.therapist.id) ?? [],
    measurement_mode: input.data.systemSettings.measurementMode,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
}
