import { Redis } from "@upstash/redis";
import { getEnv } from "@/lib/config/env";
import { getSecretValue } from "@/lib/settings/secrets";

// 資格情報が変わったら即座に作り直す(url+tokenをキーにキャッシュ)。
// 以前は初回生成のクライアントを無条件に使い回していたため、設定画面で
// トークンを更新しても温まったインスタンスが古い資格情報を使い続けていた。
let cached: { key: string; client: Redis } | null = null;

export async function getRedis(): Promise<Redis> {
  const env = getEnv();
  const url = (await getSecretValue("upstashRedisUrl")) ?? env.UPSTASH_REDIS_REST_URL;
  const token = (await getSecretValue("upstashRedisToken")) ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Upstash Redis credentials are not configured");
  }
  const key = `${url}|${token}`;
  if (cached?.key === key) return cached.client;
  const client = new Redis({ url, token });
  cached = { key, client };
  return client;
}
