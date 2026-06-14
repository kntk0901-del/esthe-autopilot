import { z } from "zod";
import {
  getAppData,
  getStoreByCode,
  updateStore,
} from "@/lib/db/repository";
import { errorResponse } from "@/lib/errors/app-error";
import { requireAdmin } from "@/lib/auth/authorize";
import { syncQstashSchedules } from "@/lib/scheduler/qstash";

const patchSchema = z.object({
  schedule_url: z.string().url().nullable().optional(),
  booking_url: z.string().url().nullable().optional(),
  x_account_name: z.string().nullable().optional(),
  monthly_target: z.number().int().nonnegative().optional(),
  room_capacity: z.number().int().positive().optional(),
  enabled: z.boolean().optional(),
  auto_scrape_enabled: z.boolean().optional(),
  auto_post_enabled: z.boolean().optional(),
  posting_config: z.record(z.string(), z.unknown()).optional(),
  scraper_config: z.record(z.string(), z.unknown()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeCode: string }> },
) {
  const store = await getStoreByCode((await params).storeCode);
  return store
    ? Response.json({ store })
    : Response.json({ message: "Not found" }, { status: 404 });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ storeCode: string }> },
) {
  try {
    await requireAdmin(request);
    const store = await getStoreByCode((await params).storeCode);
    if (!store) return Response.json({ message: "Not found" }, { status: 404 });
    const patch = patchSchema.parse(await request.json());
    const updated = await updateStore(store.id, patch as Partial<typeof store>);
    let schedulerMessage: string | null = null;
    const data = await getAppData();
    if (data.systemSettings.schedulerMode === "qstash") {
      try {
        await syncQstashSchedules(data);
        schedulerMessage = "QStashの自動実行時刻も更新しました";
      } catch (error) {
        schedulerMessage = `店舗設定は保存済みです。自動実行時刻は未同期: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    }
    return Response.json({ store: updated, schedulerMessage });
  } catch (error) {
    return errorResponse(error);
  }
}
