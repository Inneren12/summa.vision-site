import { sendAnalyticsEvent } from "./send";
import type { VizAnalyticsContext } from "./vizTypes";

import type { VizEvent } from "@/lib/viz/types";
import { toAnalyticsEventFromViz, toVizAnalyticsEvent } from "@/lib/viz/vizAnalytics";

export async function sendVizAnalytics(
  vizEvent: VizEvent,
  context: VizAnalyticsContext,
): Promise<void> {
  const vizAnalyticsEvent = toVizAnalyticsEvent(vizEvent, context);
  const analyticsEvent = toAnalyticsEventFromViz(vizAnalyticsEvent);
  await sendAnalyticsEvent(analyticsEvent);
}
