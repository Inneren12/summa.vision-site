import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";

import { computeEffectiveFlags, type EffectiveFlags } from "./effective.shared";
import { readOverridesFromCookieHeader } from "./overrides";
import { getFeatureFlags } from "./server";
import { mergeFlags, type FeatureFlags } from "./shared";

function getOverridesFromCookies(): Record<string, boolean | number | string> {
  const ck = cookies();
  const raw = ck.get("sv_flags_override")?.value;
  if (!raw) return {};
  return readOverridesFromCookieHeader(`sv_flags_override=${raw}`);
}

export const getFlagsServer = cache(async (): Promise<EffectiveFlags> => {
  const base = await getFeatureFlags();
  const overrides = getOverridesFromCookies();
  const combined = mergeFlags(base, overrides as FeatureFlags);
  const stableId = cookies().get("sv_id")?.value;
  return computeEffectiveFlags(combined, stableId);
});
