import { readFileSync } from "node:fs";
import { getDemoStore } from "@/lib/db/demo-store";
import { parseScheduleHtml } from "@/lib/scraper/base";

const data = getDemoStore();
const result = parseScheduleHtml({
  html: readFileSync("tests/fixtures/kamata-schedule.html", "utf8"),
  store: data.stores[0],
  date: "2026-06-15",
  therapists: data.therapists,
});
console.log(JSON.stringify(result.shifts, null, 2));
