import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

/** Общие параметры cookie для фиче-флагов. */
export const FF_COOKIE_DOMAIN = process.env.FF_COOKIE_DOMAIN || undefined; // пример: ".example.com"
export const FF_COOKIE_PATH = process.env.FF_COOKIE_PATH || "/";
export const FF_COOKIE_SECURE =
  process.env.FF_COOKIE_SECURE != null
    ? process.env.FF_COOKIE_SECURE.toLowerCase() === "true"
    : process.env.NODE_ENV === "production";
export const FF_COOKIE_SAMESITE = "lax" as const;

type StableCookieInit = Partial<Omit<ResponseCookie, "name" | "value">> & {
  sameSite?: ResponseCookie["sameSite"];
  secure?: ResponseCookie["secure"];
  path?: ResponseCookie["path"];
  domain?: ResponseCookie["domain"];
};

const BASE_COOKIE_OPTIONS: StableCookieInit = {
  sameSite: FF_COOKIE_SAMESITE,
  secure: FF_COOKIE_SECURE,
  path: FF_COOKIE_PATH,
  domain: FF_COOKIE_DOMAIN,
};

export function stableCookieOptions(overrides: StableCookieInit = {}): StableCookieInit {
  return {
    ...overrides,
    ...BASE_COOKIE_OPTIONS,
  };
}
