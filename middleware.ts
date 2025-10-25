import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  authorizeContext,
  buildErrorResponse,
  type Role,
} from "@/lib/admin/rbac";
import { FF_PUBLIC_COOKIE_OPTIONS, ONE_YEAR_SECONDS } from "@/lib/ff/cookies";
import { FF } from "@/lib/ff/runtime";

function requiredRoleFor(pathname: string, method: string): Role | null {
  const normalized = pathname.replace(/\/+$/, "");
  if (normalized.startsWith("/admin/flags")) return "viewer";
  if (normalized.startsWith("/admin/data-health")) return "viewer";
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

type CookieRecord = {
  name: string;
  value: string;
  options: Parameters<NextResponse["cookies"]["set"]>[2];
};

function parseCookieHeader(header: string | null | undefined): Map<string, string> {
  const jar = new Map<string, string>();
  if (!header) return jar;
  for (const part of header.split(/;\s*/)) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    const value = part.slice(eq + 1);
    jar.set(name, value);
  }
  return jar;
}

function serializeCookieJar(jar: Map<string, string>): string {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function ensureCookie(
  jar: Map<string, string>,
  name: string,
  generator: () => string,
  options: CookieRecord["options"],
  updates: CookieRecord[],
): string {
  const existing = jar.get(name);
  if (existing && existing.trim()) {
    return existing;
  }
  const value = generator();
  jar.set(name, value);
  updates.push({ name, value, options });
  return value;
}

export async function middleware(req: NextRequest) {
  const snapshot = await FF().snapshot();
  const incomingRequestId = (req.headers.get("x-request-id") || "").trim();
  const requestId = incomingRequestId || crypto.randomUUID();
  const forwardedHeaders = new Headers(req.headers);
  forwardedHeaders.set("x-request-id", requestId);
  const cookieJar = parseCookieHeader(forwardedHeaders.get("cookie"));
  const cookieUpdates: CookieRecord[] = [];

  ensureCookie(
    cookieJar,
    "sv_id",
    () => crypto.randomUUID(),
    { ...FF_PUBLIC_COOKIE_OPTIONS, maxAge: ONE_YEAR_SECONDS },
    cookieUpdates,
  );
  ensureCookie(
    cookieJar,
    "ff_aid",
    () => crypto.randomUUID(),
    { ...FF_PUBLIC_COOKIE_OPTIONS, maxAge: ONE_YEAR_SECONDS },
    cookieUpdates,
  );
  ensureCookie(
    cookieJar,
    "sv_consent",
    () => "necessary",
    { ...FF_PUBLIC_COOKIE_OPTIONS, maxAge: ONE_YEAR_SECONDS },
    cookieUpdates,
  );

  if (cookieUpdates.length > 0) {
    forwardedHeaders.set("cookie", serializeCookieJar(cookieJar));
  }
  const required = requiredRoleFor(req.nextUrl.pathname, req.method);
  let res: NextResponse;

  if (required) {
    const result = authorizeContext(
      { headers: forwardedHeaders, cookieHeader: forwardedHeaders.get("cookie") },
      required,
    );
    if (!result.ok) {
      const error = buildErrorResponse(result.status, result.reason, result.clearSession);
      error.headers.set("x-request-id", requestId);
      for (const { name, value, options } of cookieUpdates) {
        error.cookies.set(name, value, options);
      }
      error.headers.set("x-ff-snapshot", snapshot.id);
      return error;
    }
    forwardedHeaders.set("x-ff-console-role", result.role);
    res = NextResponse.next({ request: { headers: forwardedHeaders } });
    res.cookies.set(ADMIN_SESSION_COOKIE, result.sessionValue, ADMIN_SESSION_COOKIE_OPTIONS);
  } else {
    res = NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  for (const { name, value, options } of cookieUpdates) {
    res.cookies.set(name, value, options);
  }
  res.headers.set("x-ff-snapshot", snapshot.id);
  res.headers.set("x-request-id", requestId);
  return res;
}
