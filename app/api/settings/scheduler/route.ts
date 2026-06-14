import { requireAdmin } from "@/lib/auth/authorize";
import { getAppData } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { syncQstashSchedules } from "@/lib/scheduler/qstash";

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    return Response.json({
      result: await syncQstashSchedules(await getAppData()),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
