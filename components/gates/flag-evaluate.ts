import { FLAG_REGISTRY, type EffectiveValueFor, type FlagName } from "@/lib/ff/flags";
import type { FlagKey } from "@/types/flags";

type KeyName = FlagKey & FlagName;

type EvaluateParams<N extends KeyName> = {
  key: N;
  value: EffectiveValueFor<N> | undefined;
  equals?: EffectiveValueFor<N>;
};

export function shouldRenderFlag<N extends KeyName>({
  key,
  value,
  equals,
}: EvaluateParams<N>): boolean {
  const meta = FLAG_REGISTRY[key];
  if (!meta) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Unknown flag "${String(key)}" passed to <FlagGate>.`);
    }
    return false;
  }

  if (meta.type === "boolean" || meta.type === "rollout") {
    const expected = (equals as EffectiveValueFor<N> | undefined) ?? true;
    return (value as boolean) === expected;
  }

  if (meta.type === "string") {
    if (equals === undefined) {
      return typeof value === "string" && value.length > 0;
    }
    return value === equals;
  }

  if (meta.type === "number") {
    if (equals === undefined) {
      return typeof value === "number" ? value !== 0 : Boolean(value);
    }
    return value === equals;
  }

  // variant
  if (equals === undefined) {
    return typeof value === "string" && value.length > 0;
  }
  return value === equals;
}
