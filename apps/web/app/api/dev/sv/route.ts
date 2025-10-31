import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id") || randomUUID();

  const res = NextResponse.json({ id }, { headers: { "cache-control": "no-store" } });
  res.cookies.set("sv_id", id, {
    httpOnly: false,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: ONE_YEAR,
  });

  return res;
}
