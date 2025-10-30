import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
const COOKIE_NAME = "sv_id";
const FF_COOKIE_NAME = "ff_aid";

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
    httpOnly: false,
    secure: req.nextUrl.protocol === "https:",
    ...overrides,
  } satisfies CookieAttributes;
}

function randomId() {
  const crypto = globalThis.crypto as Crypto | undefined;
  if (crypto?.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `sv_${Math.random().toString(16).slice(2, 18)}`;
}

export async function GET(req: NextRequest) {
  if (!isDevApiEnabled()) {
    return new NextResponse("dev api disabled", { status: 404 });
  }

  const url = req.nextUrl;
  const requestedId = url.searchParams.get("id");
  const response = NextResponse.json({ ok: true });

  if (requestedId === "clear") {
    const removal = cookieOptions(req, { maxAge: 0 });
    response.cookies.set({ name: COOKIE_NAME, value: "", ...removal });
    response.cookies.set({ name: FF_COOKIE_NAME, value: "", ...removal });
    return response;
  }

  const id = !requestedId || requestedId === "random" ? randomId() : requestedId;
  const cookieValue = id.slice(0, 64);
  const attrs = cookieOptions(req, { maxAge: COOKIE_MAX_AGE });

  response.cookies.set({ name: COOKIE_NAME, value: cookieValue, ...attrs });
  response.cookies.set({ name: FF_COOKIE_NAME, value: cookieValue, ...attrs });

  return response;
}
