import { Receiver } from "@upstash/qstash";
import { getEnv, isSupabaseConfigured } from "@/lib/config/env";
import { requireAdmin } from "@/lib/auth/authorize";
import { getSecretValue } from "@/lib/settings/secrets";

export async function authorizeAutomationRequest(
  request: Request,
  rawBody = "",
): Promise<void> {
  const env = getEnv();
  const authorization = request.headers.get("authorization");
  if (
    env.CRON_SECRET &&
    authorization === `Bearer ${env.CRON_SECRET}`
  ) {
    return;
  }

  const signature = request.headers.get("upstash-signature");
  if (signature) {
    const currentSigningKey = await getSecretValue("qstashCurrentSigningKey");
    const nextSigningKey = await getSecretValue("qstashNextSigningKey");
    if (currentSigningKey && nextSigningKey) {
      const receiver = new Receiver({
        currentSigningKey,
        nextSigningKey,
      });
      await receiver.verify({
        signature,
        body: rawBody,
        url: request.url,
        upstashRegion: request.headers.get("upstash-region") ?? undefined,
      });
      return;
    }
  }

  if (isSupabaseConfigured()) {
    await requireAdmin(request);
    return;
  }
  const hostname = new URL(request.url).hostname;
  if (["localhost", "127.0.0.1", "::1"].includes(hostname)) return;
  throw new Error("Unauthorized");
}
