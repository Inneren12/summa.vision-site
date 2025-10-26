"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

export type StoryAnalyticsEventName =
  | "story_view"
  | "step_view"
  | "step_exit"
  | "share_click"
  | "progress_render"
  | "progress_click";

export type StoryAnalyticsController = {
  trackStoryView: () => void;
  handleStepChange: (stepId: string | null, stepIndex: number) => void;
  trackShareClick: () => void;
  trackProgressRender: () => void;
  trackProgressClick: (stepId: string, stepIndex: number) => void;
  flush: () => void;
};

export const STEP_EXIT_DELAY_MS = 600;

const NECESSARY_EVENTS = new Set<StoryAnalyticsEventName>(["story_view", "step_view"]);

const DNT_ENABLED_VALUES = new Set(["1", "yes", "true"]);

const ANALYTICS_ENDPOINT =
  process.env.NEXT_PUBLIC_STORY_ANALYTICS_URL || "/api/dev/analytics/story";

type ConsentLevel = "all" | "necessary";

type PendingStep = { id: string; index: number };

type SendEventDetail = { stepId?: string; stepIndex?: number };

type UseStoryAnalyticsOptions = {
  storyId?: string;
  stepCount: number;
};

function resolveStoryId(explicit?: string): string | undefined {
  const normalized = explicit?.trim();
  if (normalized) {
    return normalized;
  }
  if (typeof window !== "undefined") {
    const url = window.location;
    const pathname = url.pathname.replace(/^\/+/, "");
    return pathname || "root";
  }
  return undefined;
}

function readConsentFromCookies(): ConsentLevel {
  if (typeof document === "undefined") {
    return "necessary";
  }
  const cookies = document.cookie?.split(";") ?? [];
  for (const part of cookies) {
    const segment = part.trim();
    if (!segment) continue;
    const [name, ...rest] = segment.split("=");
    if (name !== "sv_consent") continue;
    const value = rest.join("=");
    try {
      const decoded = decodeURIComponent(value).trim().toLowerCase();
      if (decoded === "all") return "all";
      if (decoded === "necessary") return "necessary";
    } catch {
      const normalized = value.trim().toLowerCase();
      if (normalized === "all") return "all";
      if (normalized === "necessary") return "necessary";
    }
  }
  return "necessary";
}

function hasClientDoNotTrackEnabled(): boolean {
  if (typeof navigator !== "undefined") {
    const nav = navigator as Navigator & {
      msDoNotTrack?: string;
      globalPrivacyControl?: boolean;
    };
    if (typeof nav.globalPrivacyControl === "boolean" && nav.globalPrivacyControl) {
      return true;
    }
    const signals = [nav.doNotTrack, nav.msDoNotTrack];
    if (
      signals.some((value) => (value ? DNT_ENABLED_VALUES.has(String(value).toLowerCase()) : false))
    ) {
      return true;
    }
  }
  if (typeof window !== "undefined") {
    const win = window as typeof window & { doNotTrack?: string };
    const signal = win.doNotTrack;
    if (signal && DNT_ENABLED_VALUES.has(String(signal).toLowerCase())) {
      return true;
    }
  }
  return false;
}

function buildPayload(
  storyId: string,
  stepCount: number,
  event: StoryAnalyticsEventName,
  detail: SendEventDetail,
) {
  const payload: Record<string, unknown> = {
    event,
    storyId,
    ts: new Date().toISOString(),
  };
  if (stepCount > 0) {
    payload.stepCount = stepCount;
  }
  if (detail.stepId) {
    payload.stepId = detail.stepId;
  }
  if (typeof detail.stepIndex === "number" && detail.stepIndex >= 0) {
    payload.stepIndex = detail.stepIndex;
  }
  if (typeof window !== "undefined") {
    payload.url = window.location.href;
  }
  return payload;
}

function sendAnalyticsEvent(
  storyId: string,
  stepCount: number,
  event: StoryAnalyticsEventName,
  detail: SendEventDetail,
  consent: ConsentLevel,
) {
  const payload = buildPayload(storyId, stepCount, event, detail);
  try {
    void fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-consent": consent,
      },
      keepalive: true,
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  } catch {
    // Ignore transport failures.
  }
}

