import { NextResponse } from "next/server";

function generateStableId(): string {
  const cryptoObj = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function middleware(req: Request) {
  // Lightweight: only ensure sv_id
  const cookieHeader = req.headers.get("cookie") || "";
  const hasId = cookieHeader.split(";").some((c) => c.trim().startsWith("sv_id="));
  if (hasId) return NextResponse.next();

  const res = NextResponse.next();
  const secure = process.env.NODE_ENV === "production";
  const domain = process.env.FLAGS_COOKIE_DOMAIN;

  res.cookies.set({
    name: "sv_id",
    value: generateStableId(),
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    secure,
    maxAge: 60 * 60 * 24 * 365,
    ...(domain ? { domain } : {}),
  });
  return res;
}
