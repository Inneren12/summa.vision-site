import "server-only";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "true") {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  const url = new URL(req.url);
  const id = url.searchParams.get("id"); // 'random' | 'clear' | <custom>
  const res = NextResponse.json({ ok: true });
  if (id === "clear") {
    res.cookies.set("sv_id", "", {
      maxAge: 0,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
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
  res.cookies.set("sv_id", String(value), {
    maxAge: 365 * 24 * 60 * 60,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
