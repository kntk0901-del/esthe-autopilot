import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { getDemoStore } from "@/lib/db/demo-store";
import {
  normalizeTherapistName,
  parseScheduleHtml,
  parseShiftTime,
} from "@/lib/scraper/base";

describe("schedule scraper", () => {
  it("normalizes names and overnight times", () => {
    expect(normalizeTherapistName(" ちひろ\n本日出勤 ")).toBe("ちひろ");
    expect(normalizeTherapistName("みれい6/4初出勤！")).toBe("みれい");
    expect(parseShiftTime("18:00 〜 翌02:00")).toEqual({
      start: "18:00",
      end: "02:00",
    });
  });

  it("parses the live Oimachi DOM structure", () => {
    const data = getDemoStore();
    const store = data.stores.find((item) => item.code === "oimachi");
    expect(store).toBeTruthy();
    const html = readFileSync("tests/fixtures/oimachi-schedule.html", "utf8");
    const result = parseScheduleHtml({
      html,
      store: store!,
      date: "2026-06-14",
      therapists: data.therapists,
    });
    expect(result.shifts).toHaveLength(2);
    expect(result.shifts[0]).toMatchObject({
      therapist_raw: "ちなつ",
      start_time: "11:00",
      end_time: "18:00",
      review_required: false,
    });
    expect(result.shifts[1]).toMatchObject({
      therapist_raw: "みれい",
      start_time: "19:00",
      end_time: "03:00",
      review_required: true,
    });
    expect(result.images[result.shifts[0].source_key]).toBe(
      "https://esthe-spa-lounge.com/wp-content/uploads/chinatsu.jpg",
    );
  });

  it("parses configured Kamata schedule cards", () => {
    const data = getDemoStore();
    const store = { ...data.stores[0], scraper_config: data.stores[0].scraper_config };
    const html = readFileSync("tests/fixtures/kamata-schedule.html", "utf8");
    const result = parseScheduleHtml({
      html,
      store,
      date: "2026-06-15",
      therapists: data.therapists,
    });
    expect(result.shifts).toHaveLength(2);
    expect(result.shifts[0].start_time).toBe("12:00");
  });
});
