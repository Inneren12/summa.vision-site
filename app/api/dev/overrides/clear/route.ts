import "server-only";
import { NextResponse } from "next/server";

import { getEnv } from "@/lib/env/load";

export const runtime = "nodejs";

export async function POST() {
  const env = getEnv();
  if (!env.NEXT_PUBLIC_DEV_TOOLS) {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sv_flags_override", "", {
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: env.NODE_ENV === "production",
  });
  return res;
}
