import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorize";
import { saveShifts } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import type { Shift } from "@/lib/types";

const schema = z.object({
  storeId: z.string(),
  therapistId: z.string().nullable(),
  therapistName: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    const now = new Date().toISOString();
    const shift: Shift = {
      id: randomUUID(),
      store_id: input.storeId,
      therapist_id: input.therapistId,
      therapist_raw: input.therapistName,
      shift_date: input.date,
      start_time: input.startTime,
      end_time: input.endTime,
      source: "manual",
      source_url: null,
      source_key: `${input.storeId}:${input.date}:${input.therapistName}:${input.startTime}`,
      confidence: 100,
      review_required: false,
      inferred_fields: [],
      missing_fields: [],
      anomalies: [],
      raw_payload: {},
      created_at: now,
      updated_at: now,
    };
    await saveShifts([shift]);
    return Response.json({ shift }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
