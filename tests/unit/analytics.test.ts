import { describe, expect, it } from "vitest";
import { calculateStoreMetrics } from "@/lib/analytics/store-metrics";
import { sampleQuality } from "@/lib/analytics/sample-quality";
import { calculateTherapistMetrics } from "@/lib/analytics/therapist-metrics";
import { getDemoStore } from "@/lib/db/demo-store";

describe("analytics", () => {
  it("labels sample sizes conservatively", () => {
    expect(sampleQuality(4)).toBe("サンプル不足");
    expect(sampleQuality(15)).toBe("参考値");
    expect(sampleQuality(30)).toBe("比較対象");
  });

  it("calculates store and therapist metrics", () => {
    const data = getDemoStore();
    const stores = calculateStoreMetrics(data, "2000-01-01", "2099-12-31");
    const therapists = calculateTherapistMetrics(data);
    expect(stores).toHaveLength(3);
    expect(stores[0].sales).toBeGreaterThan(0);
    expect(therapists.some((item) => item.sales > 0)).toBe(true);
  });
});
