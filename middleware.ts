import { NextRequest, NextResponse } from "next/server";

import { FF_COOKIE_DOMAIN, FF_COOKIE_PATH, FF_COOKIE_SECURE } from "@/lib/ff/cookies";
import { composeMemoryRuntime } from "@/lib/ff/runtime.memory";
import { resolveSeeds } from "@/lib/ff/seed";
import { buildSnapshotFromList } from "@/lib/ff/snapshot";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();

  let svId = req.cookies.get("sv_id")?.value;
  if (!svId) {
    svId = crypto.randomUUID();
    res.cookies.set("sv_id", svId, {
      maxAge: 365 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: "lax",
      secure: FF_COOKIE_SECURE,
      path: FF_COOKIE_PATH,
      domain: FF_COOKIE_DOMAIN,
    });
  }

  try {
    const { store } = composeMemoryRuntime();
    const ns = "public";
    const flags = await store.listFlags(ns);
    const seeds = resolveSeeds({
      cookie: svId,
      userId: req.cookies.get("user_id")?.value ?? null,
      ua: req.headers.get("user-agent"),
      ip: req.ip ?? req.headers.get("x-forwarded-for"),
    });
    const ctx = {
      tenant: undefined,
      locale: req.headers.get("x-locale") ?? undefined,
      path: req.nextUrl.pathname,
      ua: req.headers.get("user-agent") ?? undefined,
    };
    const snapshot = buildSnapshotFromList(flags, seeds, ctx);
    if (snapshot) {
      res.headers.set("x-ff-snapshot", snapshot);
    }
  } catch {
    // swallow middleware snapshot errors
  }

  return res;
}

export const config = { matcher: ["/((?!_next|api/dev/ff-reload|favicon.ico).*)"] };
