import { describe, expect, it, vi } from "vitest";

import { sendAnalyticsEvent } from "./send";

describe("sendAnalyticsEvent", () => {
  const originalEnv = process.env.NODE_ENV;
  const originalFetch = global.fetch;
  const originalWindow = global.window;
  const originalNavigator = global.navigator;
  const originalDocument = global.document;

  const installGlobals = (): void => {
    vi.stubGlobal("window", {});
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("document", { cookie: "sv_consent=all" });
  };

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    if (originalFetch) {
      vi.stubGlobal("fetch", originalFetch);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as Partial<typeof global> & { fetch?: typeof fetch }).fetch;
    }
    if (originalWindow) {
      vi.stubGlobal("window", originalWindow);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as Partial<typeof global> & { window?: typeof window }).window;
    }
    if (originalNavigator) {
      vi.stubGlobal("navigator", originalNavigator);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as Partial<typeof global> & { navigator?: typeof navigator }).navigator;
    }
    if (originalDocument) {
      vi.stubGlobal("document", originalDocument);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete (global as Partial<typeof global> & { document?: Document }).document;
    }
    vi.restoreAllMocks();
  });

  it("skips sending when DNT is enabled", async () => {
    installGlobals();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    Object.defineProperty(window as { doNotTrack?: string }, "doNotTrack", {
      value: "1",
      configurable: true,
    });

    await sendAnalyticsEvent({ name: "test-event" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("skips sending when consent does not allow analytics", async () => {
    installGlobals();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    (document as { cookie: string }).cookie = "sv_consent=necessary";

    await sendAnalyticsEvent({ name: "test-event" });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("sends events when allowed", async () => {
    process.env.NODE_ENV = "development";
    installGlobals();
    const fetchSpy = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await sendAnalyticsEvent({ name: "allowed-event" });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, request] = fetchSpy.mock.calls[0] ?? [];
    const body = JSON.parse((request as RequestInit).body as string);
    expect(body.name).toBe("allowed-event");
    expect(typeof body.time).toBe("number");
  });

  it("logs in non-production environments when fetch fails", async () => {
    installGlobals();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network")));
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.NODE_ENV = "development";

    await sendAnalyticsEvent({ name: "failing-event" });

    expect(warnSpy).toHaveBeenCalledWith("[analytics] sendAnalyticsEvent error", expect.any(Error));
  });
});
