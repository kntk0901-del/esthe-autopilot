import { calculateStoreMetrics } from "@/lib/analytics/store-metrics";
import { getAppData } from "@/lib/db/repository";
import { getJstMonthString } from "@/lib/dates/jst";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const month = url.searchParams.get("month") ?? getJstMonthString();
  const lastDay = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate();
  const data = await getAppData();
  return Response.json({
    month,
    stores: calculateStoreMetrics(
      data,
      `${month}-01`,
      `${month}-${String(lastDay).padStart(2, "0")}`,
    ),
  });
}
