import { calculateStoreMetrics } from "@/lib/analytics/store-metrics";
import { calculateTherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { calculateVariantMetrics } from "@/lib/analytics/post-metrics";
import { getAppData } from "@/lib/db/repository";
import { getJstMonthString } from "@/lib/dates/jst";

export async function GET() {
  const data = await getAppData();
  const month = getJstMonthString();
  return Response.json({
    stores: calculateStoreMetrics(data, `${month}-01`, `${month}-31`),
    therapists: calculateTherapistMetrics(data),
    variants: calculateVariantMetrics(data),
  });
}
