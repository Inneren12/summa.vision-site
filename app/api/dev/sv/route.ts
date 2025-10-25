import "server-only";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env/load";
import { stableCookieOptions } from "@/lib/ff/cookies";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!getEnv().NEXT_PUBLIC_DEV_TOOLS) {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id"); // 'random' | 'clear' | <custom>
  const res = NextResponse.json({ ok: true });
  if (id === "clear") {
    res.cookies.set("sv_id", "", stableCookieOptions({ httpOnly: false, maxAge: 0 }));
    res.cookies.set("ff_aid", "", stableCookieOptions({ httpOnly: false, maxAge: 0 }));
    return res;
  }
  let value = id;
  if (!value || value === "random") {
    const crypto = globalThis.crypto as Crypto | undefined;
    if (crypto && typeof crypto.randomUUID === "function") {
      value = crypto.randomUUID();
    } else {
      value = `sv_${Date.now().toString(36)}`;
    }
  }
  const cookieValue = String(value);
  const attrs = stableCookieOptions({ httpOnly: false, maxAge: 365 * 24 * 60 * 60 });
  res.cookies.set("sv_id", cookieValue, attrs);
  res.cookies.set("ff_aid", cookieValue, attrs);
  return res;
}
