export type Overrides = Record<string, boolean>;

export function parseOverridesCookie(raw: string | undefined): Overrides {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed as Record<string, unknown>)
        .filter(([, value]) => typeof value === "boolean")
        .map(([key, value]) => [key, value as boolean]),
    );
  } catch {
    return {};
  }
}

export function bucketOfId(id: string): number {
  let hash = 0x811c9dc5 >>> 0;
  for (let i = 0; i < id.length; i += 1) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}

export function gateBoolean({
  name,
  overrides,
  env,
  envDefault = true,
}: {
  name: string;
  overrides: Overrides;
  env?: string;
  envDefault?: boolean;
}): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, name)) {
    return overrides[name];
  }
  if (env === "dev") {
    return envDefault;
  }
  return false;
}

export function gatePercent({
  name,
  overrides,
  id,
  percent,
  env,
  envDefault = false,
}: {
  name: string;
  overrides: Overrides;
  id: string;
  percent: number;
  env?: string;
  envDefault?: boolean;
}): boolean {
  if (Object.prototype.hasOwnProperty.call(overrides, name)) {
    return overrides[name];
  }
  if (env === "dev" && envDefault) {
    return true;
  }
  if (!id) {
    return false;
  }
  const clamped = Math.max(0, Math.min(100, percent));
  return bucketOfId(id) < clamped;
}
