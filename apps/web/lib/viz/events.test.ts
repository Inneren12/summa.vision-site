import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitVizEvent } from "../analytics/send";

describe("emitVizEvent", () => {
  const originalDoNotTrack = Object.getOwnPropertyDescriptor(window, "doNotTrack");
  const originalFetch = global.fetch;

  beforeEach(() => {
    document.cookie = "sv_consent=all";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200 })));
  });

  afterEach(() => {
    document.cookie = "sv_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    if (originalDoNotTrack) {
      Object.defineProperty(window, "doNotTrack", originalDoNotTrack);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (window as typeof window & { doNotTrack?: string }).doNotTrack;
    }
    if (originalFetch) {
      vi.stubGlobal("fetch", originalFetch);
    }
    vi.restoreAllMocks();
  });

  it("dispatches viz events when consent allows", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const emitted = emitVizEvent("viz_ready", { lib: "fake", motion: "animated" });

    expect(emitted).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledTimes(1);

    const [event] = dispatchSpy.mock.calls[0] ?? [];
    expect(event).toBeInstanceOf(CustomEvent);
    expect(event?.type).toBe("viz_ready");
    expect((event as CustomEvent)?.detail).toMatchObject({ lib: "fake", motion: "animated" });
  });

  it("does not dispatch events when do-not-track is enabled", () => {
    Object.defineProperty(window, "doNotTrack", { value: "1", configurable: true });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const emitted = emitVizEvent("viz_ready", { lib: "fake", motion: "animated" });

    expect(emitted).toBe(false);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("skips non-necessary events when consent is limited", () => {
    document.cookie = "sv_consent=necessary";
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    const emitted = emitVizEvent("viz_state", { lib: "fake", motion: "discrete" });

    expect(emitted).toBe(false);
    expect(dispatchSpy).not.toHaveBeenCalled();
  });
});
