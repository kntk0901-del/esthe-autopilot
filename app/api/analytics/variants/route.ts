import { calculateVariantMetrics } from "@/lib/analytics/post-metrics";
import { getAppData } from "@/lib/db/repository";

export async function GET() {
  return Response.json({
    variants: calculateVariantMetrics(await getAppData()),
  });
}
