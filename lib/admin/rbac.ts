import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { FF_COOKIE_DOMAIN, FF_COOKIE_PATH, FF_COOKIE_SECURE } from "@/lib/ff/cookies";
import { tscmp } from "@/lib/ff/tscmp";

export type Role = "viewer" | "ops" | "admin";

type TokenEntry = {
  role: Role;
  token: string;
  hash: string;
};

type SessionSource = "header" | "cookie";

export type AuthSuccess = {
  ok: true;
  role: Role;
  source: SessionSource;
  sessionValue: string;
};

export type AuthFailure = {
  ok: false;
  status: number;
  reason: "disabled" | "missing" | "invalid" | "forbidden";
  clearSession?: boolean;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type AuthorizeContext = {
  headers: Headers;
  cookieHeader?: string | null;
};

const ROLE_PRIORITY: Record<Role, number> = {
  viewer: 0,
  ops: 1,
  admin: 2,
};

export const ADMIN_SESSION_COOKIE = "sv_admin_session";
export const ADMIN_SESSION_MAX_AGE = 60 * 15; // 15 minutes

export const ADMIN_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: FF_COOKIE_SECURE,
  path: FF_COOKIE_PATH,
  domain: FF_COOKIE_DOMAIN,
  maxAge: ADMIN_SESSION_MAX_AGE,
};

export const ADMIN_SESSION_COOKIE_CLEAR_OPTIONS = {
  ...ADMIN_SESSION_COOKIE_OPTIONS,
  maxAge: 0,
};

function parseTokenList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function tokens(): TokenEntry[] {
  const entries: TokenEntry[] = [];
  const viewerTokens = parseTokenList(process.env.FF_CONSOLE_VIEWER_TOKENS);
  const opsTokens = [
    ...parseTokenList(process.env.FF_CONSOLE_OPS_TOKENS),
    ...parseTokenList(process.env.ADMIN_TOKEN_OPS),
  ];
  const adminTokens = [
    ...parseTokenList(process.env.FF_CONSOLE_ADMIN_TOKENS),
    ...parseTokenList(process.env.FF_ADMIN_TOKEN),
  ];

  for (const token of viewerTokens) {
    entries.push({ role: "viewer", token, hash: hashToken(token) });
  }
  for (const token of opsTokens) {
    entries.push({ role: "ops", token, hash: hashToken(token) });
  }
  for (const token of adminTokens) {
    entries.push({ role: "admin", token, hash: hashToken(token) });
  }

  return entries;
}

function hasRole(role: Role, required: Role): boolean {
  return ROLE_PRIORITY[role] >= ROLE_PRIORITY[required];
}

function parseAuthorizationHeader(headers: Headers): string | null {
  const raw = headers.get("authorization");
  if (!raw) return null;
  const [scheme, value] = raw.split(/\s+/, 2);
  if (!scheme || !value) return null;
  const lowered = scheme.toLowerCase();
  if (lowered === "bearer" || lowered === "token") {
    return value.trim();
  }
  if (lowered === "basic") {
    try {
      const decoded = Buffer.from(value, "base64").toString("utf8");
      const token = decoded.includes(":") ? decoded.split(":").pop() : decoded;
      return token?.trim() || null;
    } catch {
      return null;
    }
  }
  return null;
}

function extractHeaderToken(headers: Headers): string | null {
  const direct = parseAuthorizationHeader(headers);
  if (direct) return direct;
  const consoleToken = headers.get("x-ff-console-token");
  if (consoleToken) return consoleToken.trim();
  const legacyAdmin = headers.get("x-ff-admin-token");
  if (legacyAdmin) return legacyAdmin.trim();
  return null;
}

function parseCookieHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").map((item) => item.trim());
  for (const cookie of cookies) {
    if (!cookie) continue;
    const [name, ...rest] = cookie.split("=");
    if (!name) continue;
    if (name.trim() === ADMIN_SESSION_COOKIE) {
      return rest.join("=").trim();
    }
  }
  return null;
}

