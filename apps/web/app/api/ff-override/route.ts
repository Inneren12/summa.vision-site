import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "sv_flags_override";

type OverrideMap = Record<string, boolean>;

type CookieAttributes = {
  path?: string;
  sameSite?: "lax" | "strict" | "none";
  httpOnly?: boolean;
  secure?: boolean;
  maxAge?: number;
};

function isDevApiEnabled() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return process.env.SV_ALLOW_DEV_API === "1" || process.env.NEXT_PUBLIC_E2E === "1";
}

function cookieOptions(req: NextRequest, overrides: CookieAttributes = {}): CookieAttributes {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: req.nextUrl.protocol === "https:",
    ...overrides,
  } satisfies CookieAttributes;
}

function readOverrides(req: NextRequest): OverrideMap {
  try {
    const raw = req.cookies.get(COOKIE_NAME)?.value;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const result: OverrideMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "boolean") {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function writeOverrides(res: NextResponse, req: NextRequest, overrides: OverrideMap) {
  if (Object.keys(overrides).length === 0) {
    res.cookies.set({ name: COOKIE_NAME, value: "", ...cookieOptions(req, { maxAge: 0 }) });
    return;
  }
  res.cookies.set({
    name: COOKIE_NAME,
    value: JSON.stringify(overrides),
    ...cookieOptions(req, { maxAge: 60 * 60 * 24 * 7 }),
  });
}

function parseFlagParam(value: string | null) {
  if (!value) return null;
  const [rawKey, rawValue] = value.split(":");
  const key = rawKey?.trim();
  const val = rawValue?.trim();
  if (!key) return null;
  if (val === "true") return [key, true] as const;
  if (val === "false") return [key, false] as const;
  if (val === "null") return [key, null] as const;
  return null;
}

export async function GET(req: NextRequest) {
  if (!isDevApiEnabled()) {
    return new NextResponse("dev api disabled", { status: 404 });
  }

  const overrides = readOverrides(req);
  for (const flagParam of req.nextUrl.searchParams.getAll("ff")) {
    const parsed = parseFlagParam(flagParam);
    if (!parsed) continue;
    const [key, value] = parsed;
    if (value === null) {
      delete overrides[key];
    } else {
      overrides[key] = value;
    }
  }

  const response = NextResponse.json({ ok: true, overrides });
  writeOverrides(response, req, overrides);
  return response;
}

export async function POST(req: NextRequest) {
  if (!isDevApiEnabled()) {
    return new NextResponse("dev api disabled", { status: 404 });
  }

  const overrides = readOverrides(req);
  try {
    const payload = await req.json();
    if (payload && typeof payload === "object") {
      for (const [rawKey, rawValue] of Object.entries(payload as Record<string, unknown>)) {
        if (rawValue === null) {
          delete overrides[rawKey];
        } else if (typeof rawValue === "boolean") {
          overrides[rawKey] = rawValue;
        }
      }
    }
  } catch {
    // ignore malformed JSON
  }

  const response = NextResponse.json({ ok: true, overrides });
  writeOverrides(response, req, overrides);
  return response;
}
