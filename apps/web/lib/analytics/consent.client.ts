"use client";

import { CONSENT_SERVICES, type ConsentServiceName, klaroConfig } from "@/config/klaro.config";

const TEST_ENV = typeof process !== "undefined" && process.env.NODE_ENV === "test";

const CONSENT_COOKIE_NAME = "sv_consent";
const CONSENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
const STORAGE_NAME = klaroConfig.storageName || "klaro";

type ConsentState = Record<ConsentServiceName, boolean>;

type KlaroModule = {
  readonly setup: (config: typeof klaroConfig) => void;
  readonly getManager: (config?: typeof klaroConfig) => KlaroManager;
  readonly show: (config?: typeof klaroConfig) => void;
};

type KlaroWatcher = {
  update: (manager: KlaroManager, eventName: string, data: unknown) => void;
};

type KlaroManager = {
  readonly consents: Record<string, boolean | undefined>;
  watch: (watcher: KlaroWatcher) => void;
  unwatch: (watcher: KlaroWatcher) => void;
};

const defaultConsentState = (): ConsentState => ({
  analytics: false,
  vitals: false,
  share: false,
});

const listeners = new Set<(state: ConsentState) => void>();
let managerWatcherAttached = false;
let klaroPromise: Promise<KlaroModule | null> | null = null;
let managerPromise: Promise<KlaroManager | null> | null = null;
let currentState: ConsentState = defaultConsentState();

const readCookieValue = (name: string): string | null => {
  if (typeof document === "undefined") {
    return null;
  }

  const entries = document.cookie?.split(";") ?? [];
  for (const part of entries) {
    const segment = part.trim();
    if (!segment) continue;
    const [cookieName, ...rest] = segment.split("=");
    if (cookieName !== name) continue;
    return rest.join("=");
  }
  return null;
};

const decodeConsents = (raw: string | null): Partial<ConsentState> | undefined => {
  if (!raw) {
    return undefined;
  }

  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") {
      return undefined;
    }

    const state = defaultConsentState();
    for (const service of CONSENT_SERVICES) {
      const value = parsed[service];
      state[service] = Boolean(value);
    }
    return state;
  } catch {
    return undefined;
  }
};

const readStoredConsents = (): ConsentState => {
  if (typeof document === "undefined") {
    return defaultConsentState();
  }

  const stored = decodeConsents(readCookieValue(STORAGE_NAME));
  if (stored) {
    return stored as ConsentState;
  }
  return defaultConsentState();
};

const secureAttribute = (): string => {
  if (typeof location === "undefined") {
    return "";
  }
  return location.protocol === "https:" ? "; Secure" : "";
};

const writeConsentCookie = (state: ConsentState): void => {
  if (typeof document === "undefined") {
    return;
  }
  const anyOptional = CONSENT_SERVICES.some((service) => state[service]);
  const value = anyOptional ? "all" : "necessary";
  document.cookie = `${CONSENT_COOKIE_NAME}=${value}; Max-Age=${CONSENT_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secureAttribute()}`;
};

const notifyListeners = (state: ConsentState): void => {
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      // Ignore listener failures.
    }
  });
};

const applyConsentState = (next: ConsentState): void => {
  let changed = false;
  for (const key of CONSENT_SERVICES) {
    if (currentState[key] !== next[key]) {
      changed = true;
      break;
    }
  }

  currentState = next;
  writeConsentCookie(currentState);
  if (changed) {
    notifyListeners(currentState);
  }
};

const extractManagerState = (manager: KlaroManager | null): ConsentState => {
  if (!manager) {
    return defaultConsentState();
  }

  const state = defaultConsentState();
  for (const service of CONSENT_SERVICES) {
    state[service] = Boolean(manager.consents?.[service]);
  }
  return state;
};

const watcher: KlaroWatcher = {
  update(manager, eventName) {
    if (eventName === "consents" || eventName === "saveConsents") {
      applyConsentState(extractManagerState(manager));
    }
  },
};

const ensureWatcher = (manager: KlaroManager | null): void => {
  if (!manager || managerWatcherAttached) {
    return;
  }
  manager.watch(watcher);
  managerWatcherAttached = true;
  applyConsentState(extractManagerState(manager));
};

const loadKlaro = async (): Promise<KlaroModule | null> => {
  if (klaroPromise) {
    return klaroPromise;
  }
  if (typeof window === "undefined" || TEST_ENV) {
    return null;
  }
  klaroPromise = import("klaro/dist/klaro-no-css.js")
    .then((mod) => mod as KlaroModule)
    .catch(() => null);
  return klaroPromise;
};

const initManager = async (): Promise<KlaroManager | null> => {
  if (managerPromise) {
    return managerPromise;
  }
  if (typeof window === "undefined" || TEST_ENV) {
    return null;
  }
  managerPromise = loadKlaro().then((klaro) => {
    if (!klaro) {
      return null;
    }
    try {
      klaro.setup(klaroConfig);
      const manager = klaro.getManager(klaroConfig);
      ensureWatcher(manager);
      return manager;
    } catch {
      return null;
    }
  });
  return managerPromise;
};

currentState = readStoredConsents();
if (typeof document !== "undefined") {
  writeConsentCookie(currentState);
}

export const getConsentState = (): ConsentState => ({ ...currentState });

export const isServiceAllowed = (service: ConsentServiceName): boolean => currentState[service];

export const subscribeToConsent = (listener: (state: ConsentState) => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const ensureConsentManager = async (): Promise<void> => {
  await initManager();
};

export const showConsentManager = async (): Promise<void> => {
  if (typeof window === "undefined" || TEST_ENV) {
    return;
  }
  const klaro = await loadKlaro();
  if (!klaro) {
    return;
  }
  await initManager();
  try {
    klaro.show(klaroConfig);
  } catch {
    // no-op
  }
};
