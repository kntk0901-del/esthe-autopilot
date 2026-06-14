import type { ImportBatch, SalesRecord } from "@/lib/types";

export function importableRecords(batch: ImportBatch): SalesRecord[] {
  return batch.rows
    .filter(
      (row) =>
        ["reservation", "therapist_daily", "store_daily"].includes(
          row.classification,
        ) &&
        row.errors.length === 0 &&
        !row.review_required,
    )
    .map((row) => row.normalized as SalesRecord);
}
