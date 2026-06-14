import { createHash, randomUUID } from "node:crypto";
import { parse, isValid, format } from "date-fns";
import * as XLSX from "xlsx";
import { normalizeTherapistName } from "@/lib/scraper/base";
import type {
  ImportRow,
  RecordType,
  SalesRecord,
  Store,
  Therapist,
} from "@/lib/types";

export function parseAmount(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value)
    .normalize("NFKC")
    .replace(/[¥￥,\s]/g, "")
    .replace(/[()]/g, "");
  if (["#DIV/0!", "#N/A", "null", "-"].includes(text)) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function normalizeDate(value: unknown, targetYear: number): string | null {
  if (value instanceof Date && isValid(value)) {
    return format(value, "yyyy-MM-dd");
  }
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(
        parsed.d,
      ).padStart(2, "0")}`;
    }
  }
  const text = String(value ?? "")
    .normalize("NFKC")
    .trim();
  if (!text) return null;
  const patterns = [
    "yyyy/M/d",
    "yyyy-M-d",
    "yyyy年M月d日",
    "M/d",
    "M月d日",
  ];
  for (const pattern of patterns) {
    const source = pattern.startsWith("yyyy") ? text : `${targetYear}/${text}`;
    const actualPattern = pattern.startsWith("yyyy") ? pattern : `yyyy/${pattern}`;
    const parsedDate = parse(source, actualPattern, new Date());
    if (isValid(parsedDate)) {
      return format(parsedDate, "yyyy-MM-dd");
    }
  }
  return null;
}

function normalizeStore(
  value: unknown,
  stores: Store[],
  fallbackStoreId: string | null,
): Store | null {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, "");
  return (
    stores.find((store) =>
      [
        store.code,
        store.canonical_name,
        store.display_name,
        `${store.canonical_name}店`,
      ].some((candidate) => candidate.replace(/\s+/g, "") === normalized),
    ) ??
    stores.find((store) => store.id === fallbackStoreId) ??
    null
  );
}

function normalizeTherapist(
  value: unknown,
  therapists: Therapist[],
  storeId: string | null,
): Therapist | null {
  const normalized = normalizeTherapistName(String(value ?? ""));
  return (
    therapists.find(
      (therapist) =>
        therapist.primary_store_id === storeId &&
        (normalizeTherapistName(therapist.canonical_name) === normalized ||
          therapist.aliases.some(
            (alias) => normalizeTherapistName(alias) === normalized,
          )),
    ) ??
    therapists.find(
      (therapist) =>
        normalizeTherapistName(therapist.canonical_name) === normalized,
    ) ??
    null
  );
}

export interface NormalizeRowInput {
  raw: Record<string, unknown>;
  rowNumber: number;
  classification: RecordType;
  batchId: string;
  fileHash: string;
  sheetName: string;
  targetYear: number;
  fallbackStoreId: string | null;
  stores: Store[];
  therapists: Therapist[];
}

export function normalizeSalesRow(input: NormalizeRowInput): ImportRow {
  const raw = input.raw;
  const salesDate = normalizeDate(raw.date, input.targetYear);
  const store = normalizeStore(raw.store, input.stores, input.fallbackStoreId);
  const therapist = normalizeTherapist(
    raw.therapist,
    input.therapists,
    store?.id ?? null,
  );
  const amount = parseAmount(raw.sales);
  const course = parseAmount(raw.course);
  const errors: string[] = [];
  const warnings: string[] = [];
  const inferredFields: string[] = [];
  const missingFields: string[] = [];
  const anomalies: string[] = [];
  if (!salesDate) errors.push("日付を解釈できません");
  if (!store) errors.push("店舗を特定できません");
  if (amount === null) errors.push("売上金額を解釈できません");
  if (!therapist && input.classification !== "store_daily") {
    warnings.push("セラピストがマスタに一致しません");
    anomalies.push("THERAPIST_NOT_MATCHED");
  }
  if (!raw.store && store) inferredFields.push("store_id");
  if (!raw.therapist) missingFields.push("therapist");

  const sourceKey = createHash("sha256")
    .update(
      [
        input.fileHash,
        input.sheetName,
        input.rowNumber,
        salesDate,
        store?.id,
        therapist?.id ?? raw.therapist,
        amount,
      ].join("|"),
    )
    .digest("hex");
  const now = new Date().toISOString();
  const confidence = Math.max(
    0,
    100 - errors.length * 35 - warnings.length * 15 - inferredFields.length * 5,
  );
  const normalized: Partial<SalesRecord> = {
    id: randomUUID(),
    batch_id: input.batchId,
    raw_id: String(input.rowNumber),
    record_type: input.classification,
    sales_date: salesDate ?? "",
    store_id: store?.id ?? null,
    therapist_id: therapist?.id ?? null,
    therapist_raw: String(raw.therapist ?? "") || null,
    start_time: String(raw.startTime ?? "") || null,
    course_minutes: course,
    sales_amount: amount ?? 0,
    therapist_payment: parseAmount(raw.payment),
    gross_profit:
      amount !== null && parseAmount(raw.payment) !== null
        ? amount - (parseAmount(raw.payment) ?? 0)
        : null,
    discount: parseAmount(raw.discount),
    customer_type:
      raw.customerType === "新規" || raw.customerType === "再来"
        ? raw.customerType
        : null,
    nomination:
      raw.nomination === "Y" ||
      raw.nomination === "N" ||
      raw.nomination === "不明"
        ? raw.nomination
        : null,
    source: String(raw.source ?? "") || null,
    status:
      raw.status === "来店済" ||
      raw.status === "予約済" ||
      raw.status === "キャンセル"
        ? raw.status
        : "来店済",
    confidence,
    review_required: errors.length > 0 || warnings.length > 0,
    inferred_fields: inferredFields,
    missing_fields: missingFields,
    anomalies,
    raw_payload: raw,
    source_key: sourceKey,
    created_at: now,
    updated_at: now,
  };
  return {
    id: randomUUID(),
    batch_id: input.batchId,
    row_number: input.rowNumber,
    classification: input.classification,
    normalized,
    raw,
    confidence,
    review_required: normalized.review_required ?? false,
    errors,
    warnings,
  };
}
