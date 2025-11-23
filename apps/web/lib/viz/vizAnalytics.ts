import type { VizEvent } from "./types";

import type { AnalyticsEvent } from "@/lib/analytics/send";
import type { VizAnalyticsContext, VizAnalyticsEvent } from "@/lib/analytics/vizTypes";

export function toVizAnalyticsEvent(
  evt: VizEvent,
  baseContext: VizAnalyticsContext,
): VizAnalyticsEvent {
  const { type, ts, meta } = evt;

  const result: VizAnalyticsEvent = {
    type,
    ts,
    context: { ...baseContext },
  };

  if (meta && Object.keys(meta).length > 0) {
    result.meta = meta;
  }

  if (type === "viz_error" && meta) {
    const maybeError = meta.error as Partial<Error> | undefined;
    if (maybeError) {
      result.error = {
        message: maybeError.message?.slice(0, 300),
        name: maybeError.name,
      };
    }
  }

  return result;
}

export function toAnalyticsEventFromViz(v: VizAnalyticsEvent): AnalyticsEvent {
  const { type, ts, context, meta, error } = v;

  const payload: Record<string, unknown> = {
    ...meta,
  };

  if (error) {
    payload.error = {
      name: error.name,
      message: error.message,
      code: error.code,
    };
  }

  return {
    name: type,
    time: ts,
    payload,
    context,
  };
}
