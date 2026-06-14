import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorize";
import { getJstDateString } from "@/lib/dates/jst";
import { errorResponse } from "@/lib/errors/app-error";
import { syncSchedule } from "@/lib/jobs/schedule-sync";

const schema = z.object({
  storeCode: z.enum(["kamata", "oimachi", "sugamo"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(getJstDateString()),
  forceLive: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    return Response.json({ job: await syncSchedule(input) });
  } catch (error) {
    return errorResponse(error);
  }
}
