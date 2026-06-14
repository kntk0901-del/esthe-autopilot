import { z } from "zod";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

// .env files load `KEY=` as an empty string (not undefined). For optional URL
// fields this would otherwise fail `.url()` validation and break the build, so
// empty strings are normalized to undefined before validation.
const optionalUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().url().optional(),
);

const envSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3100"),
  NEXT_PUBLIC_SUPABASE_URL: optionalUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SETTINGS_ENCRYPTION_KEY: z.string().optional(),
  UPSTASH_REDIS_REST_URL: optionalUrl,
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  QSTASH_TOKEN: z.string().optional(),
  QSTASH_CURRENT_SIGNING_KEY: z.string().optional(),
  QSTASH_NEXT_SIGNING_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  USE_GEMINI: booleanString,
  X_API_KEY: z.string().optional(),
  X_API_SECRET: z.string().optional(),
  X_ACCESS_TOKEN: z.string().optional(),
  X_ACCESS_TOKEN_SECRET: z.string().optional(),
  X_MOCK_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  DATA_MODE: z.enum(["mock", "supabase"]).default("mock"),
  CRON_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().default("admin@example.com"),
  STORE_KAMATA_SCHEDULE_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().default("https://the-ritz-kamata.com/schedule/"),
  ),
  STORE_OIMACHI_SCHEDULE_URL: optionalUrl,
  STORE_SUGAMO_SCHEDULE_URL: optionalUrl,
  ALERT_WEBHOOK_URL: optionalUrl,
  IP_HASH_SALT: z.string().default("change-me-in-production"),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env);
  }
  return cachedEnv;
}

export function isSupabaseConfigured(): boolean {
  const env = getEnv();
  return Boolean(
    env.DATA_MODE === "supabase" &&
      env.NEXT_PUBLIC_SUPABASE_URL &&
      env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export function adminEmails(): string[] {
  return getEnv()
    .ADMIN_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
