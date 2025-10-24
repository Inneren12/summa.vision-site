import "server-only";

import { cookies } from "next/headers";

import { resolveEffectiveFlag } from "./effective.shared";
import { FLAG_REGISTRY, type EffectiveFlags, type FlagName } from "./flags";
import { unitFromIdSalt } from "./hash";
import { getFeatureFlagsFromHeadersWithSources } from "./server";
import { stableId as buildStableId, STABLEID_USER_PREFIX } from "./stable-id";
import { trackFlagEvaluation } from "./telemetry";
import { unitFromVariantSalt } from "./variant";

function buildCookieHeaderString(): string {
  // next/headers cookies() в Next14 синхронен; формируем header-подобную строку для реюза
  const ck = cookies();
  const all = ck.getAll();
  if (!all.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

/** Вычисляет "эффективные" флаги (булево/строка/число) для SSR/RSC, учитывая percent/overrides. */
export async function getFlagsServer(opts?: { userId?: string }): Promise<EffectiveFlags> {
  const cookieHeader = buildCookieHeaderString();
  const { merged, sources } = await getFeatureFlagsFromHeadersWithSources({ cookie: cookieHeader });
  const id = buildStableId(opts?.userId);
  const userId = id.startsWith(STABLEID_USER_PREFIX)
    ? id.slice(STABLEID_USER_PREFIX.length)
    : undefined;
  const out: Partial<EffectiveFlags> = {};
  const rolloutUnits = new Map<string, number>();
  const variantUnits = new Map<string, number>();
  const unitForSalt = (salt: string, mode: "rollout" | "variant" = "rollout") => {
    if (mode === "variant") {
      if (!variantUnits.has(salt)) {
        variantUnits.set(salt, unitFromVariantSalt(id, salt));
      }
      return variantUnits.get(salt)!;
    }
    if (!rolloutUnits.has(salt)) {
      rolloutUnits.set(salt, unitFromIdSalt(id, salt));
    }
    return rolloutUnits.get(salt)!;
  };
  for (const name of Object.keys(FLAG_REGISTRY) as FlagName[]) {
    const start = Date.now();
    const raw = Object.prototype.hasOwnProperty.call(merged, name) ? merged[name] : undefined;
    const value = resolveEffectiveFlag(name, raw, id, unitForSalt);
    const end = Date.now();
    const evaluationTime = end - start;
    out[name] = value as EffectiveFlags[typeof name];
    trackFlagEvaluation({
      ts: end,
      flag: name,
      value,
      source: sources[name] ?? "default",
      stableId: id,
      userId,
      evaluationTime,
      cacheHit: false,
    });
  }
  return out as EffectiveFlags;
}
