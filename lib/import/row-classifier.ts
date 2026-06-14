import type { RowClassification } from "@/lib/types";

export function classifyRow(values: unknown[]): RowClassification {
  const text = values
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (!text) return "empty";
  if (/小計|subtotal/i.test(text)) return "subtotal";
  if (/総合計|合計|total/i.test(text)) return "total";
  const hasDate =
    values.some((value) => value instanceof Date && !Number.isNaN(value.valueOf())) ||
    /\d{1,4}[年/\-.]\d{1,2}(?:[月/\-.]\d{1,2}日?)?/.test(text);
  const hasMoney =
    values.some((value) => typeof value === "number" && Math.abs(value) >= 1000) ||
    /(?:¥|￥)?[\d,]{3,}/.test(text);
  const hasTherapist = values.some(
    (value) => typeof value === "string" && /[ぁ-んァ-ン一-龠]/.test(value),
  );
  const nonEmptyCount = values.filter(
    (value) => value !== null && value !== undefined && value !== "",
  ).length;
  if (hasDate && hasMoney && nonEmptyCount >= 5) return "reservation";
  if (hasDate && hasMoney && hasTherapist) return "therapist_daily";
  if (hasDate && hasMoney) return "store_daily";
  return "unknown";
}
