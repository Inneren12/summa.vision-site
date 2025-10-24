import "server-only";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NEXT_PUBLIC_DEV_TOOLS !== "true") {
    return NextResponse.json({ error: "Dev tools disabled" }, { status: 404 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set("sv_flags_override", "", {
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
