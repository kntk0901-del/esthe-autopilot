import { calculateTherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { getAppData } from "@/lib/db/repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const id = (await params).id;
  const metric = calculateTherapistMetrics(await getAppData()).find(
    (item) => item.therapist.id === id,
  );
  return metric
    ? Response.json({ therapist: metric })
    : Response.json({ message: "Not found" }, { status: 404 });
}
