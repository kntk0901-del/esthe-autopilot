import { AppError } from "@/lib/errors/app-error";
import { getAppData, savePost } from "@/lib/db/repository";
import { withLock } from "@/lib/redis/lock";
import { publishToX } from "@/lib/posting/x-client";
import { assertPostingAllowed } from "@/lib/posting/guard";
import type { SocialPost } from "@/lib/types";

export async function publishPostById(
  postId: string,
  options?: { force?: boolean },
): Promise<SocialPost> {
  const data = await getAppData();
  const post = data.posts.find((item) => item.id === postId);
  if (!post) throw new Error("投稿が見つかりません");
  const store = data.stores.find((item) => item.id === post.store_id);
  if (!store) throw new Error("店舗が見つかりません");
  assertPostingAllowed({ data, post, store });
  if (post.status === "posted" && !options?.force) {
    throw new AppError("DUPLICATE_POST");
  }
  if (
    post.approval_status === "pending" ||
    post.approval_status === "rejected"
  ) {
    throw new Error("投稿が承認されていません");
  }
  const duplicate = data.posts.some(
    (item) =>
      item.id !== post.id &&
      item.status === "posted" &&
      item.content_hash === post.content_hash,
  );
  if (duplicate && !options?.force) {
    throw new AppError("DUPLICATE_POST", "同一内容の投稿が既にあります");
  }
  const lockKey = `lock:post:${store.code}:${post.post_date}:${post.post_type}`;
  return withLock(lockKey, async () => {
    post.status = "processing";
    post.attempt_count += 1;
    post.updated_at = new Date().toISOString();
    await savePost(post);
    try {
      const result = await publishToX(post, store, data.systemSettings);
      Object.assign(post, {
        status: "posted",
        posted_at: new Date().toISOString(),
        x_post_id: result.postId,
        x_post_url: result.postUrl,
        x_media_ids: result.mediaIds,
        last_error_code: null,
        last_error_message: null,
        updated_at: new Date().toISOString(),
      } satisfies Partial<SocialPost>);
      await savePost(post);
      return post;
    } catch (error) {
      Object.assign(post, {
        status: "failed",
        last_error_code:
          error instanceof AppError ? error.code : "X_POST_FAILED",
        last_error_message:
          error instanceof Error ? error.message : String(error),
        updated_at: new Date().toISOString(),
      } satisfies Partial<SocialPost>);
      await savePost(post);
      throw error;
    }
  }, 120, data.systemSettings.xMockMode);
}
