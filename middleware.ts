import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  authorizeContext,
  buildErrorResponse,
  type Role,
} from "@/lib/admin/rbac";
import { FF_COOKIE_DOMAIN, FF_COOKIE_PATH, FF_COOKIE_SECURE } from "@/lib/ff/cookies";
import { FF } from "@/lib/ff/runtime";

function requiredRoleFor(pathname: string, method: string): Role | null {
  const normalized = pathname.replace(/\/+$/, "");
  if (normalized.startsWith("/admin/flags")) return "viewer";
  if (normalized === "/api/telemetry/export") return "viewer";
  if (normalized === "/api/kill") return method === "POST" ? "admin" : "viewer";
  if (normalized.startsWith("/api/admin/ff-emergency-disable")) return "admin";
  if (normalized === "/api/flags") {
    return method === "GET" ? "viewer" : "admin";
  }
  if (/^\/api\/flags\/[^/]+$/.test(normalized)) {
    return "viewer";
  }
  if (/^\/api\/flags\/[^/]+\/override$/.test(normalized)) {
    return method === "GET" ? "viewer" : "ops";
  }
  if (/^\/api\/flags\/[^/]+\/rollout\/step$/.test(normalized)) {
    return "ops";
  }
  return null;
}

export function middleware(req: NextRequest) {
  const snapshot = FF().snapshot();
  const has = req.cookies.get("sv_id")?.value;
  const required = requiredRoleFor(req.nextUrl.pathname, req.method);
  let res: NextResponse;

  if (required) {
    const result = authorizeContext(
      { headers: req.headers, cookieHeader: req.headers.get("cookie") },
      required,
    );
    if (!result.ok) {
      const error = buildErrorResponse(result.status, result.reason, result.clearSession);
      if (!has) {
        error.cookies.set("sv_id", crypto.randomUUID(), {
          maxAge: 365 * 24 * 60 * 60,
          httpOnly: false,
          sameSite: "lax",
          secure: FF_COOKIE_SECURE,
          path: FF_COOKIE_PATH,
          domain: FF_COOKIE_DOMAIN,
        });
      }
      error.headers.set("x-ff-snapshot", snapshot.id);
      return error;
    }
    const forwardedHeaders = new Headers(req.headers);
    forwardedHeaders.set("x-ff-console-role", result.role);
    res = NextResponse.next({ request: { headers: forwardedHeaders } });
    res.cookies.set(ADMIN_SESSION_COOKIE, result.sessionValue, ADMIN_SESSION_COOKIE_OPTIONS);
  } else {
    res = NextResponse.next();
  }

  if (!has) {
    res.cookies.set("sv_id", crypto.randomUUID(), {
      maxAge: 365 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: "lax",
      secure: FF_COOKIE_SECURE,
      path: FF_COOKIE_PATH,
      domain: FF_COOKIE_DOMAIN,
    });
  }
  res.headers.set("x-ff-snapshot", snapshot.id);
  return res;
}
