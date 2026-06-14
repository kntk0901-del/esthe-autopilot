import { getAppData, getStoreByCode, updateStore } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { requireAdmin } from "@/lib/auth/authorize";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeCode: string }> },
) {
  try {
    await requireAdmin(request);
    const store = await getStoreByCode((await params).storeCode);
    if (!store) return Response.json({ message: "Not found" }, { status: 404 });
    const data = await getAppData();
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const eligible = data.posts
      .filter(
        (post) =>
          post.store_id === store.id &&
          post.status === "posted" &&
          post.posted_at &&
          new Date(post.posted_at).getTime() <= cutoff,
      )
      .sort((a, b) => (b.posted_at ?? "").localeCompare(a.posted_at ?? ""));
    const latest = eligible[0];
    const metric = latest
      ? data.postMetrics
          .filter((item) => item.post_id === latest.id)
          .sort((a, b) => b.measured_at.localeCompare(a.measured_at))[0]
      : null;
    const impressions = metric?.impressions ?? null;
    const status =
      impressions === null
        ? "unknown"
        : impressions < data.systemSettings.minimumImpressionsAfter24h
          ? "limited"
          : "healthy";
    const updated = await updateStore(store.id, {
      posting_config: {
        ...store.posting_config,
        accountHealthStatus: status,
        lastHealthCheckAt: new Date().toISOString(),
      },
    });
    return Response.json({
      status,
      impressions,
      threshold: data.systemSettings.minimumImpressionsAfter24h,
      postId: latest?.id ?? null,
      store: updated,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
