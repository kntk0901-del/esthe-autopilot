import { describe, expect, it } from "vitest";
import { getDemoStore } from "@/lib/db/demo-store";
import { assertPostingAllowed } from "@/lib/posting/guard";
import { assignRandomizedHoldout } from "@/lib/posting/therapist-selector";
import { classifyBot } from "@/lib/tracking/bot-filter";
import { postTimeToCron } from "@/lib/scheduler/qstash";

describe("governance controls", () => {
  it("filters known crawler user agents", () => {
    expect(classifyBot("Twitterbot/1.0", ["Twitterbot"]).isBot).toBe(true);
    expect(classifyBot("Mozilla/5.0", ["Twitterbot"]).isBot).toBe(false);
  });

  it("creates deterministic disjoint holdout groups", () => {
    const data = getDemoStore();
    const store = data.stores[0];
    const date = data.shifts.find((shift) => shift.store_id === store.id)!.shift_date;
    const input = {
      date,
      shifts: data.shifts.filter(
        (shift) => shift.store_id === store.id && shift.shift_date === date,
      ),
      therapists: data.therapists,
      posts: data.posts,
      salesRecords: data.salesRecords,
      max: 4,
    };
    const first = assignRandomizedHoldout(input);
    const second = assignRandomizedHoldout(input);
    expect(first).toEqual(second);
    expect(
      first.treatment.some((item) =>
        first.control.some(
          (control) => control.therapist.id === item.therapist.id,
        ),
      ),
    ).toBe(false);
  });

  it("honors the posting kill switch", () => {
    const data = structuredClone(getDemoStore());
    data.systemSettings.postingEnabled = false;
    expect(() =>
      assertPostingAllowed({
        data,
        post: data.posts[0],
        store: data.stores.find(
          (store) => store.id === data.posts[0].store_id,
        )!,
      }),
    ).toThrow("投稿キルスイッチ");
  });

  it("converts store times into JST cloud schedules", () => {
    expect(postTimeToCron("10:15")).toBe(
      "CRON_TZ=Asia/Tokyo 15 10 * * *",
    );
  });
});
