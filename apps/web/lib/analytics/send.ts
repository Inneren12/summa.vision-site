import type { VizEventDetail, VizEventName } from "../viz/types";

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
) => boolean | void | Promise<boolean | void>;

type SendAnalyticsEventOptions<TName extends string, TDetail extends AnalyticsDetail> = {
  readonly name: TName;
  readonly detail: TDetail;
  readonly isNecessary?: boolean;
  readonly transport: AnalyticsTransport<TName, TDetail>;
};

type AnalyticsContext = {
  readonly href?: string;
  readonly path?: string;
  readonly referrer?: string;
  readonly locale?: string;
};

type QueuedAnalyticsEvent = AnalyticsEnvelope<string, AnalyticsDetail> & {
  readonly context: AnalyticsContext;
};

type TrackEventOptions<TDetail extends AnalyticsDetail = AnalyticsDetail> = {
  readonly name: string;
  readonly detail?: TDetail;
  readonly isNecessary?: boolean;
  readonly sampleRate?: number;
};

const STORAGE_KEY = "__sv_analytics_queue__";
const BATCH_SIZE = 20;
const MIN_FLUSH_INTERVAL_MS = 2_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const FALLBACK_SAMPLE_RATE = 1;
const MAX_QUEUE_LENGTH = 400;

const ENV_SAMPLE_RATE = Number.parseFloat(process.env.NEXT_PUBLIC_ANALYTICS_SAMPLE_RATE ?? "");

const DEFAULT_SAMPLE_RATE = Number.isFinite(ENV_SAMPLE_RATE)
  ? Math.min(Math.max(ENV_SAMPLE_RATE, 0), 1)
  : FALLBACK_SAMPLE_RATE;

const ENV_BATCH_RATE = Number.parseInt(
  process.env.NEXT_PUBLIC_ANALYTICS_MAX_BATCHES_PER_MINUTE ?? "",
  10,
);

const MAX_BATCHES_PER_MINUTE =
  Number.isFinite(ENV_BATCH_RATE) && ENV_BATCH_RATE > 0 ? ENV_BATCH_RATE : 12;

const ANALYTICS_ENDPOINT = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim() || "/api/analytics";

let flushTimer: ReturnType<typeof setTimeout> | null = null;
let isFlushing = false;
let lastFlushTimestamp = 0;
let rateLimitWindowStart = 0;
let batchesInWindow = 0;

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

function getStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function normalizeQueue(value: unknown): QueuedAnalyticsEvent[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is QueuedAnalyticsEvent => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const candidate = item as Partial<QueuedAnalyticsEvent>;
    return (
      typeof candidate.name === "string" &&
      typeof candidate.timestamp === "string" &&
      typeof candidate.consent === "string" &&
      typeof candidate.detail === "object" &&
      candidate.detail !== null &&
      typeof candidate.context === "object" &&
      candidate.context !== null
    );
  });
}

function loadQueue(): QueuedAnalyticsEvent[] {
  const storage = getStorage();
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    return normalizeQueue(parsed);
  } catch {
    return [];
  }
}

function saveQueue(queue: readonly QueuedAnalyticsEvent[]): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    // Ignore storage errors.
  }
}

function collectContext(): AnalyticsContext {
  if (typeof window === "undefined") {
    return {};
  }
  const context: AnalyticsContext = {};
  try {
    context.href = window.location?.href;
    context.path = window.location?.pathname;
  } catch {
    // Ignore location access failures.
  }
  try {
    const doc = window.document;
    if (doc) {
      context.referrer = doc.referrer || undefined;
      context.locale = doc.documentElement?.lang || undefined;
    }
  } catch {
    // Ignore document access failures.
  }
  return context;
}

function clampSampleRate(rate: number | undefined): number {
  if (typeof rate !== "number" || !Number.isFinite(rate)) {
    return DEFAULT_SAMPLE_RATE;
  }
  if (rate <= 0) {
    return 0;
  }
  if (rate >= 1) {
    return 1;
  }
  return rate;
}

function shouldSample(rate: number | undefined): boolean {
  const normalized = clampSampleRate(rate);
  if (normalized <= 0) {
    return false;
  }
  if (normalized >= 1) {
    return true;
  }
  return Math.random() < normalized;
}

function enforceQueueLimit(queue: QueuedAnalyticsEvent[]): QueuedAnalyticsEvent[] {
  if (queue.length <= MAX_QUEUE_LENGTH) {
    return queue;
  }
  return queue.slice(queue.length - MAX_QUEUE_LENGTH);
}

function enqueue(event: QueuedAnalyticsEvent): void {
  const queue = loadQueue();
  queue.push(event);
  const trimmed = enforceQueueLimit(queue);
  saveQueue(trimmed);
  const shouldFlushImmediately = trimmed.length >= BATCH_SIZE;
  scheduleFlush(shouldFlushImmediately ? 0 : undefined);
}

