import { beforeEach, describe, expect, it, vi } from "vitest";

const recordError = vi.fn();

vi.mock("@/lib/ff/runtime", () => ({
  FF: () => ({
    metrics: {
      recordVital: vi.fn(),
      recordError,
    },
  }),
}));

describe("POST /api/js-error", () => {
  beforeEach(() => {
    recordError.mockReset();
  });

  it("skips recording when DNT is enabled", async () => {
    const { POST } = await import("@/app/api/js-error/route");
    const request = new Request("http://localhost/api/js-error", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-snapshot": "snapshot-err",
        dnt: "1",
      },
      body: JSON.stringify({ message: "Boom", stack: "trace" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ skipped: true });
    expect(recordError).not.toHaveBeenCalled();
  });

  it("redacts sensitive fields when consent is limited", async () => {
    const { POST } = await import("@/app/api/js-error/route");
    const request = new Request("http://localhost/api/js-error", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-snapshot": "snapshot-err",
        "x-consent": "necessary",
        cookie: "sv_id=sid-err; sv_aid=aid-err",
      },
      body: JSON.stringify({
        message: "Sensitive error",
        stack: "trace",
        filename: "app.ts",
        url: "https://example/y",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(recordError).toHaveBeenCalledTimes(1);
    expect(recordError).toHaveBeenCalledWith("snapshot-err", undefined, undefined, {
      filename: undefined,
      url: undefined,
      sid: "sid-err",
      aid: "aid-err",
    });
  });

  it("preserves error context when consent cookie allows all", async () => {
    const { POST } = await import("@/app/api/js-error/route");
    const request = new Request("http://localhost/api/js-error", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ff-snapshot": "snapshot-err",
        cookie: "sv_consent=all; sv_id=sid-err; sv_aid=aid-err",
      },
      body: JSON.stringify({
        message: "Boom",
        stack: "trace",
        filename: "app.ts",
        url: "https://example/z",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(204);
    expect(recordError).toHaveBeenCalledTimes(1);
    expect(recordError).toHaveBeenCalledWith("snapshot-err", "Boom", "trace", {
      filename: "app.ts",
      url: "https://example/z",
      sid: "sid-err",
      aid: "aid-err",
    });
  });
});
