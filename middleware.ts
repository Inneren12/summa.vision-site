import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_AID_COOKIE,
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_COOKIE_OPTIONS,
  ADMIN_SESSION_MAX_AGE,
  authorizeContext,
  buildErrorResponse,
  type Role,
} from "@/lib/admin/rbac";
import { stableCookieOptions } from "@/lib/ff/cookies";
import { FF } from "@/lib/ff/runtime";

type CookieRecord = {
  name: string;
  value: string;
  options: ReturnType<typeof stableCookieOptions>;
};
type CookieJar = Map<string, string>;

function parseCookieHeader(header: string | null): CookieJar {
  const jar: CookieJar = new Map();
  if (!header) return jar;
  const parts = header.split(";");
  for (const part of parts) {
    const segment = part.trim();
    if (!segment) continue;
    const [rawName, ...rest] = segment.split("=");
    const name = rawName.trim();
    if (!name) continue;
    const value = rest.join("=");
    jar.set(name, value);
  }
  return jar;
}

function serializeCookieJar(jar: CookieJar): string {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

function applyCookieUpdates(response: NextResponse, updates: CookieRecord[]) {
  for (const update of updates) {
    response.cookies.set(update.name, update.value, update.options);
  }
}

function ensureCookie(
  jar: CookieJar,
  name: string,
  factory: () => string,
  overrides: Parameters<typeof stableCookieOptions>[0],
  updates: CookieRecord[],
) {
  if (jar.has(name)) return;
  const value = factory();
  jar.set(name, value);
  if (name !== "sv_id") {
    updates.push({ name, value, options: stableCookieOptions({ httpOnly: false, ...overrides }) });
  }
}

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

const YEAR_IN_SECONDS = 365 * 24 * 60 * 60;

export async function middleware(req: NextRequest) {
  const forwardedHeaders = new Headers(req.headers);
  const requestCookies = req.cookies;

  let svId = requestCookies.get("sv_id")?.value;
  let svCreated = false;
  if (!svId) {
    svId = crypto.randomUUID();
    requestCookies.set("sv_id", svId);
    svCreated = true;
  }

  const syncForwardedCookies = () => {
    const headerValue = requestCookies.toString();
    if (headerValue) {
      forwardedHeaders.set("cookie", headerValue);
    } else {
      forwardedHeaders.delete("cookie");
    }
  };

  syncForwardedCookies();

  const snapshot = await FF().snapshot();
  const incomingRequestId = (req.headers.get("x-request-id") || "").trim();
  const requestId = incomingRequestId || crypto.randomUUID();
  forwardedHeaders.set("x-request-id", requestId);
  const cookieJar = parseCookieHeader(forwardedHeaders.get("cookie"));
  const cookieUpdates: CookieRecord[] = [];

  ensureCookie(
    cookieJar,
    "sv_id",
    () => crypto.randomUUID(),
    { httpOnly: false, maxAge: YEAR_IN_SECONDS },
    cookieUpdates,
  );
  ensureCookie(
    cookieJar,
    "ff_aid",
    () => crypto.randomUUID(),
    { httpOnly: false, maxAge: YEAR_IN_SECONDS },
    cookieUpdates,
  );
  ensureCookie(
    cookieJar,
    "sv_consent",
    () => "necessary",
    { httpOnly: false, maxAge: YEAR_IN_SECONDS },
    cookieUpdates,
  );

  if (cookieUpdates.length > 0) {
    forwardedHeaders.set("cookie", serializeCookieJar(cookieJar));
  }
  const required = requiredRoleFor(req.nextUrl.pathname, req.method);
  let res: NextResponse;
  let ffAidValue = requestCookies.get(ADMIN_AID_COOKIE)?.value;
  let refreshAid = false;

  if (required) {
    const result = authorizeContext(
      { headers: forwardedHeaders, cookieHeader: forwardedHeaders.get("cookie") },
      required,
    );
    if (!result.ok) {
      const error = buildErrorResponse(result.status, result.reason, result.clearSession);
      error.headers.set("x-request-id", requestId);
      if (svCreated && svId) {
        error.cookies.set(
          "sv_id",
          svId,
          stableCookieOptions({ httpOnly: false, maxAge: YEAR_IN_SECONDS }),
        );
      }
      error.headers.set("x-ff-snapshot", snapshot.id);
      applyCookieUpdates(error, cookieUpdates);
      return error;
    }
    forwardedHeaders.set("x-ff-console-role", result.role);
    if (result.sessionValue && result.sessionValue !== ffAidValue) {
      requestCookies.set(ADMIN_AID_COOKIE, result.sessionValue);
      ffAidValue = result.sessionValue;
      syncForwardedCookies();
    }
    refreshAid = true;
    res = NextResponse.next({ request: { headers: forwardedHeaders } });
    res.cookies.set(ADMIN_SESSION_COOKIE, result.sessionValue, ADMIN_SESSION_COOKIE_OPTIONS);
  } else {
    res = NextResponse.next({ request: { headers: forwardedHeaders } });
  }

  applyCookieUpdates(res, cookieUpdates);

  if (refreshAid && ffAidValue) {
    res.cookies.set(
      ADMIN_AID_COOKIE,
      ffAidValue,
      stableCookieOptions({ httpOnly: false, maxAge: ADMIN_SESSION_MAX_AGE }),
    );
  }

  if (svCreated && svId) {
    res.cookies.set(
      "sv_id",
      svId,
      stableCookieOptions({ httpOnly: false, maxAge: YEAR_IN_SECONDS }),
    );
  }
  res.headers.set("x-ff-snapshot", snapshot.id);
  res.headers.set("x-request-id", requestId);
  return res;
}
