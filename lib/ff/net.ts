/** Return the left-most IP from X-Forwarded-For. */
export function parseXForwardedFor(header?: string | null): string {
  if (!header) return "unknown";
  const first = header.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "unknown";
}
