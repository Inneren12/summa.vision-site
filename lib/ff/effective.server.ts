import "server-only";

import { cookies } from "next/headers";

import { correlationFromNextContext } from "../metrics/correlation";

import { resolveEffectiveFlag } from "./effective.shared";
import { trackShadowExposure } from "./exposure";
import { FLAG_REGISTRY, type EffectiveFlags, type EffectiveValueFor, type FlagName } from "./flags";
import { unitFromIdSalt } from "./hash";
import { getFeatureFlagsFromHeadersWithSources, type FlagSources } from "./server";
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

function deriveUserId(stableId: string): string | undefined {
  if (stableId.startsWith(STABLEID_USER_PREFIX)) {
    return stableId.slice(STABLEID_USER_PREFIX.length);
  }
  return undefined;
}

export type FlagsWithMeta = {
  flags: EffectiveFlags;
  sources: FlagSources;
  stableId: string;
  userId?: string;
};

type GetFlagOpts = { userId?: string; cookieHeader?: string };

/** Вычисляет "эффективные" флаги (булево/строка/число) для SSR/RSC, учитывая percent/overrides. */
export async function getFlagsServerWithMeta(opts?: { userId?: string }): Promise<FlagsWithMeta> {
  const cookieHeader = buildCookieHeaderString();
  const { merged, sources } = await getFeatureFlagsFromHeadersWithSources({ cookie: cookieHeader });
  const id = buildStableId(opts?.userId);
  const userId = deriveUserId(id);
  const correlation = correlationFromNextContext();
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
    const value = resolveEffectiveFlag(name, raw, id, unitForSalt, {
      onShadow: ({ value: shadowValue }) => {
        if (!shadowValue) return;
        trackShadowExposure({
          flag: name,
          value: shadowValue,
          source: sources[name] ?? "default",
          stableId: id,
          userId,
        });
      },
    });
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
      type: "evaluation",
      requestId: correlation.requestId,
      sessionId: correlation.sessionId,
      namespace: correlation.namespace,
    });
  }
  return {
    flags: out as EffectiveFlags,
    sources,
    stableId: id,
    userId,
  };
}

export async function getFlagsServer(opts?: { userId?: string }): Promise<EffectiveFlags> {
  const { flags } = await getFlagsServerWithMeta(opts);
  return flags;
}

/** Ленивая серверная резолюция одного флага по имени (без вычисления всех флагов). */
export async function getFlagServer<N extends FlagName>(
  name: N,
  opts?: GetFlagOpts,
): Promise<EffectiveValueFor<N>> {
  const cookieHeader = opts?.cookieHeader ?? buildCookieHeaderString();
  const { merged } = await getFeatureFlagsFromHeadersWithSources({ cookie: cookieHeader });
  const id = buildStableId(opts?.userId);
  const raw = Object.prototype.hasOwnProperty.call(merged, name)
    ? (merged as Record<string, unknown>)[name]
    : undefined;
  return resolveEffectiveFlag(name, raw, id) as EffectiveValueFor<N>;
}

/** Вариант с источником и стабильным ID — когда нужна телеметрия/экспозиции. */
export async function getFlagServerWithMeta<N extends FlagName>(
  name: N,
  opts?: GetFlagOpts,
): Promise<{
  value: EffectiveValueFor<N>;
  source: "global" | "override" | "env" | "default";
  stableId: string;
}> {
  const cookieHeader = opts?.cookieHeader ?? buildCookieHeaderString();
  const { merged, sources } = await getFeatureFlagsFromHeadersWithSources({ cookie: cookieHeader });
  const id = buildStableId(opts?.userId);
  const correlation = correlationFromNextContext();
  const unitForSalt = (salt: string, mode: "rollout" | "variant" = "rollout") => {
    if (mode === "variant") return unitFromVariantSalt(id, salt);
    return unitFromIdSalt(id, salt);
  };
  const source = sources[name] ?? "default";
  const userId = deriveUserId(id);
  const start = Date.now();
  const raw = Object.prototype.hasOwnProperty.call(merged, name)
    ? (merged as Record<string, unknown>)[name]
    : undefined;
  const value = resolveEffectiveFlag(name, raw, id, unitForSalt, {
    onShadow: ({ value: shadowValue }) => {
      if (!shadowValue) return;
      trackShadowExposure({
        flag: name,
        value: shadowValue,
        source,
        stableId: id,
        userId,
      });
    },
  }) as EffectiveValueFor<N>;
  const end = Date.now();
  trackFlagEvaluation({
    ts: end,
    flag: name,
    value,
    source,
    stableId: id,
    userId,
    evaluationTime: end - start,
    cacheHit: false,
    type: "evaluation",
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    namespace: correlation.namespace,
  });
  return { value, source, stableId: id };
}
