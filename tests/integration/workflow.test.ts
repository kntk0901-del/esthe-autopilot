import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { getDemoStore } from "@/lib/db/demo-store";
import { parseWorkbook } from "@/lib/import/workbook-parser";
import { syncSchedule } from "@/lib/jobs/schedule-sync";
import { planPost } from "@/lib/posting/planner";

describe("mock integration workflows", () => {
  it("parses a workbook into a reviewable batch", () => {
    const data = getDemoStore();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["report"],
      ["日付", "店舗", "セラピスト", "売上", "コース"],
      ["2026/06/15", "蒲田", "ちひろ", "12,000", 90],
      ["合計", "", "", "12,000", ""],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "売上");
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
    const batch = parseWorkbook(bytes, {
      fileName: "test.xlsx",
      storeId: null,
      targetYear: 2026,
      stores: data.stores,
      therapists: data.therapists,
    });
    expect(batch.total_rows).toBe(2);
    expect(batch.accepted_rows).toBe(1);
  });

  it("parses UTF-8 CSV files", () => {
    const data = getDemoStore();
    const buffer = readFileSync("tests/fixtures/sales-normal.csv");
    const bytes = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    );
    const batch = parseWorkbook(bytes, {
      fileName: "sales-normal.csv",
      storeId: null,
      targetYear: 2026,
      stores: data.stores,
      therapists: data.therapists,
    });
    expect(batch.accepted_rows).toBe(2);
  });

  it("plans a post with factual fallback in mock mode", async () => {
    const data = getDemoStore();
    const shiftDate = data.shifts.find(
      (shift) => shift.store_id === data.stores[0].id,
    )?.shift_date;
    expect(shiftDate).toBeTruthy();
    const post = await planPost({
      data,
      store: data.stores[0],
      date: shiftDate ?? "",
      force: true,
    });
    expect(post.text_content).toContain(data.stores[0].display_name);
    expect(post.therapist_ids.length).toBeGreaterThan(0);
  });

  it("keeps repeated schedule sync idempotent", async () => {
    const data = getDemoStore();
    const date = data.shifts.find(
      (shift) => shift.store_id === data.stores[0].id,
    )?.shift_date;
    expect(date).toBeTruthy();
    await syncSchedule({ storeCode: "kamata", date: date ?? "" });
    const once = getDemoStore().shifts.filter(
      (shift) =>
        shift.store_id === data.stores[0].id && shift.shift_date === date,
    ).length;
    await syncSchedule({ storeCode: "kamata", date: date ?? "" });
    const twice = getDemoStore().shifts.filter(
      (shift) =>
        shift.store_id === data.stores[0].id && shift.shift_date === date,
    ).length;
    expect(twice).toBe(once);
  });
});
