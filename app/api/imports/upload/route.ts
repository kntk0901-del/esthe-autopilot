import { requireAdmin } from "@/lib/auth/authorize";
import { getAppData, saveImportBatch } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { parseWorkbook } from "@/lib/import/workbook-parser";

const allowedExtensions = [".xlsx", ".xls", ".csv"];
const maxBytes = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const user = await requireAdmin(request);
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("ファイルがありません");
    if (
      !allowedExtensions.some((extension) =>
        file.name.toLowerCase().endsWith(extension),
      )
    ) {
      throw new Error("CSV / Excelファイルのみアップロードできます");
    }
    if (file.size > maxBytes) throw new Error("ファイルは5MB以下にしてください");
    const data = await getAppData();
    const batch = parseWorkbook(await file.arrayBuffer(), {
      fileName: file.name,
      storeId: String(form.get("storeId") ?? "") || null,
      targetYear: Number(form.get("targetYear") ?? new Date().getFullYear()),
      sheetName: String(form.get("sheetName") ?? "") || undefined,
      stores: data.stores,
      therapists: data.therapists,
    });
    if (data.imports.some((item) => item.file_hash === batch.file_hash)) {
      return Response.json(
        { message: "同一ファイルは既に取込済みです" },
        { status: 409 },
      );
    }
    batch.uploaded_by = user.id;
    await saveImportBatch(batch);
    return Response.json({ batch }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
