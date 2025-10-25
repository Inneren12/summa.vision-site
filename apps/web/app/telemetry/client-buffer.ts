type FlushReason = "schedule" | "batch" | "manual" | "retry" | "unload" | "size";

type EventPayload = Record<string, unknown>;

type QueuedEvent = {
  payload: EventPayload;
  size: number;
};

const DEFAULT_BATCH_SIZE = 12;
const DEFAULT_MAX_BYTES = 16 * 1024;
const DEFAULT_FLUSH_INTERVAL = 5_000;
const BASE_RETRY_DELAY = 1_000;
const MAX_RETRY_DELAY = 30_000;

const activeBuffers = new Set<ClientEventBuffer>();
let lifecycleRegistered = false;

function estimateSize(payload: EventPayload): number {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return DEFAULT_MAX_BYTES;
  }
}

function isIosSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || "";
  const isAppleDevice = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  return isAppleDevice && isSafari;
}

function registerLifecycleHooks() {
  if (lifecycleRegistered) return;
  if (typeof window === "undefined") return;

  const flushAll = () => {
    for (const buffer of activeBuffers) {
      void buffer.flush({ reason: "unload" });
    }
  };

  window.addEventListener("pagehide", flushAll);
  window.addEventListener("beforeunload", flushAll);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushAll();
    }
  });

  lifecycleRegistered = true;
}

export type ClientEventBufferOptions = {
  url: string;
  snapshotId: string;
  batchSize?: number;
  maxBytes?: number;
  flushInterval?: number;
};

export type FlushOptions = {
  reason?: FlushReason;
  immediate?: boolean;
};

async function sendWithFetch(
  url: string,
  snapshotId: string,
  events: EventPayload[],
): Promise<boolean> {
  if (typeof fetch === "undefined") return false;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-snapshot": snapshotId,
      },
      body: JSON.stringify({ snapshot: snapshotId, events }),
      keepalive: true,
    });
    return response.ok;
  } catch {
    return false;
  }
}

function buildBeaconUrl(url: string, snapshotId: string): string {
  if (typeof window === "undefined") return url;
  try {
    const resolved = new URL(url, window.location.origin);
    resolved.searchParams.set("snapshot", snapshotId);
    return resolved.toString();
  } catch {
    return url;
  }
}

function sendWithBeacon(url: string, snapshotId: string, events: EventPayload[]): boolean {
  if (typeof navigator === "undefined") return false;
  if (typeof navigator.sendBeacon !== "function") return false;
  if (isIosSafari()) return false;
  try {
    const payload = JSON.stringify({ snapshot: snapshotId, events });
    const blob = new Blob([payload], { type: "application/json" });
    return navigator.sendBeacon(buildBeaconUrl(url, snapshotId), blob);
  } catch {
    return false;
  }
}

export class ClientEventBuffer {
  private queue: QueuedEvent[] = [];
  private queuedBytes = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private pendingReason: FlushReason | null = null;
  private retryCount = 0;

  private readonly url: string;
  private readonly snapshotId: string;
  private readonly batchSize: number;
  private readonly maxBytes: number;
  private readonly flushInterval: number;

  constructor(options: ClientEventBufferOptions) {
    this.url = options.url;
    this.snapshotId = options.snapshotId;
    this.batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    this.flushInterval = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL;

    registerLifecycleHooks();
    activeBuffers.add(this);
  }

  enqueue(payload: EventPayload) {
    const size = estimateSize(payload);
    if (size > this.maxBytes) {
      // Drop oversized payloads to avoid blocking the queue.
      return;
    }

    if (this.queue.length > 0 && this.queuedBytes + size > this.maxBytes) {
      void this.flush({ reason: "size" });
    }

    this.queue.push({ payload, size });
    this.queuedBytes += size;

    if (this.queue.length >= this.batchSize || this.queuedBytes >= this.maxBytes) {
      void this.flush({ reason: "batch", immediate: true });
      return;
    }

    this.ensureTimer();
  }

  async flush(options: FlushOptions = {}): Promise<void> {
    if (this.queue.length === 0) {
      this.clearTimer();
      return;
    }

    const reason = options.reason ?? "schedule";

    if (this.isFlushing) {
      this.pendingReason = reason;
      return;
    }

    if (!options.immediate) {
      this.clearTimer();
    }

    this.isFlushing = true;
    const batch = this.takeQueue();

    try {
      if (reason === "unload") {
        if (!sendWithBeacon(this.url, this.snapshotId, batch)) {
          void sendWithFetch(this.url, this.snapshotId, batch);
        }
        this.resetRetries();
      } else {
        const ok = await sendWithFetch(this.url, this.snapshotId, batch);
        if (ok) {
          this.resetRetries();
        } else {
          this.requeue(batch);
          this.scheduleRetry();
        }
      }
    } finally {
      this.isFlushing = false;
      const pending = this.pendingReason;
      this.pendingReason = null;
      if (pending && this.queue.length > 0) {
        void this.flush({ reason: pending, immediate: true });
      }
    }
  }

  private ensureTimer() {
    if (this.timer !== null) return;
    if (this.queue.length === 0) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush({ reason: "schedule" });
    }, this.flushInterval);
  }

  private clearTimer() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private takeQueue(): EventPayload[] {
    const events = this.queue.map((item) => item.payload);
    this.queue = [];
    this.queuedBytes = 0;
    this.clearTimer();
    return events;
  }

  private requeue(events: EventPayload[]) {
    const queue: QueuedEvent[] = [];
    let bytes = 0;
    for (const payload of events.concat(this.queue.map((item) => item.payload))) {
      const size = estimateSize(payload);
      if (bytes + size > this.maxBytes || queue.length >= this.batchSize) {
        // If requeueing would overflow the batch constraints, drop the rest.
        break;
      }
      queue.push({ payload, size });
      bytes += size;
    }
    this.queue = queue;
    this.queuedBytes = bytes;
  }

  private resetRetries() {
    this.retryCount = 0;
    if (this.queue.length > 0) {
      this.ensureTimer();
    }
  }

  private scheduleRetry() {
    this.retryCount += 1;
    const delay = Math.min(BASE_RETRY_DELAY * 2 ** (this.retryCount - 1), MAX_RETRY_DELAY);
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush({ reason: "retry", immediate: true });
    }, delay);
  }
}

const bufferCache = new Map<string, ClientEventBuffer>();

export function getClientEventBuffer(options: ClientEventBufferOptions): ClientEventBuffer {
  const key = `${options.snapshotId}:${options.url}`;
  let buffer = bufferCache.get(key);
  if (!buffer) {
    buffer = new ClientEventBuffer(options);
    bufferCache.set(key, buffer);
  }
  return buffer;
}

export function __resetClientEventBuffersForTest() {
  bufferCache.clear();
  activeBuffers.clear();
  lifecycleRegistered = false;
}
