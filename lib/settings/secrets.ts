import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { getEnv, isSupabaseConfigured } from "@/lib/config/env";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { IntegrationSecretKey, SecretStatus } from "@/lib/types";

const envKeys: Record<IntegrationSecretKey, keyof ReturnType<typeof getEnv>> = {
  geminiApiKey: "GEMINI_API_KEY",
  xApiKey: "X_API_KEY",
  xApiSecret: "X_API_SECRET",
  xAccessToken: "X_ACCESS_TOKEN",
  xAccessTokenSecret: "X_ACCESS_TOKEN_SECRET",
  upstashRedisUrl: "UPSTASH_REDIS_REST_URL",
  upstashRedisToken: "UPSTASH_REDIS_REST_TOKEN",
  qstashToken: "QSTASH_TOKEN",
  qstashCurrentSigningKey: "QSTASH_CURRENT_SIGNING_KEY",
  qstashNextSigningKey: "QSTASH_NEXT_SIGNING_KEY",
};

const secretKeys = Object.keys(envKeys) as IntegrationSecretKey[];

declare global {
  var __ESTHE_AUTOPILOT_SECRETS__:
    | Partial<Record<IntegrationSecretKey, string>>
    | undefined;
}

function encryptionKey(): Buffer {
  const source = getEnv().SETTINGS_ENCRYPTION_KEY;
  if (!source) {
    throw new Error(
      "SETTINGS_ENCRYPTION_KEY is required before saving secrets in database mode",
    );
  }
  return createHash("sha256").update(source).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return {
    encrypted_value: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    auth_tag: cipher.getAuthTag().toString("base64"),
  };
}

function decrypt(record: {
  encrypted_value: string;
  iv: string;
  auth_tag: string;
}): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(record.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(record.auth_tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(record.encrypted_value, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function envSecret(key: IntegrationSecretKey): string | null {
  const value = getEnv()[envKeys[key]];
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getSecretValue(
  key: IntegrationSecretKey,
): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    return globalThis.__ESTHE_AUTOPILOT_SECRETS__?.[key] ?? envSecret(key);
  }
  const { data, error } = await getSupabaseAdmin()
    .from("app_secrets")
    .select("encrypted_value,iv,auth_tag")
    .eq("key", key)
    .maybeSingle();
  if (error) throw error;
  return data ? decrypt(data) : envSecret(key);
}

export async function setSecretValue(
  key: IntegrationSecretKey,
  value: string,
): Promise<void> {
  if (!secretKeys.includes(key)) throw new Error("Unsupported secret key");
  if (!isSupabaseConfigured()) {
    globalThis.__ESTHE_AUTOPILOT_SECRETS__ ??= {};
    if (value) globalThis.__ESTHE_AUTOPILOT_SECRETS__[key] = value;
    else delete globalThis.__ESTHE_AUTOPILOT_SECRETS__[key];
    return;
  }
  if (!value) {
    const { error } = await getSupabaseAdmin()
      .from("app_secrets")
      .delete()
      .eq("key", key);
    if (error) throw error;
    return;
  }
  const { error } = await getSupabaseAdmin()
    .from("app_secrets")
    .upsert({ key, ...encrypt(value), updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function getSecretStatus(): Promise<SecretStatus> {
  const pairs = await Promise.all(
    secretKeys.map(async (key) => [key, Boolean(await getSecretValue(key))] as const),
  );
  return Object.fromEntries(pairs) as SecretStatus;
}
