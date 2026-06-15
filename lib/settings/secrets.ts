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

// 店舗別に設定できる(=Xアカウントを店舗ごとに分けられる)秘密情報。
// 保存キーは `${base}:${storeCode}` 形式(例: "xApiKey:oimachi")。
const storeScopedBases = new Set<string>([
  "xApiKey",
  "xApiSecret",
  "xAccessToken",
  "xAccessTokenSecret",
]);

function isAllowedSecretKey(key: string): boolean {
  if ((secretKeys as readonly string[]).includes(key)) return true;
  const [base, storeCode] = key.split(":");
  return Boolean(storeCode) && storeScopedBases.has(base);
}

declare global {
  var __ESTHE_AUTOPILOT_SECRETS__: Record<string, string> | undefined;
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

function envSecret(key: string): string | null {
  // 店舗スコープキー(base:store)にはenvフォールバックを持たない。
  const envName = envKeys[key as IntegrationSecretKey];
  const value = envName ? getEnv()[envName] : undefined;
  return typeof value === "string" && value.length > 0 ? value : null;
}

export async function getSecretValue(key: string): Promise<string | null> {
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

// 店舗別の値があればそれを、無ければグローバル(全店共通)の値を返す。
// これにより店舗ごとに別のXアカウントへ投稿できる。
export async function getSecretValueForStore(
  baseKey: IntegrationSecretKey,
  storeCode: string,
): Promise<string | null> {
  const scoped = await getSecretValue(`${baseKey}:${storeCode}`);
  return scoped ?? (await getSecretValue(baseKey));
}

export async function setSecretValue(
  key: string,
  value: string,
): Promise<void> {
  if (!isAllowedSecretKey(key)) throw new Error("Unsupported secret key");
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

// 店舗ごとに専用のX資格情報(base:storeCode)が設定済みかを返す。
// すべての項目が揃っている場合のみ「店舗専用キー」とみなし、未設定は共通キーへフォールバックする。
export async function getStoreScopedXStatus(
  storeCodes: string[],
): Promise<Record<string, boolean>> {
  const bases = [...storeScopedBases];
  const entries = await Promise.all(
    storeCodes.map(async (code) => {
      const flags = await Promise.all(
        bases.map(async (base) => Boolean(await getSecretValue(`${base}:${code}`))),
      );
      return [code, flags.every(Boolean)] as const;
    }),
  );
  return Object.fromEntries(entries);
}
