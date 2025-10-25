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
        "x-request-id": "req-js-1",
        cookie: "sv_id=session-js-1",
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
        "x-request-id": "req-js-2",
        cookie: "sv_id=session-js-2",
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
    const [snapshot, message, stack, details] = recordError.mock.calls[0];
    expect(snapshot).toBe("snapshot-err");
    expect(message).toBeUndefined();
    expect(stack).toBeUndefined();
    expect(details).toEqual({
      context: { requestId: "req-js-2", sessionId: "session-js-2", namespace: "default" },
      sid: "session-js-2",
      aid: undefined,
      url: undefined,
      filename: undefined,
    });
  });
});
