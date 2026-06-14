import { describe, expect, it } from "vitest";
import { getDemoStore } from "@/lib/db/demo-store";
import { createPostContentHash } from "@/lib/posting/content-hash";
import { createFixedPost } from "@/lib/posting/fixed-template";
import { validatePostText } from "@/lib/posting/post-validator";

describe("posting safety", () => {
  it("creates a stable content hash", () => {
    const input = {
      storeId: "store-1",
      postDate: "2026-06-15",
      variantCode: "schedule_info",
      text: "hello",
      therapistIds: ["b", "a"],
    };
    expect(createPostContentHash(input)).toBe(createPostContentHash(input));
  });

  it("generates and validates the fixed factual template", () => {
    const data = getDemoStore();
    const store = data.stores[0];
    const shifts = data.shifts
      .filter((shift) => shift.store_id === store.id)
      .slice(0, 2);
    const therapists = shifts
      .map((shift) =>
        data.therapists.find((item) => item.id === shift.therapist_id),
      )
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    const text = createFixedPost({
      store,
      shifts,
      therapists,
      includeUrl: false,
    });
    const result = validatePostText({
      text,
      store,
      shifts,
      selectedTherapists: therapists,
      allTherapists: data.therapists,
      includeUrl: false,
      url: null,
      maxChars: 280,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects unsupported availability claims", () => {
    const data = getDemoStore();
    const store = data.stores[0];
    const shift = data.shifts.find((item) => item.store_id === store.id);
    const therapist = data.therapists.find(
      (item) => item.id === shift?.therapist_id,
    );
    expect(shift && therapist).toBeTruthy();
    const result = validatePostText({
      text: `${store.display_name}\n${therapist?.display_name} ${shift?.start_time}〜${shift?.end_time}\n空きあり`,
      store,
      shifts: shift ? [shift] : [],
      selectedTherapists: therapist ? [therapist] : [],
      allTherapists: data.therapists,
      includeUrl: false,
      url: null,
    });
    expect(result.valid).toBe(false);
  });
});
