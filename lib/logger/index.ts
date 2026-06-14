type LogLevel = "info" | "warn" | "error";

function sanitize(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }
  const blocked = /token|secret|api.?key|authorization/i;
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      blocked.test(key) ? "[REDACTED]" : item,
    ]),
  );
}

function write(level: LogLevel, event: string, metadata?: unknown): void {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    metadata: sanitize(metadata),
  };
  const output = JSON.stringify(payload);
  if (level === "error") {
    console.error(output);
  } else if (level === "warn") {
    console.warn(output);
  } else {
    console.info(output);
  }
}

export const logger = {
  info: (event: string, metadata?: unknown) => write("info", event, metadata),
  warn: (event: string, metadata?: unknown) => write("warn", event, metadata),
  error: (event: string, metadata?: unknown) => write("error", event, metadata),
};
