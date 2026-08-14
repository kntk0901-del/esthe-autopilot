import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/config/env";
import { AppError, describeError } from "@/lib/errors/app-error";
import { getRedis } from "@/lib/redis/client";

const mockLocks = new Set<string>();

export async function withLock<T>(
  key: string,
  task: () => Promise<T>,
  ttlSeconds = 120,
  mockMode = getEnv().X_MOCK_MODE,
): Promise<T> {
  const token = randomUUID();
  if (mockMode) {
    if (mockLocks.has(key)) {
      throw new AppError("LOCK_ACQUISITION_FAILED");
    }
    mockLocks.add(key);
    try {
      return await task();
    } finally {
      mockLocks.delete(key);
    }
  }
  // Upstash は fetch ベースのため、接続不可時は `fetch failed` としか出ない。
  // X API 側の失敗と区別できるよう、ここで明示的にラップする。
  let redis: Awaited<ReturnType<typeof getRedis>>;
  try {
    redis = await getRedis();
  } catch (error) {
    throw new AppError(
      "LOCK_ACQUISITION_FAILED",
      `Upstash Redisの設定エラー: ${describeError(error)}`,
    );
  }
  let acquired: string | null;
  try {
    acquired = await redis.set(key, token, { nx: true, ex: ttlSeconds });
  } catch (error) {
    throw new AppError(
      "LOCK_ACQUISITION_FAILED",
      `Upstash Redisへの接続に失敗しました(排他ロック取得): ${describeError(error)}`,
    );
  }
  if (!acquired) {
    throw new AppError("LOCK_ACQUISITION_FAILED");
  }
  try {
    return await task();
  } finally {
    const current = await redis.get<string>(key);
    if (current === token) {
      await redis.del(key);
    }
  }
}
