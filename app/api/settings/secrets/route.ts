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

const schema = z.object({
  secrets: z.record(z.enum(keys), z.string().max(10_000)),
});

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const input = schema.parse(await request.json());
    await Promise.all(
      Object.entries(input.secrets).map(([key, value]) =>
        setSecretValue(key as IntegrationSecretKey, value),
      ),
    );
    return Response.json({ secretStatus: await getSecretStatus() });
  } catch (error) {
    return errorResponse(error);
  }
}
