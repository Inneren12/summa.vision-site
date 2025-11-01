import type { VizEvent, VizEventDetail, VizEventName, VizLifecycleEvent } from "../viz/types";

type ConsentLevel = "all" | "necessary";

type AnalyticsDetail = Record<string, unknown>;

type AnalyticsEnvelope<TName extends string, TDetail extends AnalyticsDetail> = {
  readonly name: TName;
  readonly detail: TDetail;
  readonly timestamp: string;
  readonly consent: ConsentLevel;
};

type AnalyticsTransport<TName extends string, TDetail extends AnalyticsDetail> = (
  event: AnalyticsEnvelope<TName, TDetail>,
) => boolean | void;

type SendAnalyticsEventOptions<TName extends string, TDetail extends AnalyticsDetail> = {
  readonly name: TName;
  readonly detail: TDetail;
  readonly isNecessary?: boolean;
  readonly beforeSend?: (event: AnalyticsEnvelope<TName, TDetail>) => void;
  readonly transport: AnalyticsTransport<TName, TDetail>;
};

const DNT_ENABLED_VALUES = new Set(["1", "yes", "true"]);

function hasNavigatorDoNotTrack(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }

  const nav = navigator as Navigator & {
    msDoNotTrack?: string;
    globalPrivacyControl?: boolean;
  };

  if (typeof nav.globalPrivacyControl === "boolean" && nav.globalPrivacyControl) {
    return true;
  }

  const signals = [nav.doNotTrack, nav.msDoNotTrack];
  return signals.some((value) =>
    value ? DNT_ENABLED_VALUES.has(String(value).toLowerCase()) : false,
  );
}

function hasWindowDoNotTrack(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const signal = (window as typeof window & { doNotTrack?: string }).doNotTrack;
  return signal ? DNT_ENABLED_VALUES.has(String(signal).toLowerCase()) : false;
}

function hasClientDoNotTrackEnabled(): boolean {
  return hasNavigatorDoNotTrack() || hasWindowDoNotTrack();
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

export function sendAnalyticsEvent<TName extends string, TDetail extends AnalyticsDetail>(
  options: SendAnalyticsEventOptions<TName, TDetail>,
): boolean {
  const consent = readConsentFromCookies();

  const envelope: AnalyticsEnvelope<TName, TDetail> = {
    name: options.name,
    detail: options.detail,
    timestamp: new Date().toISOString(),
    consent,
  };

  try {
    options.beforeSend?.(envelope);
  } catch {
    // Ignore failures from beforeSend hooks to avoid blocking analytics gating.
  }

  if (hasClientDoNotTrackEnabled()) {
    return false;
  }

  if (consent === "necessary" && !options.isNecessary) {
    return false;
  }

  try {
    const result = options.transport(envelope);
    return result !== false;
  } catch {
    return false;
  }
}

export const NECESSARY_VIZ_EVENTS: ReadonlySet<VizEventName> = new Set([
  "viz_init",
  "viz_ready",
  "viz_error",
  "viz_resized",
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
  if (typeof window === "undefined") {
    return false;
  }

  return sendAnalyticsEvent({
    name,
    detail,
    isNecessary: NECESSARY_VIZ_EVENTS.has(name),
    transport: ({ name: eventName, detail: eventDetail, timestamp }) => {
      const extended: ExtendedVizEventDetail = {
        ...eventDetail,
        name: eventName,
        timestamp,
      };

      const event = new CustomEvent<ExtendedVizEventDetail>(eventName, {
        detail: extended,
        bubbles: false,
      });

      window.dispatchEvent(event);
      return true;
    },
  });
}

type VizLifecyclePayload = {
  readonly type: VizEvent;
  readonly ts: number;
  readonly meta?: Record<string, unknown>;
  readonly timestamp: string;
};

export const NECESSARY_LIFECYCLE_EVENTS: ReadonlySet<VizEvent> = new Set([
  "viz_init",
  "viz_ready",
  "viz_error",
  "viz_resized",
]);

export function emitVizLifecycleEvent(event: VizLifecycleEvent): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  let dispatched = false;

  const dispatchLifecycle = (payload: VizLifecyclePayload) => {
    if (dispatched) {
      return;
    }

    const lifecycleEvent = new CustomEvent<VizLifecyclePayload>("viz_lifecycle", {
      detail: payload,
      bubbles: false,
    });

    window.dispatchEvent(lifecycleEvent);
    dispatched = true;
  };

  const isNecessaryLifecycleEvent = NECESSARY_LIFECYCLE_EVENTS.has(event.type);

  return sendAnalyticsEvent({
    name: event.type,
    detail: {
      ...event.meta,
      ts: event.ts,
    },
    isNecessary: isNecessaryLifecycleEvent,
    beforeSend: ({ name, timestamp }) => {
      const payload: VizLifecyclePayload = {
        type: name,
        ts: event.ts,
        meta: event.meta,
        timestamp,
      };

      // Necessary lifecycle events (init/ready/error/resized) should always reach DOM listeners;
      // consent only gates optional analytics delivery.
      dispatchLifecycle(payload);
    },
    transport: ({ name, timestamp }) => {
      if (!dispatched) {
        dispatchLifecycle({
          type: name,
          ts: event.ts,
          meta: event.meta,
          timestamp,
        });
      }

      return true;
    },
  });
}

export const __testOnly__ = {
  hasClientDoNotTrackEnabled,
  readConsentFromCookies,
};
