import { NextRequest, NextResponse } from "next/server";

import { FF_COOKIE_DOMAIN, FF_COOKIE_PATH, FF_COOKIE_SECURE } from "@/lib/ff/cookies";
import { FF } from "@/lib/ff/runtime";

export function middleware(req: NextRequest) {
  const snapshot = FF().snapshot();
  const has = req.cookies.get("sv_id")?.value;
  if (!has) {
    const res = NextResponse.next();
    res.cookies.set("sv_id", crypto.randomUUID(), {
      maxAge: 365 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: "lax",
      secure: FF_COOKIE_SECURE,
      path: FF_COOKIE_PATH,
      domain: FF_COOKIE_DOMAIN,
    });
    res.headers.set("x-ff-snapshot", snapshot.id);
    return res;
  }
  const res = NextResponse.next();
  res.headers.set("x-ff-snapshot", snapshot.id);
  return res;
}
