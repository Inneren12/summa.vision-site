/** Lightweight warnings for flag system. */
export function warnFlagTypeMismatch(flagName: string, expected: string, received: string) {
  const msg = `[flags] Type mismatch for "${flagName}": expected ${expected}, received ${received}. Falling back to default.`;
  // Логируем и в dev, и в prod (по умолчанию). Можно отключить через FF_SILENCE_WARNINGS=true
  if (process.env.FF_SILENCE_WARNINGS !== "true") {
    // eslint-disable-next-line no-console
    console.warn(msg);
  }
  return msg;
}

export function typeOfValue(x: unknown): string {
  if (x === null) return "null";
  const t = typeof x;
  if (t !== "object") return t;
  // уточняем "object без enabled"
  if (x && typeof (x as { enabled?: unknown }).enabled !== "boolean") return "object (no enabled)";
  return "object";
}
