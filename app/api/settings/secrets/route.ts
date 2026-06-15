import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorize";
import { errorResponse } from "@/lib/errors/app-error";
import { getSecretStatus, setSecretValue } from "@/lib/settings/secrets";
import type { IntegrationSecretKey } from "@/lib/types";

const keys = [
  "geminiApiKey",
  "xApiKey",
  "xApiSecret",
  "xAccessToken",
  "xAccessTokenSecret",
  "upstashRedisUrl",
  "upstashRedisToken",
  "qstashToken",
  "qstashCurrentSigningKey",
  "qstashNextSigningKey",
] as const;

// 入力した項目だけ送られてくるため、部分更新を許可する。
// 不明キーは無視し、既知キーのみ保存する。
const schema = z.object({
  secrets: z.record(z.string(), z.string().max(10_000)),
});

const knownKeys = new Set<string>(keys);
const storeScopedBases = new Set<string>([
  "xApiKey",
  "xApiSecret",
  "xAccessToken",
  "xAccessTokenSecret",
]);

// グローバルキー、または店舗別Xキー(base:storeCode)のみ許可する。
function isAllowed(key: string): boolean {
  if (knownKeys.has(key)) return true;
  const [base, storeCode] = key.split(":");
  return Boolean(storeCode) && storeScopedBases.has(base);
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    await Promise.all(
      Object.entries(input.secrets)
        .filter(([key]) => isAllowed(key))
        .map(([key, value]) =>
          setSecretValue(key as IntegrationSecretKey, value),
        ),
    );
    return Response.json({ secretStatus: await getSecretStatus() });
  } catch (error) {
    return errorResponse(error);
  }
}
