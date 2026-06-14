import { getJstDateString } from "@/lib/dates/jst";
import { errorResponse } from "@/lib/errors/app-error";
import { getAppData } from "@/lib/db/repository";
import { authorizeAutomationRequest } from "@/lib/auth/automation";

export const maxDuration = 60;
export async function GET(request: Request) {
  try {
    await authorizeAutomationRequest(request);
    const date = getJstDateString();
    const data = await getAppData();
    if (data.systemSettings.schedulerMode === "qstash") {
      return Response.json({
        date,
        status: "skipped",
        reason: "QStashの店舗別スケジュールが有効です",
      });
    }
    const stores = data.stores.filter(
      (store) =>
        store.enabled &&
        (store.auto_scrape_enabled || store.auto_post_enabled),
    );
    const origin = new URL(request.url).origin;
    const results = await Promise.all(
      stores.map(async (store) => {
        const response = await fetch(
          `${origin}/api/cron/store/${store.code}?date=${date}`,
          {
            headers: process.env.CRON_SECRET
              ? { authorization: `Bearer ${process.env.CRON_SECRET}` }
              : {},
            cache: "no-store",
          },
        );
        return {
          store: store.code,
          ok: response.ok,
          result: await response.json(),
        };
      }),
    );
    return Response.json({
      date,
      fanOut: true,
      results,
      status: results.every((result) => result.ok) ? "success" : "partial",
    });
  } catch (error) {
    return errorResponse(error);
  }
}
