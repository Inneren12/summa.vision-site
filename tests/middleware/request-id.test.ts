import { NextRequest } from "next/server";
import { afterAll, describe, expect, it, vi } from "vitest";

const envSetup = vi.hoisted(() => {
  const saved = {
    FF_COOKIE_DOMAIN: process.env.FF_COOKIE_DOMAIN,
    FF_COOKIE_PATH: process.env.FF_COOKIE_PATH,
  };
  process.env.FF_COOKIE_DOMAIN = ".example.test";
  process.env.FF_COOKIE_PATH = "/";
  return saved;
});

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

import { FF_PUBLIC_COOKIE_OPTIONS } from "@/lib/ff/cookies";

afterAll(() => {
  const saved = envSetup;
  if (typeof saved.FF_COOKIE_DOMAIN === "string") {
    process.env.FF_COOKIE_DOMAIN = saved.FF_COOKIE_DOMAIN;
  } else {
    delete process.env.FF_COOKIE_DOMAIN;
  }
  if (typeof saved.FF_COOKIE_PATH === "string") {
    process.env.FF_COOKIE_PATH = saved.FF_COOKIE_PATH;
  } else {
    delete process.env.FF_COOKIE_PATH;
  }
});

describe("middleware request id", () => {
  it("generates request id when header missing", async () => {
    const req = new NextRequest("http://example.com/", { headers: new Headers() });
    const res = await middleware(req);
    const requestId = res.headers.get("x-request-id");
    expect(requestId).toBeTruthy();
    expect(requestId ?? "").toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("preserves provided request id", async () => {
    const req = new NextRequest("http://example.com/", {
      headers: new Headers({ "x-request-id": "custom-id" }),
    });
    const res = await middleware(req);
    expect(res.headers.get("x-request-id")).toBe("custom-id");
  });

  it("sets visitor cookies and consent with expected attributes", async () => {
    const req = new NextRequest("http://example.com/", { headers: new Headers() });
    const res = await middleware(req);
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).toMatch(/sv_id=[^;]+/);
    expect(set).toMatch(/ff_aid=[^;]+/);
    expect(set).toMatch(/sv_consent=necessary/);
    expect(set).toMatch(/Path=\//);
    expect(set.toLowerCase()).toContain("samesite=lax");
    expect(set).toMatch(/;\s*Domain=\.example\.test/);
    if (FF_PUBLIC_COOKIE_OPTIONS.secure) {
      expect(set).toMatch(/;\s*Secure/);
    } else {
      expect(set).not.toMatch(/;\s*Secure/);
    }
    expect(set).not.toMatch(/sv_id=[^;]+;[^\n]*HttpOnly/i);
    expect(set).not.toMatch(/ff_aid=[^;]+;[^\n]*HttpOnly/i);
  });

  it("does not overwrite existing identifiers", async () => {
    const req = new NextRequest("http://example.com/", {
      headers: new Headers({
        cookie: "sv_id=existing-sv; ff_aid=existing-aid; sv_consent=all",
      }),
    });
    const res = await middleware(req);
    const set = res.headers.get("set-cookie") ?? "";
    expect(set).not.toMatch(/sv_id=/);
    expect(set).not.toMatch(/ff_aid=/);
    expect(set).not.toMatch(/sv_consent=/);
  });
});
