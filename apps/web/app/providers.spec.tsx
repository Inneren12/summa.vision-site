import { cleanup, render, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import type { RequestCorrelation } from "@/lib/metrics/correlation";

const enqueue = vi.fn();
const getClientEventBuffer = vi.fn(() => ({ enqueue }));

vi.mock("./telemetry/client-buffer", () => ({
  getClientEventBuffer,
}));

describe("Providers", () => {
  const correlation: RequestCorrelation = {
    requestId: "req-test",
    sessionId: "sess-test",
    namespace: "ns-test",
  };

  beforeEach(() => {
    vi.resetModules();
    enqueue.mockReset();
    getClientEventBuffer.mockClear();
    document.body.dataset.ffSnapshot = "snapshot-js";
    if (!window.matchMedia) {
      // @ts-expect-error - jsdom does not implement matchMedia
      window.matchMedia = vi.fn().mockImplementation(() => ({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    }
  });

  afterEach(() => {
    delete document.body.dataset.ffSnapshot;
    cleanup();
  });

  it("reports render errors through the global boundary once", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const { Providers } = await import("./providers");

      const Thrower = () => {
        throw new Error("Render boom");
      };

      render(
        <Providers correlation={correlation}>
          <Thrower />
        </Providers>,
      );

      await waitFor(() => {
        expect(enqueue).toHaveBeenCalledTimes(1);
      });

      expect(enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Render boom",
          requestId: correlation.requestId,
          sessionId: correlation.sessionId,
          namespace: correlation.namespace,
          source: "boundary",
        }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("deduplicates window error events by message", async () => {
    const { Providers } = await import("./providers");

    render(
      <Providers correlation={correlation}>
        <div>ok</div>
      </Providers>,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    const boom = new Error("Window boom");
    const errorEvent = new ErrorEvent("error", { message: "Window boom", error: boom });

    window.dispatchEvent(errorEvent);
    window.dispatchEvent(errorEvent);

    await waitFor(() => {
      expect(enqueue).toHaveBeenCalledTimes(1);
    });

    expect(enqueue).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Window boom",
        source: "window:error",
      }),
    );
  });
});
