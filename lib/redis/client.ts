import { Redis } from "@upstash/redis";
import { getEnv } from "@/lib/config/env";
import { getSecretValue } from "@/lib/settings/secrets";

let redis: Redis | null = null;

export async function getRedis(): Promise<Redis> {
  if (redis) return redis;
  const env = getEnv();
  const url = (await getSecretValue("upstashRedisUrl")) ?? env.UPSTASH_REDIS_REST_URL;
  const token = (await getSecretValue("upstashRedisToken")) ?? env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    throw new Error("Upstash Redis credentials are not configured");
  }
  redis = new Redis({
    url,
    token,
  });
  return redis;
}
