import { randomUUID } from "node:crypto";
import { getEnv } from "@/lib/config/env";
import { AppError } from "@/lib/errors/app-error";
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
  const redis = await getRedis();
  const acquired = await redis.set(key, token, { nx: true, ex: ttlSeconds });
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
