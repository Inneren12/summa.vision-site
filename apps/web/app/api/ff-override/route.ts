import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "sv_flags_override";

function isDevApiEnabled() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return process.env.SV_ALLOW_DEV_API === "1" || process.env.NEXT_PUBLIC_E2E === "1";
}

function parseOverrides(searchParams: URLSearchParams) {
  const overrides: Record<string, boolean | null> = {};
  for (const entry of searchParams.getAll("ff")) {
    const [key, rawValue] = entry.split(":");
    if (!key) continue;
    if (rawValue === "true") overrides[key] = true;
    else if (rawValue === "false") overrides[key] = false;
    else if (rawValue === "null") overrides[key] = null;
  }
  return overrides;
}

function mergeOverrides(base: Record<string, boolean>, delta: Record<string, boolean | null>) {
  const result: Record<string, boolean> = { ...base };
  for (const [key, value] of Object.entries(delta)) {
    if (value === null) {
      delete result[key];
    } else {
      result[key] = value;
    }
  }
  return result;
}

function readOverrides(req: NextRequest): Record<string, boolean> {
  try {
    const raw = req.cookies.get(COOKIE_NAME)?.value;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const entries = Object.entries(parsed as Record<string, unknown>);
    const result: Record<string, boolean> = {};
    for (const [key, value] of entries) {
      if (typeof value === "boolean") {
        result[key] = value;
      }
    }
    return result;
  } catch {
    return {};
  }
}

function cookieAttributes() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: false,
    maxAge: 60 * 60,
  };
}

export async function GET(req: NextRequest) {
  if (!isDevApiEnabled()) {
    return new NextResponse("dev api disabled", { status: 404 });
  }

  const base = readOverrides(req);
  const merged = mergeOverrides(base, parseOverrides(req.nextUrl.searchParams));
  const response = NextResponse.json({ ok: true, overrides: merged });
  if (Object.keys(merged).length) {
    response.cookies.set({
      name: COOKIE_NAME,
      value: JSON.stringify(merged),
      ...cookieAttributes(),
    });
  } else {
    response.cookies.set({ name: COOKIE_NAME, value: "", ...cookieAttributes(), maxAge: 0 });
  }
  return response;
}

export async function POST(req: NextRequest) {
  if (!isDevApiEnabled()) {
    return new NextResponse("dev api disabled", { status: 404 });
  }

  const base = readOverrides(req);
  let delta: Record<string, boolean | null> = {};
  try {
    const body = await req.json();
    if (body && typeof body === "object") {
      delta = Object.fromEntries(
        Object.entries(body as Record<string, unknown>)
          .filter(([, value]) => value === null || typeof value === "boolean")
          .map(([key, value]) => [key, value as boolean | null]),
      );
    }
  } catch {
    delta = {};
  }

  const merged = mergeOverrides(base, delta);
  const response = NextResponse.json({ ok: true, overrides: merged });
  if (Object.keys(merged).length) {
    response.cookies.set({
      name: COOKIE_NAME,
      value: JSON.stringify(merged),
      ...cookieAttributes(),
    });
  } else {
    response.cookies.set({ name: COOKIE_NAME, value: "", ...cookieAttributes(), maxAge: 0 });
  }
  return response;
}
