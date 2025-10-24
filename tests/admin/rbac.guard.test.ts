import { describe, expect, it, beforeEach, afterEach } from "vitest";

import {
  ADMIN_SESSION_COOKIE,
  authorizeApi,
  authorizeContext,
  type AuthResult,
} from "@/lib/admin/rbac";

function buildHeaders(init?: Record<string, string>): Headers {
  const headers = new Headers();
  if (init) {
    for (const [key, value] of Object.entries(init)) {
      headers.set(key, value);
    }
  }
  return headers;
}

describe("admin RBAC", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.FF_CONSOLE_VIEWER_TOKENS = "viewer-token";
    process.env.FF_CONSOLE_OPS_TOKENS = "ops-token";
    process.env.FF_CONSOLE_ADMIN_TOKENS = "admin-token";
    process.env.FF_ADMIN_TOKEN = "legacy-admin";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("disables access when tokens are not configured", () => {
    delete process.env.FF_CONSOLE_VIEWER_TOKENS;
    delete process.env.FF_CONSOLE_OPS_TOKENS;
    delete process.env.FF_CONSOLE_ADMIN_TOKENS;
    delete process.env.FF_ADMIN_TOKEN;
    const result = authorizeContext({ headers: buildHeaders(), cookieHeader: undefined }, "viewer");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(503);
    }
  });

  it("authorizes header tokens for matching role", () => {
    const result = authorizeContext(
      { headers: buildHeaders({ authorization: "Bearer viewer-token" }), cookieHeader: undefined },
      "viewer",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe("viewer");
    }
  });

  it("rejects insufficient role", () => {
    const result = authorizeContext(
      { headers: buildHeaders({ authorization: "Bearer viewer-token" }), cookieHeader: undefined },
      "ops",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
    }
  });

  it("reuses session cookie", () => {
    const initial = authorizeContext(
      { headers: buildHeaders({ authorization: "Bearer ops-token" }), cookieHeader: undefined },
      "viewer",
    ) as Extract<AuthResult, { ok: true }>;
    expect(initial.ok).toBe(true);
    const sessionValue = initial.sessionValue;
    const cookieHeader = `${ADMIN_SESSION_COOKIE}=${sessionValue}`;
    const second = authorizeContext({ headers: buildHeaders(), cookieHeader }, "ops");
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.role).toBe("ops");
    }
  });

  it("authorizeApi responds with 401 when credentials missing", () => {
    const request = new Request("http://localhost/api/test", { method: "GET" });
    const result = authorizeApi(request, "viewer");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });
});
