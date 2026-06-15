import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorize";
import { getAppData, saveImportBatch } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { buildBatchFromAiRecords } from "@/lib/import/ai-extraction";
import type { AiSalesRecord } from "@/lib/import/extraction-prompt";

const recordSchema = z.object({
  date: z.string().nullable().optional(),
  store: z.string().nullable().optional(),
  therapist: z.string().nullable().optional(),
  record_type: z
    .enum(["reservation", "therapist_daily", "store_daily"])
    .optional(),
  sales: z.number().nullable().optional(),
  payment: z.number().nullable().optional(),
  course: z.number().nullable().optional(),
  startTime: z.string().nullable().optional(),
  customerType: z.enum(["新規", "再来"]).nullable().optional(),
  nomination: z.enum(["Y", "N", "不明"]).nullable().optional(),
  source: z.string().nullable().optional(),
});

const schema = z.object({
  records: z.array(recordSchema).min(1).max(2000),
  sourceLabel: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    const data = await getAppData();
    const batch = buildBatchFromAiRecords({
      records: input.records as AiSalesRecord[],
      sourceLabel: input.sourceLabel ?? "AI抽出",
      stores: data.stores,
      therapists: data.therapists,
      targetYear: new Date().getFullYear(),
    });
    await saveImportBatch(batch);
    return Response.json(
      { batchId: batch.id, total: batch.total_rows },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
