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
      },
      body: JSON.stringify({ name: "LCP", value: 123 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ skipped: true });
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
        cookie: "sv_id=sid-123; sv_aid=aid-456",
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
        url: "https://example.com/path",
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
    expect(details?.url).toBeUndefined();
    expect(details?.sid).toBe("sid-123");
    expect(details?.aid).toBe("aid-456");
  });

  it("preserves full payload when consent cookie allows all", async () => {
    const { POST } = await import("@/app/api/vitals/route");
    const request = new Request("http://localhost/api/vitals", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-snapshot": "snapshot-3",
        cookie: "sv_consent=all; sv_id=sid-cookie; sv_aid=aid-cookie",
      },
      body: JSON.stringify({
        name: "INP",
        value: 220,
        url: "https://example/x",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(recordVital).toHaveBeenCalledTimes(1);
    const [, , , details] = recordVital.mock.calls[0];
    expect(details?.url).toBe("https://example/x");
    expect(details?.sid).toBe("sid-cookie");
    expect(details?.aid).toBe("aid-cookie");
  });
});
