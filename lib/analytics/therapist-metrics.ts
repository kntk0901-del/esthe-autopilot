import { minutesBetween } from "@/lib/dates/jst";
import { average } from "@/lib/utils";
import { sampleQuality } from "@/lib/analytics/sample-quality";
import type { AppData, Therapist } from "@/lib/types";

export interface TherapistMetrics {
  therapist: Therapist;
  storeName: string;
  shiftDays: number;
  shiftHours: number;
  postAppearances: number;
  sales: number;
  bookings: number;
  averageTicket: number;
  hourlySales: number | null;
  newRatio: number;
  repeatRatio: number;
  nominationRatio: number;
  featuredAverageSales: number | null;
  nonFeaturedAverageSales: number | null;
  difference: number | null;
  sampleCount: number;
  quality: ReturnType<typeof sampleQuality>;
  analysisLabel: "ランダム比較" | "運用検証のみ";
}

export function calculateTherapistMetrics(
  data: AppData,
  from?: string,
  to?: string,
): TherapistMetrics[] {
  return data.therapists.map((therapist) => {
    const shifts = data.shifts.filter(
      (shift) =>
        shift.therapist_id === therapist.id &&
        (!from || shift.shift_date >= from) &&
        (!to || shift.shift_date <= to),
    );
    const records = data.salesRecords.filter(
      (record) =>
        record.therapist_id === therapist.id &&
        record.record_type !== "store_daily" &&
        (!from || record.sales_date >= from) &&
        (!to || record.sales_date <= to) &&
        record.status !== "キャンセル",
    );
    const allFeaturedDates = new Set(
      data.posts
        .filter(
          (post) =>
            post.therapist_ids.includes(therapist.id) &&
            post.status === "posted" &&
            (!from || post.post_date >= from) &&
            (!to || post.post_date <= to),
        )
        .map((post) => post.post_date),
    );
    const randomizedPosts = data.posts.filter(
      (post) =>
        post.measurement_mode === "randomized_holdout" &&
        post.status === "posted" &&
        (!from || post.post_date >= from) &&
        (!to || post.post_date <= to),
    );
    const featuredDates = new Set(
      randomizedPosts
        .filter(
          (post) =>
            post.therapist_ids.includes(therapist.id) &&
            post.control_therapist_ids.length > 0,
        )
        .map((post) => post.post_date),
    );
    const controlDates = new Set(
      randomizedPosts
        .filter((post) => post.control_therapist_ids.includes(therapist.id))
        .map((post) => post.post_date),
    );
    const shiftDates = [...new Set(shifts.map((shift) => shift.shift_date))];
    const salesByDate = new Map<string, number>();
    records.forEach((record) =>
      salesByDate.set(
        record.sales_date,
        (salesByDate.get(record.sales_date) ?? 0) + record.sales_amount,
      ),
    );
    const featuredValues = shiftDates
      .filter((date) => featuredDates.has(date))
      .map((date) => salesByDate.get(date) ?? 0);
    const nonFeaturedValues = shiftDates
      .filter((date) => controlDates.has(date))
      .map((date) => salesByDate.get(date) ?? 0);
    const shiftMinutes = shifts.reduce(
      (sum, shift) =>
        sum + (minutesBetween(shift.start_time, shift.end_time) ?? 0),
      0,
    );
    const sales = records.reduce((sum, record) => sum + record.sales_amount, 0);
    const comparable = featuredValues.length > 0 && nonFeaturedValues.length > 0;
    const featuredAverageSales = comparable ? average(featuredValues) : null;
    const nonFeaturedAverageSales = comparable ? average(nonFeaturedValues) : null;
    const sampleCount = Math.min(featuredValues.length, nonFeaturedValues.length);
    return {
      therapist,
      storeName:
        data.stores.find((store) => store.id === therapist.primary_store_id)
          ?.display_name ?? "-",
      shiftDays: shiftDates.length,
      shiftHours: shiftMinutes / 60,
      postAppearances: allFeaturedDates.size,
      sales,
      bookings: records.length,
      averageTicket: records.length > 0 ? sales / records.length : 0,
      hourlySales: shiftMinutes > 0 ? sales / (shiftMinutes / 60) : null,
      newRatio:
        records.length > 0
          ? records.filter((record) => record.customer_type === "新規").length /
            records.length
          : 0,
      repeatRatio:
        records.length > 0
          ? records.filter((record) => record.customer_type === "再来").length /
            records.length
          : 0,
      nominationRatio:
        records.length > 0
          ? records.filter((record) => record.nomination === "Y").length /
            records.length
          : 0,
      featuredAverageSales,
      nonFeaturedAverageSales,
      difference:
        featuredAverageSales !== null && nonFeaturedAverageSales !== null
          ? featuredAverageSales - nonFeaturedAverageSales
          : null,
      sampleCount,
      quality: sampleQuality(sampleCount),
      analysisLabel: comparable ? "ランダム比較" : "運用検証のみ",
    };
  });
}