function parseSession(value: string | null): { role: Role; hash: string } | null {
  if (!value) return null;
  const [rolePart, hashPart] = value.split(":", 2);
  if (!rolePart || !hashPart) return null;
  if (!/^[0-9a-f]{64}$/i.test(hashPart)) return null;
  const role = rolePart as Role;
  if (!ROLE_PRIORITY[role]) {
    if (role !== "viewer" && role !== "ops" && role !== "admin") {
      return null;
    }
  }
  return { role, hash: hashPart.toLowerCase() };
}

function encodeSession(role: Role, hash: string): string {
  return `${role}:${hash}`;
}

function findByToken(entries: TokenEntry[], candidate: string): TokenEntry | null {
  for (const entry of entries) {
    if (candidate.length === entry.token.length && tscmp(candidate, entry.token)) {
      return entry;
    }
  }
  return null;
}

function findByHash(entries: TokenEntry[], hash: string): TokenEntry | null {
  for (const entry of entries) {
    if (hash.length === entry.hash.length && tscmp(hash, entry.hash)) {
      return entry;
    }
  }
  return null;
}

export function authorizeContext(context: AuthorizeContext, required: Role): AuthResult {
  const entries = tokens();
  if (entries.length === 0) {
    return { ok: false, status: 503, reason: "disabled" };
  }

  const headerToken = extractHeaderToken(context.headers);
  if (headerToken) {
    const match = findByToken(entries, headerToken);
    if (!match) {
      return { ok: false, status: 403, reason: "invalid" };
    }
    if (!hasRole(match.role, required)) {
      return { ok: false, status: 403, reason: "forbidden" };
    }
    return {
      ok: true,
      role: match.role,
      source: "header",
      sessionValue: encodeSession(match.role, match.hash),
    };
  }

  const sessionCookie = parseSession(parseCookieHeader(context.cookieHeader));
  if (sessionCookie) {
    const match = findByHash(entries, sessionCookie.hash);
    if (!match) {
      return { ok: false, status: 403, reason: "invalid", clearSession: true };
    }
    if (!hasRole(match.role, required)) {
      return { ok: false, status: 403, reason: "forbidden", clearSession: true };
    }
    return {
      ok: true,
      role: match.role,
      source: "cookie",
      sessionValue: encodeSession(match.role, match.hash),
    };
  }

  return { ok: false, status: 401, reason: "missing" };
}

export function roleFromHeaders(headers: Headers): Role | null {
  const header = headers.get("x-ff-console-role");
  if (header === "viewer" || header === "ops" || header === "admin") {
    return header;
  }
  return null;
}

export type ApiAuthSuccess = {
  ok: true;
  role: Role;
  apply<T extends NextResponse>(res: T): T;
};

export type ApiAuthFailure = { ok: false; response: NextResponse };

export type ApiAuthResult = ApiAuthSuccess | ApiAuthFailure;

export function buildErrorResponse(
  status: number,
  reason: AuthFailure["reason"],
  clear?: boolean,
): NextResponse {
  const body =
    reason === "missing"
      ? { error: "Authentication required" }
      : reason === "disabled"
        ? { error: "Admin console not configured" }
        : { error: "Forbidden" };
  const res = NextResponse.json(body, { status });
  res.headers.set("cache-control", "no-store");
  if (clear) {
    res.cookies.set(ADMIN_SESSION_COOKIE, "", ADMIN_SESSION_COOKIE_CLEAR_OPTIONS);
  }
  return res;
}

export function authorizeApi(req: Request, required: Role): ApiAuthResult {
  const context: AuthorizeContext = {
    headers: req.headers,
    cookieHeader: req.headers.get("cookie"),
  };
  const result = authorizeContext(context, required);
  if (!result.ok) {
    return {
      ok: false,
      response: buildErrorResponse(result.status, result.reason, result.clearSession),
    };
  }
  return {
    ok: true,
    role: result.role,
    apply<T extends NextResponse>(res: T) {
      res.cookies.set(ADMIN_SESSION_COOKIE, result.sessionValue, ADMIN_SESSION_COOKIE_OPTIONS);
      return res;
    },
  };
}
