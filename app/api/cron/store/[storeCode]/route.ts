import { z } from "zod";
import { getJstDateString } from "@/lib/dates/jst";
import { errorResponse } from "@/lib/errors/app-error";
import { runStoreDailyJob } from "@/lib/jobs/daily";
import { authorizeAutomationRequest } from "@/lib/auth/automation";

export const maxDuration = 60;

const storeSchema = z.enum(["kamata", "oimachi", "sugamo"]);

async function execute(
  request: Request,
  { params }: { params: Promise<{ storeCode: string }> },
  rawBody = "",
) {
  try {
    await authorizeAutomationRequest(request, rawBody);
    const url = new URL(request.url);
    const date = url.searchParams.get("date") ?? getJstDateString();
    return Response.json({
      job: await runStoreDailyJob(storeSchema.parse((await params).storeCode), date),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ storeCode: string }> },
) {
  return execute(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ storeCode: string }> },
) {
  const rawBody = await request.text();
  return execute(request, context, rawBody);
}
