import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const authorizeContextMock = vi.hoisted(() => vi.fn());
const snapshotMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/admin/rbac", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/rbac")>("@/lib/admin/rbac");
  return {
    ...actual,
    authorizeContext: authorizeContextMock,
  };
});

vi.mock("@/lib/ff/runtime", () => ({
  FF: () => ({ snapshot: snapshotMock }),
}));

const { middleware } = await import("@/middleware");
const { ADMIN_AID_COOKIE, ADMIN_SESSION_COOKIE_OPTIONS } = await import("@/lib/admin/rbac");

const SNAPSHOT = { id: "snapshot-test" };

describe("middleware cookie handling", () => {
  beforeEach(() => {
    authorizeContextMock.mockReset();
    snapshotMock.mockReset();
    snapshotMock.mockResolvedValue(SNAPSHOT);
  });

  it("issues sv_id when missing with stable attributes", async () => {
    const request = new NextRequest("https://example.com/hello");

    const response = await middleware(request);

    expect(authorizeContextMock).not.toHaveBeenCalled();
    const cookie = response.cookies.get("sv_id");
    expect(cookie).toBeDefined();
    expect(cookie?.value).toBeTruthy();
    expect(cookie?.sameSite).toBe("lax");
    expect(cookie?.path).toBe("/");
    expect(cookie?.httpOnly).toBe(false);
    expect(cookie?.secure ?? false).toBe(false);
    expect(response.cookies.getAll("sv_id")).toHaveLength(1);
    expect(response.headers.get("x-ff-snapshot")).toBe(SNAPSHOT.id);
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("does not duplicate sv_id when already present", async () => {
    const request = new NextRequest("https://example.com/hello", {
      headers: { cookie: "sv_id=existing" },
    });

    const response = await middleware(request);

    expect(authorizeContextMock).not.toHaveBeenCalled();
    expect(response.cookies.get("sv_id")).toBeUndefined();
    expect(response.cookies.getAll("sv_id")).toHaveLength(0);
  });

  it("creates ff_aid for admin contexts and forwards sv_id", async () => {
    authorizeContextMock.mockReturnValueOnce({
      ok: true,
      role: "viewer",
      source: "header",
      sessionValue: "viewer:hash",
    });

    const request = new NextRequest("https://example.com/admin/flags");
    const response = await middleware(request);

    expect(authorizeContextMock).toHaveBeenCalledTimes(1);
    const contextArg = authorizeContextMock.mock.calls[0]?.[0];
    expect(contextArg?.cookieHeader).toMatch(/sv_id=/);

    const adminSession = response.cookies.get(ADMIN_AID_COOKIE);
    expect(adminSession?.value).toBe("viewer:hash");
    expect(adminSession?.sameSite).toBe("lax");
    expect(adminSession?.path).toBe("/");
    expect(adminSession?.httpOnly).toBe(false);
    expect(response.cookies.getAll(ADMIN_AID_COOKIE)).toHaveLength(1);

    const sessionCookie = response.cookies.get("sv_admin_session");
    expect(sessionCookie?.value).toBe("viewer:hash");
    expect(sessionCookie?.maxAge).toBe(ADMIN_SESSION_COOKIE_OPTIONS.maxAge);
  });
});
