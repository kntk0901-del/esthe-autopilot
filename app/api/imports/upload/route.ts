import { requireAdmin } from "@/lib/auth/authorize";
import { getAppData, saveImportBatch } from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { parseMonthlyWorkbook } from "@/lib/import/monthly-parser";
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
    const bytes = await file.arrayBuffer();
    const targetYear = Number(
      form.get("targetYear") ?? new Date().getFullYear(),
    );
    // 月次売上表形式 (【店】売上 + シフト) を先に判定し、検出できれば専用パーサで一括取込。
    // 非対応形式は従来の汎用パーサにフォールバックする。
    const isCsv = file.name.toLowerCase().endsWith(".csv");
    const monthly = isCsv
      ? null
      : parseMonthlyWorkbook(bytes, {
          fileName: file.name,
          targetYear,
          stores: data.stores,
          therapists: data.therapists,
        });
    const batch =
      monthly ??
      parseWorkbook(bytes, {
        fileName: file.name,
        storeId: String(form.get("storeId") ?? "") || null,
        targetYear,
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
