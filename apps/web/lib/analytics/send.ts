import type { VizEventDetail, VizEventName, VizEventType, VizLifecycleEvent } from "../viz/types";

type ConsentLevel = "all" | "necessary";

export interface AnalyticsEvent {
  name: string;
  time?: number;
  payload?: Record<string, unknown>;
  context?: Record<string, unknown>;
  requiredConsent?: ConsentLevel;
}

const CONSENT_COOKIE_NAME = "sv_consent";

export function isDoNotTrackEnabled(): boolean {
  if (typeof window === "undefined") return false;

  const w = window as unknown as { doNotTrack?: string };
  const n = navigator as unknown as { doNotTrack?: string; msDoNotTrack?: string };

  const dnt = w.doNotTrack ?? n.doNotTrack ?? n.msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

const readConsentLevel = (): ConsentLevel => {
  if (typeof document === "undefined") {
    return "necessary";
  }

  const cookies = document.cookie?.split(";") ?? [];
  for (const part of cookies) {
    const segment = part.trim();
    if (!segment) continue;
    const [name, ...rest] = segment.split("=");
    if (name !== CONSENT_COOKIE_NAME) continue;
    const value = rest.join("=").trim().toLowerCase();
    if (value === "all") return "all";
    if (value === "necessary") return "necessary";
  }

  return "necessary";
};

export function hasAnalyticsConsent(required: ConsentLevel = "all"): boolean {
  const level = readConsentLevel();
  // TODO: integrate CMP consent checks (Klaro!/Umami/Plausible) when available.
  if (required === "necessary") {
    return level === "necessary" || level === "all";
  }
  return level === "all";
}

export function canSendAnalytics(required: ConsentLevel = "all"): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (isDoNotTrackEnabled()) {
    return false;
  }

  return hasAnalyticsConsent(required);
}

export async function sendAnalyticsEvent(event: AnalyticsEvent): Promise<void> {
  const requiredConsent = event.requiredConsent ?? "all";
  if (!canSendAnalytics(requiredConsent)) {
    return;
  }

  const time = typeof event.time === "number" ? event.time : Date.now();

  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ ...event, time }),
    });
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[analytics] sendAnalyticsEvent error", error);
    }
  }
}

export const NECESSARY_VIZ_EVENTS: ReadonlySet<VizEventName> = new Set([
  "viz_init",
  "viz_ready",
  "viz_state",
  "viz_error",
  "viz_lazy_mount",
  "viz_prefetch",
  "viz_destroyed",
  "viz_fallback_engaged",
  "viz_data_mapped",
  "viz_motion_mode",
  "viz_spec_load",
]);

type ExtendedVizEventDetail = VizEventDetail & {
  readonly name: VizEventName;
  readonly timestamp: string;
};

export function emitVizEvent(name: VizEventName, detail: VizEventDetail): boolean {
  const consentRequirement: ConsentLevel = NECESSARY_VIZ_EVENTS.has(name) ? "necessary" : "all";

  if (!canSendAnalytics(consentRequirement)) {
    return false;
  }

  const timestamp = new Date().toISOString();
  const extended: ExtendedVizEventDetail = { ...detail, name, timestamp };

  const event = new CustomEvent<ExtendedVizEventDetail>(name, {
    detail: extended,
    bubbles: false,
  });

  window.dispatchEvent(event);

  void sendAnalyticsEvent({
    name,
    time: Date.parse(timestamp),
    payload: detail,
    context: { scope: "viz" },
    requiredConsent: consentRequirement,
  });

  return true;
}

type VizLifecyclePayload = {
  readonly type: VizEventType;
  readonly ts: number;
  readonly meta?: Record<string, unknown>;
  readonly timestamp: string;
};

export const NECESSARY_LIFECYCLE_EVENTS: ReadonlySet<VizEventType> = new Set([
  "viz_init",
  "viz_ready",
  "viz_error",
  "viz_state",
]);

export function emitVizLifecycleEvent(event: VizLifecycleEvent): boolean {
  const consentRequirement: ConsentLevel = NECESSARY_LIFECYCLE_EVENTS.has(event.type)
    ? "necessary"
    : "all";

  if (!canSendAnalytics(consentRequirement)) {
    return false;
  }

  const timestamp = new Date().toISOString();
  const payload: VizLifecyclePayload = {
    type: event.type,
    ts: event.ts,
    meta: event.meta,
    timestamp,
  };

  const lifecycleEvent = new CustomEvent<VizLifecyclePayload>("viz_lifecycle", {
    detail: payload,
    bubbles: false,
  });

  window.dispatchEvent(lifecycleEvent);

  void sendAnalyticsEvent({
    name: event.type,
    time: Date.parse(timestamp),
    payload: { ...(event.meta ?? {}), ts: event.ts },
    context: { scope: "viz_lifecycle" },
    requiredConsent: consentRequirement,
  });

  return true;
}

export const __testOnly__ = {
  hasAnalyticsConsent,
  readConsentLevel,
};
