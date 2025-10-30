import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const env = (url.searchParams.get("env") || "").toLowerCase();
  const response = NextResponse.json({ ok: true, env });

  if (env) {
    response.cookies.set("sv_use_env", env, {
      path: "/",
      sameSite: "lax",
      secure: false,
      httpOnly: false,
      maxAge: 60 * 60,
    });
  } else {
    response.cookies.set("sv_use_env", "", { path: "/", maxAge: 0 });
  }

  return response;
}
