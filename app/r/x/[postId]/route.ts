import { createHash } from "node:crypto";
import { getEnv } from "@/lib/config/env";
import {
  getAppData,
  getPostById,
  getStoreByCode,
  saveClick,
} from "@/lib/db/repository";
import { classifyBot } from "@/lib/tracking/bot-filter";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const data = await getAppData();
  const post = await getPostById((await params).postId);
  if (!post) return new Response("Not found", { status: 404 });
  const storeCode = post.id.split("-").at(-1);
  const store =
    (await getStoreByCode(storeCode ?? "")) ??
    data.stores.find((item) => item.id === post.store_id);
  const destination = store?.booking_url;
  if (!destination) return new Response("Destination not configured", { status: 404 });
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ipHash = forwarded
    ? createHash("sha256")
        .update(`${getEnv().IP_HASH_SALT}:${forwarded}`)
        .digest("hex")
    : null;
  const userAgent = request.headers.get("user-agent");
  const bot = classifyBot(
    userAgent,
    data.systemSettings.botUserAgentPatterns,
  );
  const botFilterEnabled = data.systemSettings.botFilterEnabled;
  await saveClick({
    post_id: post.id,
    clicked_at: new Date().toISOString(),
    user_agent: userAgent,
    referer: request.headers.get("referer"),
    ip_hash: ipHash,
    destination_url: destination,
    is_bot: bot.isBot,
    bot_reason: bot.reason,
    counted: !botFilterEnabled || !bot.isBot,
  });
  return Response.redirect(destination, 302);
}
