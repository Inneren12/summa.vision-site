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
      body: JSON.stringify({ name: "LCP", value: 123 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
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
        name: "FID",
        value: 42,
        attribution: {
          eventTarget: "button",
          url: "https://example.com/private",
          nested: {
            message: "secret",
            count: 5,
          },
        },
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(recordVital).toHaveBeenCalledTimes(1);
    const [, , , details] = recordVital.mock.calls[0];
    expect(details?.attribution).toEqual({
      eventTarget: "button",
      nested: {
        count: 5,
      },
    });
    expect(details?.context).toEqual({
      requestId: "req-vitals-1",
      sessionId: "session-vitals",
      namespace: "default",
    });
  });
});
