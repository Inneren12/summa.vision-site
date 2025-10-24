import crypto from "node:crypto";

import { cookies, headers } from "next/headers";

import { FF_COOKIE_DOMAIN, FF_COOKIE_PATH, FF_COOKIE_SECURE } from "./cookies";
import type { Seeds } from "./core/ports";

type WritableCookies = {
  set?: (
    name: string,
    value: string,
    options: {
      httpOnly?: boolean;
      sameSite?: "lax" | "strict" | "none";
      secure?: boolean;
      path?: string;
      domain?: string;
      maxAge?: number;
    },
  ) => void;
  get(name: string): { value: string } | undefined;
};

export function getOrSetAnonCookie(existing?: string | null): string {
  if (existing) return existing;
  try {
    const jar = cookies() as unknown as WritableCookies;
    let id = jar.get?.("sv_id")?.value;
    if (!id) {
      id = crypto.randomUUID();
      if (typeof jar.set === "function") {
        jar.set("sv_id", id, {
          httpOnly: false,
          sameSite: "lax",
          secure: FF_COOKIE_SECURE,
          path: FF_COOKIE_PATH,
          domain: FF_COOKIE_DOMAIN,
          maxAge: 60 * 60 * 24 * 365,
        });
      }
    }
    return id ?? "anon";
  } catch {
    return "anon";
  }
}

export function resolveSeeds(init?: {
  userId?: string | null;
  cookie?: string | null;
  anonId?: string | null;
  ip?: string | null;
  ua?: string | null;
}): Seeds {
  let userId = init?.userId ?? undefined;
  let cookieId = init?.cookie ?? init?.anonId ?? undefined;
  let ip = init?.ip ?? undefined;
  let ua = init?.ua ?? undefined;

  try {
    const jar = cookies() as unknown as WritableCookies;
    if (!userId) userId = jar.get?.("user_id")?.value;
    if (!cookieId) cookieId = jar.get?.("sv_id")?.value;
  } catch {
    // ignore
  }

  try {
    const h = headers();
    if (!ua) ua = h.get("user-agent") ?? undefined;
    if (!ip) {
      const raw = h.get("x-forwarded-for") ?? "";
      const first = raw.split(",")[0]?.trim();
      if (first) ip = first;
    }
  } catch {
    // ignore
  }

  const anon = getOrSetAnonCookie(cookieId);
  const hash = crypto
    .createHash("sha1")
    .update(`${ip ?? "0.0.0.0"}|${ua ?? ""}`)
    .digest("hex");

  return {
    userId: userId ?? undefined,
    cookie: anon,
    anonId: anon,
    ipUa: hash,
  };
}
