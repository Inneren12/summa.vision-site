import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ff/runtime", () => ({
  FF: () => ({
    snapshot: vi.fn(async () => ({ id: "snap-123" })),
    telemetrySink: { emit: vi.fn() },
    store: {},
    metrics: { recordVital: vi.fn(), recordError: vi.fn(), summarize: vi.fn(), hasData: vi.fn() },
    lock: { withLock: vi.fn() },
  }),
}));

import { middleware } from "../../middleware";

describe("middleware request id", () => {
  it("generates request id when header missing", async () => {
    const req = new NextRequest("http://example.com/", { headers: new Headers() });
    const res = await middleware(req);
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
  });

  it("preserves provided request id", async () => {
    const req = new NextRequest("http://example.com/", {
      headers: new Headers({ "x-request-id": "custom-id" }),
    });
    const res = await middleware(req);
    expect(res.headers.get("x-request-id")).toBe("custom-id");
  });
});
