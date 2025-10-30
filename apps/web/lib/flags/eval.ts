export type Overrides = Record<string, boolean>;

export function parseOverridesCookie(raw?: string): Overrides {
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter(([, value]) => typeof value === "boolean")
      .map(([key, value]) => [key, value as boolean]);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function bucketOfId(id: string): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}

export function gatePercent({
  overrides,
  id,
  percent,
}: {
  overrides: Overrides;
  id: string;
  percent: number;
}): boolean {
  const overrideValue = overrides.newcheckout;
  if (typeof overrideValue === "boolean") {
    return overrideValue;
  }
  if (!id) {
    return false;
  }
  const clamped = Math.max(0, Math.min(100, percent));
  return bucketOfId(id) < clamped;
}
