const STORAGE_KEY = "sv:field-metrics-sampled";
const SAMPLE_RATE = 0.15;

const TEST_ENV = typeof process !== "undefined" && process.env.NODE_ENV === "test";

let cachedDecision: boolean | null = null;

const safeSessionStorage = (): Storage | null => {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.sessionStorage ?? null;
  } catch {
    return null;
  }
};

const readStoredDecision = (): boolean | null => {
  const storage = safeSessionStorage();
  if (!storage) {
    return null;
  }
  const stored = storage.getItem(STORAGE_KEY);
  if (stored === "1") {
    return true;
  }
  if (stored === "0") {
    return false;
  }
  return null;
};

const writeStoredDecision = (value: boolean): void => {
  const storage = safeSessionStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // Ignore storage write failures (e.g. Safari private mode).
  }
};

export const getFieldMetricsSampleRate = (): number => SAMPLE_RATE;

export const isFieldMetricsSamplingEnabled = (): boolean => {
  if (cachedDecision !== null) {
    return cachedDecision;
  }
  if (TEST_ENV) {
    cachedDecision = false;
    return cachedDecision;
  }
  if (typeof window === "undefined") {
    cachedDecision = false;
    return cachedDecision;
  }

  const stored = readStoredDecision();
  if (stored !== null) {
    cachedDecision = stored;
    return stored;
  }

  const sampled = Math.random() < SAMPLE_RATE;
  cachedDecision = sampled;
  writeStoredDecision(sampled);
  return sampled;
};
