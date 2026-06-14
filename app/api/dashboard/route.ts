import { getAppData } from "@/lib/db/repository";
import { getJstDateString } from "@/lib/dates/jst";
import { calculateStoreMetrics } from "@/lib/analytics/store-metrics";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get("date") ?? getJstDateString();
  const data = await getAppData();
  return Response.json({
    date,
    stores: calculateStoreMetrics(data, date, date),
    shifts: data.shifts.filter((shift) => shift.shift_date === date),
    posts: data.posts.filter((post) => post.post_date === date),
    jobs: data.jobs.slice(0, 10),
  });
}
