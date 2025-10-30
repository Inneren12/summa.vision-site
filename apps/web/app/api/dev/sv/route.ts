import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const COOKIE_NAME = "sv_id";
const ALT_COOKIE_NAME = "ff_aid";
const ONE_YEAR = 60 * 60 * 24 * 365;

function isDevApiEnabled() {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }
  return process.env.SV_ALLOW_DEV_API === "1" || process.env.NEXT_PUBLIC_E2E === "1";
}

function randomId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(16).slice(2, 18);
  }
}

export async function GET(req: NextRequest) {
  if (!isDevApiEnabled()) {
    return new NextResponse("dev api disabled", { status: 404 });
  }

  const requested = req.nextUrl.searchParams.get("id");
  const response = NextResponse.json({ ok: true });

  if (requested === "clear") {
    response.cookies.set({
      name: COOKIE_NAME,
      value: "",
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: false,
      maxAge: 0,
    });
    response.cookies.set({
      name: ALT_COOKIE_NAME,
      value: "",
      path: "/",
      httpOnly: false,
      sameSite: "lax",
      secure: false,
      maxAge: 0,
    });
    return response;
  }

  const id = !requested || requested === "random" ? randomId() : requested;
  const value = id.slice(0, 64);

  const attributes = {
    path: "/",
    httpOnly: false,
    sameSite: "lax" as const,
    secure: false,
    maxAge: ONE_YEAR,
  };

  response.cookies.set({ name: COOKIE_NAME, value, ...attributes });
  response.cookies.set({ name: ALT_COOKIE_NAME, value, ...attributes });

  return response;
}