export function useStoryAnalytics(options: UseStoryAnalyticsOptions): StoryAnalyticsController {
  const { storyId: explicitStoryId, stepCount } = options;
  const storyIdRef = useRef<string | undefined>(resolveStoryId(explicitStoryId));
  const stepCountRef = useRef<number>(stepCount);
  const visitedStepsRef = useRef<Set<string>>(new Set());
  const lastStepRef = useRef<PendingStep | null>(null);
  const pendingExitRef = useRef<PendingStep | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyViewedRef = useRef(false);
  const progressRenderedRef = useRef(false);
  const dntEnabled = useMemo(() => hasClientDoNotTrackEnabled(), []);

  useEffect(() => {
    storyIdRef.current = resolveStoryId(explicitStoryId);
  }, [explicitStoryId]);

  useEffect(() => {
    stepCountRef.current = stepCount;
  }, [stepCount]);

  const sendEvent = useCallback(
    (event: StoryAnalyticsEventName, detail: SendEventDetail = {}) => {
      if (dntEnabled) {
        return;
      }
      const storyId = storyIdRef.current;
      if (!storyId) {
        return;
      }
      const consent = readConsentFromCookies();
      if (consent === "necessary" && !NECESSARY_EVENTS.has(event)) {
        return;
      }
      sendAnalyticsEvent(storyId, stepCountRef.current, event, detail, consent);
    },
    [dntEnabled],
  );

  const flushExit = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    if (pendingExitRef.current) {
      const detail = pendingExitRef.current;
      sendEvent("step_exit", { stepId: detail.id, stepIndex: detail.index });
      pendingExitRef.current = null;
    }
  }, [sendEvent]);

  const trackStoryView = useCallback(() => {
    if (storyViewedRef.current) {
      return;
    }
    storyViewedRef.current = true;
    sendEvent("story_view");
  }, [sendEvent]);

  const handleStepChange = useCallback(
    (stepId: string | null, stepIndex: number) => {
      if (stepId) {
        if (!visitedStepsRef.current.has(stepId)) {
          visitedStepsRef.current.add(stepId);
          sendEvent("step_view", { stepId, stepIndex });
        }
      }
      const previous = lastStepRef.current;
      if (previous && (!stepId || previous.id !== stepId)) {
        if (exitTimerRef.current) {
          clearTimeout(exitTimerRef.current);
        }
        pendingExitRef.current = previous;
        exitTimerRef.current = setTimeout(() => {
          if (pendingExitRef.current) {
            const detail = pendingExitRef.current;
            sendEvent("step_exit", { stepId: detail.id, stepIndex: detail.index });
            pendingExitRef.current = null;
          }
          exitTimerRef.current = null;
        }, STEP_EXIT_DELAY_MS);
      }
      lastStepRef.current =
        stepId && stepIndex >= 0
          ? { id: stepId, index: stepIndex }
          : stepId
            ? { id: stepId, index: -1 }
            : null;
    },
    [sendEvent],
  );

  const trackShareClick = useCallback(() => {
    sendEvent("share_click");
  }, [sendEvent]);

  const trackProgressRender = useCallback(() => {
    if (progressRenderedRef.current) {
      return;
    }
    progressRenderedRef.current = true;
    sendEvent("progress_render", {});
  }, [sendEvent]);

  const trackProgressClick = useCallback(
    (stepId: string, stepIndex: number) => {
      sendEvent("progress_click", { stepId, stepIndex });
    },
    [sendEvent],
  );

  useEffect(
    () => () => {
      flushExit();
    },
    [flushExit],
  );

  return useMemo(
    () => ({
      trackStoryView,
      handleStepChange,
      trackShareClick,
      trackProgressRender,
      trackProgressClick,
      flush: flushExit,
    }),
    [
      flushExit,
      handleStepChange,
      trackProgressClick,
      trackProgressRender,
      trackShareClick,
      trackStoryView,
    ],
  );
}
