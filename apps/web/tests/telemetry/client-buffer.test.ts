import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ClientEventBuffer, __resetClientEventBuffersForTest } from "@/app/telemetry/client-buffer";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {}
  }
}

const originalSendBeacon = navigator.sendBeacon;

describe("ClientEventBuffer", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    __resetClientEventBuffersForTest();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    delete (globalThis as { fetch?: unknown }).fetch;
    if (originalSendBeacon) {
      Object.defineProperty(navigator, "sendBeacon", {
        value: originalSendBeacon,
        configurable: true,
        writable: true,
      });
    } else {
      delete (navigator as { sendBeacon?: unknown }).sendBeacon;
    }
  });

  it("batches events when threshold is reached", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const buffer = new ClientEventBuffer({
      url: "/api/test",
      snapshotId: "snap-1",
      batchSize: 2,
      flushInterval: 10_000,
    });

    buffer.enqueue({ id: 1 });
    buffer.enqueue({ id: 2 });

    await vi.runAllTimersAsync();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit | undefined)?.body).toContain(
      '"events":[{"id":1},{"id":2}]',
    );
  });

  it("retries with exponential backoff on failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;

    const buffer = new ClientEventBuffer({
      url: "/api/test",
      snapshotId: "snap-2",
      batchSize: 1,
      flushInterval: 10_000,
    });

    buffer.enqueue({ id: 1 });

    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("flushes pending events on unload via sendBeacon", async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, "sendBeacon", { value: sendBeacon, configurable: true });
    const fetchMock = vi.fn();
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    const stringifySpy = vi.spyOn(JSON, "stringify");

    const buffer = new ClientEventBuffer({
      url: "/api/test",
      snapshotId: "snap-3",
      batchSize: 10,
      flushInterval: 10_000,
    });

    buffer.enqueue({ id: 1 });

    await buffer.flush({ reason: "unload", immediate: true });

    expect(sendBeacon).toHaveBeenCalledTimes(1);
    const calledWithSnapshot = stringifySpy.mock.calls.some((call) => {
      const [value] = call;
      return (
        typeof value === "object" &&
        value !== null &&
        "snapshot" in value &&
        (value as Record<string, unknown>).snapshot === "snap-3"
      );
    });
    expect(calledWithSnapshot).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    stringifySpy.mockRestore();
  });

  it("falls back to fetch when sendBeacon is unavailable", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    (globalThis as { fetch?: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
    Object.defineProperty(navigator, "sendBeacon", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const buffer = new ClientEventBuffer({
      url: "/api/test",
      snapshotId: "snap-4",
      batchSize: 10,
      flushInterval: 10_000,
    });

    buffer.enqueue({ id: 1 });

    await buffer.flush({ reason: "unload", immediate: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
