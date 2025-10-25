import { beforeEach, describe, expect, it, vi } from "vitest";

const recordVital = vi.fn();

vi.mock("@/lib/ff/runtime", () => ({
  FF: () => ({
    metrics: {
      recordVital,
      recordError: vi.fn(),
    },
  }),
}));

describe("POST /api/vitals", () => {
  beforeEach(() => {
    recordVital.mockReset();
  });

  it("skips recording when DNT is enabled", async () => {
    const { POST } = await import("@/app/api/vitals/route");
    const request = new Request("http://localhost/api/vitals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-snapshot": "snapshot-1",
        dnt: "1",
        "x-request-id": "req-test-1",
        cookie: "sv_id=session-test-1",
      },
      body: JSON.stringify({ snapshot: "snapshot-1", events: [{ name: "LCP", value: 123 }] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(response.ok).toBe(true);
    expect(response.headers.get("sv-telemetry-status")).toBe("ok:true, skipped:true");
    expect(recordVital).not.toHaveBeenCalled();
  });

  it("redacts sensitive attribution fields when consent is limited", async () => {
    const { POST } = await import("@/app/api/vitals/route");
    const request = new Request("http://localhost/api/vitals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-snapshot": "snapshot-2",
        "x-consent": "necessary",
        "x-request-id": "req-vitals-1",
        cookie: "sv_id=session-vitals",
      },
      body: JSON.stringify({
        snapshot: "snapshot-2",
        events: [
          {
            name: "FID",
            value: 42,
            attribution: {
              eventTarget: "button",
              eventType: "click",
              navigationType: "navigate",
              timeToFirstByte: 123,
              resourceLoadDelay: 0.2,
              nested: {
                message: "secret",
                count: 5,
              },
            },
            url: "https://example.com/path",
          },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(recordVital).toHaveBeenCalledTimes(1);
    const [, , , details] = recordVital.mock.calls[0];
    expect(details?.attribution).toEqual({
      eventType: "click",
      navigationType: "navigate",
      timeToFirstByte: 123,
      resourceLoadDelay: 0.2,
    });
    expect(details?.context).toEqual({
      requestId: "req-vitals-1",
      sessionId: "session-vitals",
      namespace: "default",
    });
    expect(details?.url).toBeUndefined();
    expect(details?.sid).toBe("session-vitals");
    expect(details?.aid).toBeUndefined();
  });

  it("records multiple vitals in a single batch", async () => {
    const { POST } = await import("@/app/api/vitals/route");
    const request = new Request("http://localhost/api/vitals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-snapshot": "snapshot-3",
        "x-request-id": "req-batch",
        cookie: "sv_id=session-batch",
      },
      body: JSON.stringify({
        snapshot: "snapshot-3",
        events: [
          { name: "CLS", value: 0.01 },
          { name: "FCP", value: 1234 },
        ],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(recordVital).toHaveBeenCalledTimes(2);
    expect(recordVital.mock.calls[0][1]).toBe("CLS");
    expect(recordVital.mock.calls[1][1]).toBe("FCP");
  });
});
