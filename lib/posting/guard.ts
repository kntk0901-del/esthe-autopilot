import { AppError } from "@/lib/errors/app-error";
import type { AppData, SocialPost, Store } from "@/lib/types";

export function assertPostingAllowed(input: {
  data: AppData;
  post: SocialPost;
  store: Store;
}): void {
  const { data, post, store } = input;
  const settings = data.systemSettings;
  if (!settings.postingEnabled) {
    throw new AppError("POSTING_DISABLED");
  }
  if (
    store.posting_config.blockWhenAccountRestricted &&
    ["limited", "suspended"].includes(
      store.posting_config.accountHealthStatus,
    )
  ) {
    throw new AppError(
      "X_ACCOUNT_RESTRICTED",
      "Xアカウント状態が抑制または停止のため投稿を中止しました",
    );
  }
  const postedToday = data.posts.filter(
    (item) => item.status === "posted" && item.post_date === post.post_date,
  ).length;
  if (postedToday >= settings.dailyPostLimit) {
    throw new AppError("DAILY_POST_LIMIT");
  }
  const month = post.post_date.slice(0, 7);
  const monthlyPosts = data.posts.filter(
    (item) => item.status === "posted" && item.post_date.startsWith(month),
  ).length;
  const nextEstimatedCost =
    (monthlyPosts + 1) * settings.estimatedXCostPerPostYen;
  if (nextEstimatedCost > settings.monthlyXBudgetYen) {
    throw new AppError("X_BUDGET_LIMIT");
  }
}
