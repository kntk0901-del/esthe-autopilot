import { describe, expect, it } from "vitest";
import { classifyRow } from "@/lib/import/row-classifier";
import { normalizeDate, parseAmount } from "@/lib/import/normalizer";

describe("sales normalization", () => {
  it("classifies totals and reservation rows", () => {
    expect(classifyRow(["合計", "", "28,000"])).toBe("total");
    expect(
      classifyRow(["2026/6/1", "蒲田", "ちひろ", 90, "12,000"]),
    ).toBe("reservation");
  });

  it("normalizes money and year-less dates", () => {
    expect(parseAmount("￥12,000")).toBe(12000);
    expect(parseAmount("#N/A")).toBeNull();
    expect(normalizeDate("6/15", 2026)).toBe("2026-06-15");
  });
});
