import { calculateStoreMetrics } from "@/lib/analytics/store-metrics";
import { getAppData } from "@/lib/db/repository";
import { getJstMonthString } from "@/lib/dates/jst";

export async function GET(request: Request) {
  const month =
    new URL(request.url).searchParams.get("month") ?? getJstMonthString();
  const data = await getAppData();
  return Response.json({
    stores: calculateStoreMetrics(data, `${month}-01`, `${month}-31`),
  });
}
