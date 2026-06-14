import { calculateTherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { getAppData } from "@/lib/db/repository";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return Response.json({
    therapists: calculateTherapistMetrics(
      await getAppData(),
      url.searchParams.get("from") ?? undefined,
      url.searchParams.get("to") ?? undefined,
    ),
  });
}
