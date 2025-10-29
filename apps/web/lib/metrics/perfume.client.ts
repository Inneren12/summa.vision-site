"use client";

import { initPerfume } from "perfume.js";
import type { IAnalyticsTrackerOptions, IVitalsScore } from "perfume.js/dist/types/types";

import { isFieldMetricsSamplingEnabled } from "./sampling";

const TRACKED_METRICS = new Set(["CLS", "FCP", "FID", "INP", "LCP", "TTFB"]);

let initialized = false;

const TEST_ENV = typeof process !== "undefined" && process.env.NODE_ENV === "test";

type GlobalWithPerfumeFlag = typeof window & { __svPerfumeSampled__?: boolean };

const castRating = (rating: IVitalsScore | null | undefined): string | undefined => {
  if (!rating) {
    return undefined;
  }
  if (rating === "needsImprovement") {
    return "needs-improvement";
  }
  return rating;
};

const sendVitalMetric = (
  metricName: string,
  value: number,
  rating: IVitalsScore | null | undefined,
): void => {
  void import("@/lib/analytics/tracker.client")
    .then(({ recordVitalMetric }) => {
      recordVitalMetric({
        metric: metricName,
        value,
        rating: castRating(rating),
      });
    })
    .catch(() => undefined);
};

const tracker = (options: IAnalyticsTrackerOptions): void => {
  if (!TRACKED_METRICS.has(options.metricName)) {
    return;
  }
  if (typeof options.data !== "number" || Number.isNaN(options.data)) {
    return;
  }
  sendVitalMetric(options.metricName, options.data, options.rating);
};

export const startPerfume = (): void => {
  if (initialized || TEST_ENV) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  if (!isFieldMetricsSamplingEnabled()) {
    (window as GlobalWithPerfumeFlag).__svPerfumeSampled__ = false;
    return;
  }

  try {
    initPerfume({
      analyticsTracker: tracker,
    });
    initialized = true;
    (window as GlobalWithPerfumeFlag).__svPerfumeSampled__ = true;
  } catch {
    // Swallow initialization errors to avoid impacting the shell.
  }
};
