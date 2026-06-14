import { Client } from "@upstash/qstash";
import { getSecretValue } from "@/lib/settings/secrets";
import type { AppData, Store } from "@/lib/types";

export interface SchedulerSyncResult {
  mode: AppData["systemSettings"]["schedulerMode"];
  schedules: Array<{
    storeCode: string;
    action: "created" | "deleted" | "skipped";
    cron?: string;
  }>;
}

export function postTimeToCron(postTime: string): string {
  const [hour, minute] = postTime.split(":").map(Number);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error("投稿時刻が不正です");
  }
  return `CRON_TZ=Asia/Tokyo ${minute} ${hour} * * *`;
}

function scheduleId(store: Store): string {
  return `esthe-autopilot-${store.code}`;
}

function publicBaseUrl(value: string): string {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    ["localhost", "127.0.0.1", "::1"].includes(url.hostname)
  ) {
    throw new Error("QStashにはHTTPSの公開アプリURLを設定してください");
  }
  return url.toString().replace(/\/$/, "");
}

export async function syncQstashSchedules(
  data: AppData,
): Promise<SchedulerSyncResult> {
  const token = await getSecretValue("qstashToken");
  if (!token) throw new Error("QStash tokenが未設定です");
  const client = new Client({ token });
  const schedules: SchedulerSyncResult["schedules"] = [];

  if (data.systemSettings.schedulerMode !== "qstash") {
    for (const store of data.stores) {
      try {
        await client.schedules.delete(scheduleId(store));
        schedules.push({ storeCode: store.code, action: "deleted" });
      } catch {
        schedules.push({ storeCode: store.code, action: "skipped" });
      }
    }
    return { mode: data.systemSettings.schedulerMode, schedules };
  }

  const baseUrl = publicBaseUrl(data.systemSettings.appBaseUrl);
  for (const store of data.stores) {
    if (
      !store.enabled ||
      (!store.auto_scrape_enabled && !store.auto_post_enabled)
    ) {
      try {
        await client.schedules.delete(scheduleId(store));
        schedules.push({ storeCode: store.code, action: "deleted" });
      } catch {
        schedules.push({ storeCode: store.code, action: "skipped" });
      }
      continue;
    }
    const cron = postTimeToCron(store.posting_config.postTime);
    await client.schedules.create({
      destination: `${baseUrl}/api/cron/store/${store.code}`,
      scheduleId: scheduleId(store),
      cron,
      method: "POST",
      body: JSON.stringify({ source: "qstash" }),
      headers: { "content-type": "application/json" },
      retries: 2,
      timeout: "60s",
      label: `esthe-autopilot-${store.code}`,
    });
    schedules.push({ storeCode: store.code, action: "created", cron });
  }
  return { mode: data.systemSettings.schedulerMode, schedules };
}
