import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get("sv_id")) {
    res.cookies.set({
      name: "sv_id",
      value: randomUUID().replace(/-/g, ""),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: ONE_YEAR,
    });
  }
  return res;
}

export const config = {
  matcher: [
    "/((?!_next|.*\\.(?:js|css|png|jpg|jpeg|gif|svg|ico|map)|sw\\.js|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml|api/healthz).*)",
  ],
};
