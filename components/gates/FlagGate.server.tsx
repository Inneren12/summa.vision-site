import type { ReactNode } from "react";

import { getFlagsServerWithMeta } from "../../lib/ff/effective.server";
import { trackExposure } from "../../lib/ff/exposure";
import { FLAG_REGISTRY, type FlagName, type EffectiveValueFor } from "../../lib/ff/flags";
import { stableId as buildStableId } from "../../lib/ff/stable-id";

type Props<N extends FlagName = FlagName> = {
  name: N;
  equals?: EffectiveValueFor<N>;
  fallback?: ReactNode;
  children: ReactNode;
  /** Опционально: принудительно использовать userId как stableId для кросс‑девайс консистентности. */
  userId?: string;
};

export default async function FlagGateServer<N extends FlagName>({
  name,
  equals,
  fallback = null,
  children,
  userId,
}: Props<N>) {
  const {
    flags,
    sources,
    stableId,
    userId: resolvedUserId,
  } = await getFlagsServerWithMeta({ userId });
  const meta = FLAG_REGISTRY[name];
  const value = flags[name];
  const source = sources[name] ?? "default";

  let shouldRender = false;
  if (meta.type === "boolean" || meta.type === "rollout") {
    const expected = (equals as EffectiveValueFor<N> | undefined) ?? true;
    shouldRender = (value as boolean) === expected;
  } else if (meta.type === "string") {
    if (equals === undefined) {
      shouldRender = typeof value === "string" && value.length > 0;
    } else {
      shouldRender = value === equals;
    }
  } else {
    if (equals === undefined) {
      shouldRender = typeof value === "number" ? value !== 0 : Boolean(value);
    } else {
      shouldRender = value === equals;
    }
  }
  if (shouldRender) {
    const effectiveUserId = userId ?? resolvedUserId;
    const sid = stableId ?? buildStableId(effectiveUserId);
    trackExposure({
      flag: name,
      value: value as EffectiveValueFor<N>,
      source,
      stableId: sid,
      userId: effectiveUserId,
    });
  }
  return <>{shouldRender ? children : fallback}</>;
}
