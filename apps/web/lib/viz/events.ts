// Bridge for viz layer → analytics layer.
// Restores the expected "./events" import used by lazyAdapter.ts.

import { NECESSARY_VIZ_EVENTS } from "../analytics/events";
import { sendAnalyticsEvent } from "../analytics/send";
import type { VizEventDetail, VizEventName } from "../analytics/types";

// Named helper used by viz code.
export function sendVizEvent(
  name: VizEventName,
  detail: VizEventDetail,
  options?: { necessary?: boolean },
) {
  const isNecessary =
    options?.necessary ??
    (typeof NECESSARY_VIZ_EVENTS?.has === "function" && NECESSARY_VIZ_EVENTS.has(name));

  // Cast keeps this bridge tolerant even if AnalyticsDetail is wider.
  return sendAnalyticsEvent({
    name,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detail: detail as any,
    isNecessary,
  });
}

export { NECESSARY_VIZ_EVENTS };
export type { VizEventDetail, VizEventName };

// Optional default export so both
// `import { sendVizEvent } from "./events"` and `import Events from "./events"` work.
const Events = { sendVizEvent, NECESSARY_VIZ_EVENTS };
export default Events;
