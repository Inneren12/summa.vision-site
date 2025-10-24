import { AsyncLocalStorage } from "node:async_hooks";

import { FF } from "./runtime";

type ExposureKey = string; // `${flag}:${value}`
const ALS = new AsyncLocalStorage<Set<ExposureKey>>();

/** Обернуть SSR-рендер запроса: гарантирует дедуп экспозиций в его пределах. */
export function withExposureContext<T>(fn: () => T): T {
  return ALS.run(new Set<ExposureKey>(), fn);
}

export function trackExposure(params: {
  flag: string;
  value: boolean | string | number;
  source: "global" | "override" | "env" | "default";
  stableId: string;
  userId?: string;
}) {
  const set = ALS.getStore();
  if (set) {
    const key = `${params.flag}:${String(params.value)}`;
    if (set.has(key)) return; // уже логировали на этом SSR
    set.add(key);
  }
  FF().telemetrySink.emit({
    ts: Date.now(),
    type: "exposure",
    flag: params.flag,
    value: params.value,
    source: params.source,
    stableId: params.stableId,
    userId: params.userId,
  });
}
