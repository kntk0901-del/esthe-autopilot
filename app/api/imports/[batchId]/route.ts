import { getImportById, saveImportBatch } from "@/lib/db/repository";
import { requireAdmin } from "@/lib/auth/authorize";
import { errorResponse } from "@/lib/errors/app-error";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const batch = await getImportById((await params).batchId);
  return batch
    ? Response.json({ batch })
    : Response.json({ message: "Not found" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    await requireAdmin(request);
    const batch = await getImportById((await params).batchId);
    if (!batch) return Response.json({ message: "Not found" }, { status: 404 });
    const input = (await request.json()) as {
      rowId: string;
      normalized: Record<string, unknown>;
      reviewRequired?: boolean;
    };
    const row = batch.rows.find((item) => item.id === input.rowId);
    if (!row) return Response.json({ message: "Row not found" }, { status: 404 });
    row.normalized = { ...row.normalized, ...input.normalized };
    row.review_required = input.reviewRequired ?? false;
    row.errors = [];
    await saveImportBatch(batch);
    return Response.json({ batch });
  } catch (error) {
    return errorResponse(error);
  }
}
