import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { detectHeader } from "@/lib/import/header-detector";
import { normalizeSalesRow } from "@/lib/import/normalizer";
import { classifyRow } from "@/lib/import/row-classifier";
import { sha256 } from "@/lib/posting/content-hash";
import type { ImportBatch, RecordType, Store, Therapist } from "@/lib/types";

export interface ParseWorkbookOptions {
  fileName: string;
  storeId: string | null;
  targetYear: number;
  stores: Store[];
  therapists: Therapist[];
  sheetName?: string;
}

function mapRow(
  row: unknown[],
  columns: Record<string, number>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(columns).map(([key, index]) => [key, row[index]]),
  );
}

export function parseWorkbook(
  bytes: ArrayBuffer,
  options: ParseWorkbookOptions,
): ImportBatch {
  const fileHash = sha256(Buffer.from(bytes));
  const workbook = options.fileName.toLowerCase().endsWith(".csv")
    ? XLSX.read(new TextDecoder("utf-8").decode(bytes), {
        type: "string",
        cellDates: true,
        dense: true,
      })
    : XLSX.read(bytes, {
        type: "array",
        cellDates: true,
        dense: true,
      });
  const sheetName =
    options.sheetName && workbook.SheetNames.includes(options.sheetName)
      ? options.sheetName
      : workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("ワークブックにシートがありません");
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  const header = detectHeader(rows);
  if (header.score < 2) {
    throw new Error("ヘッダ行を検出できませんでした");
  }
  const id = randomUUID();
  const parsedRows = rows
    .slice(header.rowIndex + 1)
    .map((row, index) => {
      const classification = classifyRow(row);
      if (
        !["reservation", "therapist_daily", "store_daily"].includes(
          classification,
        )
      ) {
        return {
          id: randomUUID(),
          batch_id: id,
          row_number: header.rowIndex + index + 2,
          classification,
          normalized: {},
          raw: mapRow(row, header.columns),
          confidence: classification === "unknown" ? 20 : 100,
          review_required: classification === "unknown",
          errors:
            classification === "unknown" ? ["行種別を判定できません"] : [],
          warnings: [],
        };
      }
      return normalizeSalesRow({
        raw: mapRow(row, header.columns),
        rowNumber: header.rowIndex + index + 2,
        classification: classification as RecordType,
        batchId: id,
        fileHash,
        sheetName,
        targetYear: options.targetYear,
        fallbackStoreId: options.storeId,
        stores: options.stores,
        therapists: options.therapists,
      });
    })
    .filter((row) => row.classification !== "empty");

  const importable = parsedRows.filter((row) =>
    ["reservation", "therapist_daily", "store_daily"].includes(
      row.classification,
    ),
  );
  const acceptedRows = importable.filter((row) => row.errors.length === 0).length;
  const rejectedRows = importable.filter((row) => row.errors.length > 0).length;
  const warningRows = importable.filter(
    (row) => row.warnings.length > 0,
  ).length;
  const dates = importable
    .map((row) => row.normalized.sales_date)
    .filter((date): date is string => Boolean(date))
    .sort();
  return {
    id,
    file_name: options.fileName,
    file_hash: fileHash,
    store_id: options.storeId,
    source_sheet: sheetName,
    period_from: dates[0] ?? null,
    period_to: dates.at(-1) ?? null,
    status: rejectedRows > 0 || warningRows > 0 ? "review" : "parsed",
    total_rows: parsedRows.length,
    accepted_rows: acceptedRows,
    rejected_rows: rejectedRows,
    warning_rows: warningRows,
    uploaded_by: null,
    error_message: null,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    rows: parsedRows,
  };
}
