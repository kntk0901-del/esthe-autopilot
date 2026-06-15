import { createHash, randomUUID } from "node:crypto";
import { normalizeSalesRow } from "@/lib/import/normalizer";
import type { AiSalesRecord } from "@/lib/import/extraction-prompt";
import type { ImportBatch, RecordType, Store, Therapist } from "@/lib/types";

const RECORD_TYPES: RecordType[] = [
  "reservation",
  "therapist_daily",
  "store_daily",
];

// AIが抽出したJSONレコード配列を、既存の取込パイプライン用 ImportBatch に変換する。
// 正規化・信頼度・要確認判定は normalizeSalesRow を再利用するため、
// ファイル取込と同じレビュー/確定フローに乗る。
export function buildBatchFromAiRecords(input: {
  records: AiSalesRecord[];
  sourceLabel: string;
  stores: Store[];
  therapists: Therapist[];
  targetYear: number;
}): ImportBatch {
  const batchId = randomUUID();
  const fileHash = createHash("sha256")
    .update(`ai:${batchId}:${JSON.stringify(input.records)}`)
    .digest("hex");
  const now = new Date().toISOString();

  const rows = input.records.map((record, index) => {
    const classification: RecordType = RECORD_TYPES.includes(
      record.record_type as RecordType,
    )
      ? (record.record_type as RecordType)
      : record.therapist
        ? "reservation"
        : "store_daily";
    return normalizeSalesRow({
      raw: {
        date: record.date,
        store: record.store,
        therapist: record.therapist,
        sales: record.sales,
        course: record.course,
        payment: record.payment,
        customerType: record.customerType,
        nomination: record.nomination,
        source: record.source,
        startTime: record.startTime,
      },
      rowNumber: index + 1,
      classification,
      batchId,
      fileHash,
      sheetName: "AI抽出",
      targetYear: input.targetYear,
      fallbackStoreId: null,
      stores: input.stores,
      therapists: input.therapists,
    });
  });

  const dates = rows
    .map((row) => (row.normalized as { sales_date?: string }).sales_date)
    .filter((value): value is string => Boolean(value))
    .sort();
  const accepted = rows.filter(
    (row) => row.errors.length === 0 && !row.review_required,
  ).length;
  const warning = rows.filter(
    (row) => row.errors.length === 0 && row.review_required,
  ).length;
  const rejected = rows.filter((row) => row.errors.length > 0).length;

  return {
    id: batchId,
    file_name: input.sourceLabel || "AI抽出",
    file_hash: fileHash,
    store_id: null,
    source_sheet: "AI抽出",
    period_from: dates[0] ?? null,
    period_to: dates[dates.length - 1] ?? null,
    status: warning + rejected > 0 ? "review" : "parsed",
    total_rows: rows.length,
    accepted_rows: accepted,
    rejected_rows: rejected,
    warning_rows: warning,
    uploaded_by: null,
    error_message: null,
    created_at: now,
    confirmed_at: null,
    rows,
  };
}
