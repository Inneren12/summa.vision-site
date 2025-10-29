const DNT_ENABLED_VALUES = new Set(["1", "yes", "true"]);

type KlaroManager = {
  readonly consents?: Record<string, boolean | undefined>;
};

type KlaroModule = {
  readonly getManager?: () => KlaroManager | undefined;
};

type AnalyticsWindow = typeof window & {
  readonly klaro?: KlaroModule;
  readonly __ANALYTICS_DEV_ALLOW__?: boolean;
  readonly doNotTrack?: string;
};

type AnalyticsNavigator = Navigator & {
  readonly msDoNotTrack?: string;
  readonly globalPrivacyControl?: boolean;
};

function getWindow(): AnalyticsWindow | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window as AnalyticsWindow;
}

function getNavigator(): AnalyticsNavigator | null {
  if (typeof navigator === "undefined") {
    return null;
  }
  return navigator as AnalyticsNavigator;
}

export function dntEnabled(): boolean {
  const nav = getNavigator();
  if (nav) {
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

  const win = getWindow();
  if (win?.doNotTrack && DNT_ENABLED_VALUES.has(String(win.doNotTrack).toLowerCase())) {
    return true;
  }

  return false;
}

export function hasConsent(): boolean {
  const win = getWindow();
  if (!win?.klaro) {
    return false;
  }

  try {
    const manager = win.klaro.getManager?.();
    if (!manager) {
      return false;
    }
    return Boolean(manager.consents?.analytics);
  } catch {
    return false;
  }
}

export function isAllowed(): boolean {
  if (dntEnabled()) {
    return false;
  }

  const win = getWindow();
  if (!win) {
    return false;
  }

  if (!win.klaro) {
    return win.__ANALYTICS_DEV_ALLOW__ === true;
  }

  return hasConsent();
}
