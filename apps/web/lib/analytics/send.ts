import { NECESSARY_VIZ_EVENTS } from "./events";
import type { AnalyticsEvent, VizEventDetail, VizEventName } from "./types";

const DNT_ENABLED_VALUES = new Set(["1", "yes", "true"]);

type ConsentLevel = "all" | "necessary";

type ExtendedEventDetail = VizEventDetail & {
  readonly name: VizEventName;
  readonly timestamp: string;
};

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

function hasDoNotTrackEnabled(): boolean {
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

function shouldDispatchEvent(event: AnalyticsEvent<VizEventDetail>): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  if (hasDoNotTrackEnabled()) {
    return false;
  }

  const consent = readConsentFromCookies();
  if (consent === "all") {
    return true;
  }

  const necessary = event.isNecessary ?? NECESSARY_VIZ_EVENTS.has(event.name);
  return necessary;
}

export function sendAnalyticsEvent(event: AnalyticsEvent<VizEventDetail>): boolean {
  if (!shouldDispatchEvent(event)) {
    return false;
  }

  if (typeof window === "undefined") {
    return false;
  }

  const extended: ExtendedEventDetail = {
    ...event.detail,
    name: event.name,
    timestamp: new Date().toISOString(),
  };

  const customEvent = new CustomEvent<ExtendedEventDetail>(event.name, {
    detail: extended,
    bubbles: false,
  });

  window.dispatchEvent(customEvent);
  return true;
}

export function __testOnly__hasDoNotTrackEnabled(): boolean {
  return hasDoNotTrackEnabled();
}

export function __testOnly__readConsentFromCookies(): ConsentLevel {
  return readConsentFromCookies();
}
