import { getImportById, saveImportBatch } from "@/lib/db/repository";
import { requireAdmin } from "@/lib/auth/authorize";
import { errorResponse } from "@/lib/errors/app-error";

export async function PATCH(
  request: Request,
  {
    params,
  }: { params: Promise<{ batchId: string; rowId: string }> },
) {
  try {
    await requireAdmin(request);
    const { batchId, rowId } = await params;
    const batch = await getImportById(batchId);
    if (!batch) return Response.json({ message: "Not found" }, { status: 404 });
    const row = batch.rows.find((item) => item.id === rowId);
    if (!row) return Response.json({ message: "Row not found" }, { status: 404 });
    const patch = (await request.json()) as Record<string, unknown>;
    row.normalized = { ...row.normalized, ...patch };
    row.review_required = false;
    row.errors = [];
    await saveImportBatch(batch);
    return Response.json({ row });
  } catch (error) {
    return errorResponse(error);
  }
}
