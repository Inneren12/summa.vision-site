import { NextResponse } from "next/server";

import type { SessionSource } from "./rbac";

import { tscmp } from "@/lib/ff/tscmp";


export const ADMIN_CSRF_COOKIE = "ff_csrf";
export const ADMIN_CSRF_HEADER = "x-csrf-token";

type CsrfDecision =
  | { ok: true }
  | {
      ok: false;
      response: NextResponse;
    };

function readCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const parts = header.split(";");
  for (const part of parts) {
    const segment = part.trim();
    if (!segment) continue;
    const [cookieName, ...rest] = segment.split("=");
    if (!cookieName) continue;
    if (cookieName.trim() === name) {
      return rest.join("=");
    }
  }
  return null;
}

function csrfError(reason: string): NextResponse {
  const res = NextResponse.json({ error: "CSRF verification failed", reason }, { status: 403 });
  res.headers.set("cache-control", "no-store");
  return res;
}

export function enforceAdminCsrf(req: Request, source: SessionSource): CsrfDecision {
  if (source !== "cookie") {
    return { ok: true };
  }
  const cookieValue = readCookie(req.headers.get("cookie"), ADMIN_CSRF_COOKIE);
  if (!cookieValue) {
    return { ok: false, response: csrfError("missing-cookie") };
  }
  const headerValue = req.headers.get(ADMIN_CSRF_HEADER);
  if (!headerValue) {
    return { ok: false, response: csrfError("missing-header") };
  }
  const token = headerValue.trim();
  if (token.length === 0 || token.length > 512) {
    return { ok: false, response: csrfError("invalid-header") };
  }
  if (cookieValue.length === 0 || cookieValue.length > 512) {
    return { ok: false, response: csrfError("invalid-cookie") };
  }
  if (!tscmp(cookieValue, token)) {
    return { ok: false, response: csrfError("mismatch") };
  }
  return { ok: true };
}

export type { CsrfDecision };