function scheduleFlush(delayOverride?: number): void {
  if (typeof window === "undefined") {
    return;
  }
  const queue = loadQueue();
  if (!queue.length) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    return;
  }
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  const now = Date.now();
  const minDelay = Math.max(0, MIN_FLUSH_INTERVAL_MS - (now - lastFlushTimestamp));
  let delay = delayOverride !== undefined ? Math.max(0, delayOverride) : minDelay;
  if (delayOverride !== undefined) {
    delay = Math.max(delay, minDelay);
  }
  flushTimer = window.setTimeout(() => {
    flushTimer = null;
    void flushQueue();
  }, delay);
}

function isNavigatorOnline(): boolean {
  if (typeof navigator === "undefined") {
    return true;
  }
  if (typeof navigator.onLine === "boolean") {
    return navigator.onLine;
  }
  return true;
}

function resetRateLimitWindow(now: number): void {
  rateLimitWindowStart = now;
  batchesInWindow = 0;
}

function canSendBatch(now: number): boolean {
  if (now - rateLimitWindowStart >= RATE_LIMIT_WINDOW_MS) {
    resetRateLimitWindow(now);
  }
  return batchesInWindow < MAX_BATCHES_PER_MINUTE;
}

async function sendBatch(batch: QueuedAnalyticsEvent[]): Promise<boolean> {
  if (!batch.length) {
    return true;
  }
  const payload = JSON.stringify(batch);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon(ANALYTICS_ENDPOINT, blob)) {
        return true;
      }
    } catch {
      // Ignore sendBeacon errors and fall back to fetch.
    }
  }
  try {
    const response = await fetch(ANALYTICS_ENDPOINT, {
      method: "POST",
      keepalive: true,
      headers: { "content-type": "application/json" },
      body: payload,
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function flushQueue(): Promise<void> {
  if (isFlushing) {
    return;
  }
  if (typeof window === "undefined") {
    return;
  }
  const queue = loadQueue();
  if (!queue.length) {
    return;
  }
  if (!isNavigatorOnline()) {
    scheduleFlush();
    return;
  }
  const now = Date.now();
  if (!canSendBatch(now)) {
    const delay = Math.max(0, rateLimitWindowStart + RATE_LIMIT_WINDOW_MS - now);
    scheduleFlush(delay);
    return;
  }
  isFlushing = true;
  const batch = queue.slice(0, BATCH_SIZE);
  const remaining = queue.slice(batch.length);
  saveQueue(remaining);
  lastFlushTimestamp = now;
  const success = await sendBatch(batch);
  if (!success) {
    const current = loadQueue();
    saveQueue(batch.concat(current));
    isFlushing = false;
    scheduleFlush(MIN_FLUSH_INTERVAL_MS);
    return;
  }
  batchesInWindow += 1;
  isFlushing = false;
  if (loadQueue().length) {
    scheduleFlush();
  }
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
  if (hasClientDoNotTrackEnabled()) {
    return false;
  }

  const consent = readConsentFromCookies();
  if (consent === "necessary" && !options.isNecessary) {
    return false;
  }

  const envelope: AnalyticsEnvelope<TName, TDetail> = {
    name: options.name,
    detail: options.detail,
    timestamp: new Date().toISOString(),
    consent,
  };

  try {
    const result = options.transport(envelope);
    if (result && typeof (result as PromiseLike<unknown>).then === "function") {
      void (result as PromiseLike<unknown>).catch(() => undefined);
      return true;
    }
    return result !== false;
  } catch {
    return false;
  }
}

export function track<TDetail extends AnalyticsDetail = AnalyticsDetail>(
  options: TrackEventOptions<TDetail>,
): boolean {
  const detail = (options.detail ?? {}) as TDetail;
  return sendAnalyticsEvent({
    name: options.name,
    detail,
    isNecessary: options.isNecessary,
    transport: (event) => {
      if (!shouldSample(options.sampleRate)) {
        return true;
      }
      const queued: QueuedAnalyticsEvent = {
        ...event,
        context: collectContext(),
      };
      enqueue(queued);
      return true;
    },
  });
}

export async function flush(): Promise<void> {
  await flushQueue();
}

const NECESSARY_VIZ_EVENTS: ReadonlySet<VizEventName> = new Set([
  "viz_init",
  "viz_ready",
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

if (typeof window !== "undefined") {
  window.addEventListener("online", () => scheduleFlush());
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        void flushQueue();
      }
    });
  }
}

export const __testOnly__ = {
  hasClientDoNotTrackEnabled,
  readConsentFromCookies,
  _loadQueue: loadQueue,
  _saveQueue: saveQueue,
  _scheduleFlush: scheduleFlush,
  _flushQueue: flushQueue,
  _resetRateLimitWindow: resetRateLimitWindow,
};
