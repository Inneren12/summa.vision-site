import "server-only";

import { cookies as nextCookies, headers as nextHeaders } from "next/headers";

import { getStableIdFromCookieHeader } from "@/lib/ff/stable-id";

export type RequestCorrelation = {
  requestId: string | null;
  sessionId: string | null;
  namespace: string;
};

const DEFAULT_NAMESPACE = "default";
const HEADER_NAMESPACE_CANDIDATES = ["x-ff-namespace", "x-namespace", "x-tenant"] as const;

type HeaderLike = { get(name: string): string | null };

function sanitize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getCookieValue(header: string, name: string): string | undefined {
  const prefix = `${name}=`;
  const parts = header.split(/;\s*/);
  const match = parts.find((part) => part.startsWith(prefix));
  if (!match) return undefined;
  return match.slice(prefix.length);
}

function resolveNamespace(headers: HeaderLike): string {
  for (const key of HEADER_NAMESPACE_CANDIDATES) {
    const value = headers.get(key);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return DEFAULT_NAMESPACE;
}

export function correlationFromHeaders(headers: HeaderLike): RequestCorrelation {
  const requestId = sanitize(headers.get("x-request-id"));
  const namespace = resolveNamespace(headers);
  const cookieHeader = headers.get("cookie") ?? undefined;
  const ffAid = cookieHeader ? getStableIdFromCookieHeader(cookieHeader) : undefined;
  const fallback = cookieHeader ? getCookieValue(cookieHeader, "sv_id") : undefined;
  const sessionId = sanitize(ffAid ?? fallback ?? null);
  return { requestId, sessionId, namespace };
}

export function correlationFromRequest(req: Request): RequestCorrelation {
  return correlationFromHeaders(req.headers);
}

export function correlationFromNextContext(): RequestCorrelation {
  try {
    const hdrs = nextHeaders();
    const requestId = sanitize(hdrs.get("x-request-id"));
    const namespace = resolveNamespace(hdrs);
    let sessionId: string | null = null;
    try {
      const cookiesStore = nextCookies();
      sessionId = sanitize(
        cookiesStore.get("ff_aid")?.value ?? cookiesStore.get("sv_id")?.value ?? null,
      );
    } catch {
      sessionId = null;
    }
    return { requestId, sessionId, namespace };
  } catch {
    return { requestId: null, sessionId: null, namespace: DEFAULT_NAMESPACE };
  }
}

export function withCorrelationDefaults(
  correlation: RequestCorrelation | undefined,
): RequestCorrelation {
  if (!correlation) {
    return { requestId: null, sessionId: null, namespace: DEFAULT_NAMESPACE };
  }
  return {
    requestId: correlation.requestId ?? null,
    sessionId: correlation.sessionId ?? null,
    namespace: correlation.namespace || DEFAULT_NAMESPACE,
  };
}
