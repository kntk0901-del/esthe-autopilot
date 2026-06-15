import { format, parse, startOfMonth } from "date-fns";
import { fromZonedTime, toZonedTime } from "date-fns-tz";

export const BUSINESS_TIMEZONE = "Asia/Tokyo";

export function toJst(date: Date | string): Date {
  return toZonedTime(
    typeof date === "string" ? new Date(date) : date,
    BUSINESS_TIMEZONE,
  );
}

export function getJstDateString(date: Date = new Date()): string {
  return format(toJst(date), "yyyy-MM-dd");
}

export function getJstMonthString(date: Date = new Date()): string {
  return format(toJst(date), "yyyy-MM");
}

// "YYYY-MM" から対象月の初日・末日を返す。末日は月ごとに正しく算出する。
export function jstMonthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(year, m, 0).getDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

// 入力が "YYYY-MM" 形式でなければ現在のJST月にフォールバックする。
export function resolveMonth(
  value: string | undefined,
  fallback: string = getJstMonthString(),
): string {
  return /^\d{4}-\d{2}$/.test(value ?? "") ? (value as string) : fallback;
}

export function formatJstDateTime(
  date: Date | string | null,
  pattern = "M/d HH:mm",
): string {
  if (!date) {
    return "-";
  }
  return format(toJst(date), pattern);
}

export function formatJstDate(
  date: Date | string,
  pattern = "yyyy/M/d",
): string {
  const value =
    typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)
      ? parse(date, "yyyy-MM-dd", new Date())
      : toJst(date);
  return format(value, pattern);
}

export function jstDateTimeToUtc(date: string, time: string): string {
  return fromZonedTime(`${date}T${time}:00`, BUSINESS_TIMEZONE).toISOString();
}

export function startOfJstMonth(date: Date = new Date()): string {
  return format(startOfMonth(toJst(date)), "yyyy-MM-dd");
}

export function minutesBetween(
  start: string | null,
  end: string | null,
): number | null {
  if (!start || !end) {
    return null;
  }
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  if (
    [startHour, startMinute, endHour, endMinute].some(Number.isNaN) ||
    startMinute > 59 ||
    endMinute > 59
  ) {
    return null;
  }
  let value = endHour * 60 + endMinute - (startHour * 60 + startMinute);
  if (value <= 0) {
    value += 24 * 60;
  }
  return value;
}
