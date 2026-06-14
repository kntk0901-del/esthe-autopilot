export function classifyBot(
  userAgent: string | null,
  patterns: string[],
): { isBot: boolean; reason: string | null } {
  if (!userAgent) return { isBot: true, reason: "missing_user_agent" };
  const normalized = userAgent.toLowerCase();
  const match = patterns.find((pattern) =>
    normalized.includes(pattern.toLowerCase()),
  );
  return match
    ? { isBot: true, reason: `user_agent:${match}` }
    : { isBot: false, reason: null };
}
