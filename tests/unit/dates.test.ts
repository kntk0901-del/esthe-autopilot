import { describe, expect, it } from "vitest";
import {
  getJstDateString,
  jstDateTimeToUtc,
  minutesBetween,
} from "@/lib/dates/jst";

describe("JST date utilities", () => {
  it("converts UTC midnight boundary to JST business date", () => {
    expect(getJstDateString(new Date("2026-06-14T16:00:00Z"))).toBe(
      "2026-06-15",
    );
  });

  it("stores JST date time as UTC", () => {
    expect(jstDateTimeToUtc("2026-06-15", "09:00")).toBe(
      "2026-06-15T00:00:00.000Z",
    );
  });

  it("calculates overnight shift minutes", () => {
    expect(minutesBetween("18:00", "02:00")).toBe(480);
  });
});
