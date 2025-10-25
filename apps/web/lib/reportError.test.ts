import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __resetReportedJsErrors, reportJsError, type JsErrorCorrelation } from "./reportError";

describe("reportJsError", () => {
  const correlation: JsErrorCorrelation = {
    requestId: "req-123",
    sessionId: "sess-456",
    namespace: "demo",
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    __resetReportedJsErrors();
    vi.unstubAllGlobals();
    fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends only once for the same request and message", async () => {
    await reportJsError("snapshot-1", correlation, { message: "Boom" });
    await reportJsError("snapshot-1", correlation, { message: "Boom" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("includes correlation headers", async () => {
    await reportJsError("snapshot-1", correlation, { message: "Boom" });

    const call = fetchMock.mock.calls[0];
    expect(call?.[0]).toBe("/api/js-error");
    const init = call?.[1] as RequestInit;
    expect(init?.keepalive).toBe(true);
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["x-ff-snapshot"]).toBe("snapshot-1");
    expect(headers?.["x-request-id"]).toBe("req-123");
    expect(headers?.["x-sid"]).toBe("sess-456");
    expect(headers?.["x-ff-namespace"]).toBe("demo");
  });

  it("skips sending when snapshot is missing", async () => {
    await reportJsError("", correlation, { message: "Boom" });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends again when message differs", async () => {
    await reportJsError("snapshot-1", correlation, { message: "Boom" });
    await reportJsError("snapshot-1", correlation, { message: "Boom 2" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
