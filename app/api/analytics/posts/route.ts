import { getAppData } from "@/lib/db/repository";

export async function GET() {
  const data = await getAppData();
  return Response.json({
    posts: data.posts.map((post) => ({
      ...post,
      metrics: data.postMetrics.find((metric) => metric.post_id === post.id),
      clicks: data.clicks.filter(
        (click) => click.post_id === post.id && click.counted,
      ).length,
    })),
  });
}
