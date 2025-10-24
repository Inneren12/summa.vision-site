import { evaluateFlag } from "./core/eval/evaluate";
import type { FlagConfig, SegCtx, Seeds } from "./core/ports";

/** Чистая функция — удобно тестировать. */
export function buildSnapshotFromList(flags: FlagConfig[], seeds: Seeds, ctx: SegCtx): string {
  const map = new Map<string, string>();

  for (const flag of flags) {
    const { value } = evaluateFlag({
      cfg: flag,
      seeds,
      ctx,
      overrides: {},
      rolloutPct: undefined,
    });
    map.set(`${flag.namespace}:${flag.key}`, value ? "on" : "off");
  }

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join(";");
}
