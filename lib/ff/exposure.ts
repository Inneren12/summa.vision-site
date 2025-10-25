import { AsyncLocalStorage } from "node:async_hooks";

import { headers } from "next/headers";

import { correlationFromNextContext } from "../metrics/correlation";

import { FLAG_REGISTRY } from "./flags";
import { FF } from "./runtime";

type ExposureKey = string; // `${type}:${flag}:${value}`
const ALS = new AsyncLocalStorage<Set<ExposureKey>>();

export type ExposureSource = "global" | "override" | "env" | "default";

/************************************
 * Internal helpers
 ***********************************/

type ExposureEventType = "exposure" | "exposure_shadow";

function emitExposure(
  type: ExposureEventType,
  params: {
    flag: string;
    value: boolean | string | number;
    source: ExposureSource;
    stableId: string;
    userId?: string;
  },
) {
  // Уважение DNT (Do-Not-Track)
  try {
    if (headers().get("dnt") === "1") return;
  } catch {
    /* ignore: headers() is unavailable outside a request context */
  }

  // Редактирование чувствительных значений
  const meta = FLAG_REGISTRY[params.flag as keyof typeof FLAG_REGISTRY];
  const safeValue = meta?.sensitive ? "[redacted]" : params.value;

  const set = ALS.getStore();
  if (set) {
    const key = `${type}:${params.flag}:${String(params.value)}`;
    if (set.has(key)) return; // already logged in this SSR scope
    set.add(key);
  }
  const correlation = correlationFromNextContext();
  FF().telemetrySink.emit({
    ts: Date.now(),
    type,
    flag: params.flag,
    value: safeValue,
    source: params.source,
    stableId: params.stableId,
    userId: params.userId,
    requestId: correlation.requestId,
    sessionId: correlation.sessionId,
    namespace: correlation.namespace,
  });
}

/** Обернуть SSR-рендер запроса: гарантирует дедуп экспозиций в его пределах. */
export function withExposureContext<T>(fn: () => T): T {
  return ALS.run(new Set<ExposureKey>(), fn);
}

export function trackExposure(params: {
  flag: string;
  value: boolean | string | number;
  source: ExposureSource;
  stableId: string;
  userId?: string;
}) {
  emitExposure("exposure", params);
}

export function trackShadowExposure(params: {
  flag: string;
  value: boolean | string | number;
  source: ExposureSource;
  stableId: string;
  userId?: string;
}) {
  emitExposure("exposure_shadow", params);
}
