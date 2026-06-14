import { getDemoStore } from "@/lib/db/demo-store";
import {
  fetchScheduleHtml,
  parseScheduleHtml,
} from "@/lib/scraper/base";

async function main() {
  const data = getDemoStore();
  const store = data.stores.find((item) => item.code === "oimachi");
  if (!store?.schedule_url) throw new Error("大井町の出勤表URLが未設定です");

  const html = await fetchScheduleHtml(store.schedule_url);
  const result = parseScheduleHtml({
    html,
    store,
    date: process.argv[2] ?? new Date().toISOString().slice(0, 10),
    therapists: data.therapists,
    source: "live-test",
  });

  console.table(
    result.shifts.map((shift) => ({
      name: shift.therapist_raw,
      start: shift.start_time,
      end: shift.end_time,
      matched: Boolean(shift.therapist_id),
      review: shift.review_required,
    })),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
