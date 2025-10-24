import { NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest) {
  const has = req.cookies.get("sv_id")?.value;
  if (!has) {
    const res = NextResponse.next();
    res.cookies.set({
      name: "sv_id",
      value: crypto.randomUUID(),
      maxAge: 365 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      ...(process.env.FLAGS_COOKIE_DOMAIN ? { domain: process.env.FLAGS_COOKIE_DOMAIN } : {}),
    });
    return res;
  }
  return NextResponse.next();
}
