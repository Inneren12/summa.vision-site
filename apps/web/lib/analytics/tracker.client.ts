"use client";

import type { EventOptions } from "plausible-tracker";

import { isServiceAllowed } from "./consent.client";
import { canSendAnalytics } from "./send";

import type { ConsentServiceName } from "@/config/klaro.config";

const TEST_ENV = typeof process !== "undefined" && process.env.NODE_ENV === "test";
const ANALYTICS_DOMAIN = process.env.NEXT_PUBLIC_ANALYTICS_DOMAIN?.trim() ?? "";
const ANALYTICS_API_HOST = process.env.NEXT_PUBLIC_ANALYTICS_API_HOST?.trim() ?? "";

const SERVICE_FOR_EVENT: Record<StoryAnalyticsEventName, ConsentServiceName | null> = {
  story_view: "analytics",
  step_view: "analytics",
  step_exit: "analytics",
  share_click: "share",
  progress_render: null,
  progress_click: null,
};

type PlausibleTracker = {
  trackEvent: (eventName: string, options?: EventOptions) => void;
};

type StoryAnalyticsEventName =
  | "story_view"
  | "step_view"
  | "step_exit"
  | "share_click"
  | "progress_render"
  | "progress_click";

type StoryEventDetail = {
  readonly storyId: string;
  readonly stepId?: string;
  readonly stepIndex?: number;
  readonly stepCount?: number;
};

type VitalMetricDetail = {
  readonly metric: string;
  readonly value: number;
  readonly rating?: string;
};

let trackerPromise: Promise<PlausibleTracker | null> | null = null;

const isClient = (): boolean => typeof window !== "undefined";

const loadTracker = async (): Promise<PlausibleTracker | null> => {
  if (trackerPromise) {
    return trackerPromise;
  }
  if (!isClient() || TEST_ENV) {
    return null;
  }
  if (!ANALYTICS_DOMAIN) {
    return null;
  }

  trackerPromise = import("plausible-tracker")
    .then((mod) => {
      const createTracker = mod.default;
      const tracker = createTracker({
        domain: ANALYTICS_DOMAIN,
        apiHost: ANALYTICS_API_HOST || undefined,
        hashMode: false,
        trackLocalhost: false,
      });
      return { trackEvent: tracker.trackEvent } as PlausibleTracker;
    })
    .catch(() => null);

  return trackerPromise;
};

const withTracker = async (
  callback: (tracker: PlausibleTracker) => void | Promise<void>,
): Promise<void> => {
  const tracker = await loadTracker();
  if (!tracker) {
    return;
  }
  try {
    await callback(tracker);
  } catch {
    // ignore runtime tracker errors
  }
};

const sanitizeValue = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number.parseFloat(value.toFixed(2));
};

const shouldSend = (service: ConsentServiceName | null): boolean => {
  if (!service) {
    return false;
  }
  if (TEST_ENV) {
    return false;
  }
  if (!canSendAnalytics()) {
    return false;
  }
  return isServiceAllowed(service);
};

export const recordStoryEvent = (
  event: StoryAnalyticsEventName,
  detail: StoryEventDetail,
): void => {
  const service = SERVICE_FOR_EVENT[event];
  if (!shouldSend(service)) {
    return;
  }

  void withTracker((tracker) => {
    const props: Record<string, string | number | boolean> = { story: detail.storyId };
    if (typeof detail.stepCount === "number") {
      props.steps = detail.stepCount;
    }
    if (detail.stepId) {
      props.step = detail.stepId;
    }
    if (typeof detail.stepIndex === "number" && Number.isFinite(detail.stepIndex)) {
      props.index = detail.stepIndex;
    }
    tracker.trackEvent(event, { props });
  });
};

export const recordVitalMetric = (detail: VitalMetricDetail): void => {
  if (!shouldSend("vitals")) {
    return;
  }

  void withTracker((tracker) => {
    const props: Record<string, string | number | boolean> = {
      metric: detail.metric,
      value: sanitizeValue(detail.value),
    };
    if (detail.rating) {
      props.rating = detail.rating;
    }
    tracker.trackEvent("vitals", { props });
  });
};
