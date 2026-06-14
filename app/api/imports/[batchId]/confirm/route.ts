import { requireAdmin } from "@/lib/auth/authorize";
import { confirmImport, getImportById } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { importableRecords } from "@/lib/import/validator";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  try {
    await requireAdmin(request);
    const batch = await getImportById((await params).batchId);
    if (!batch) return Response.json({ message: "Not found" }, { status: 404 });
    const unresolved = batch.rows.filter(
      (row) =>
        ["reservation", "therapist_daily", "store_daily"].includes(
          row.classification,
        ) && (row.review_required || row.errors.length > 0),
    );
    if (unresolved.length > 0) {
      return Response.json(
        { message: "要確認行が残っています", count: unresolved.length },
        { status: 409 },
      );
    }
    const records = importableRecords(batch);
    await confirmImport(batch, records);
    return Response.json({ batch, imported: records.length });
  } catch (error) {
    return errorResponse(error);
  }
}
