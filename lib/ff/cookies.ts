import type { ResponseCookie } from "next/dist/compiled/@edge-runtime/cookies";

import { getEnv } from "@/lib/env/load";

/** Общие параметры cookie для фиче-флагов. */
export const FF_COOKIE_SAMESITE = "lax" as const;

type StableCookieInit = Partial<Omit<ResponseCookie, "name" | "value">> & {
  sameSite?: ResponseCookie["sameSite"];
  secure?: ResponseCookie["secure"];
  path?: ResponseCookie["path"];
  domain?: ResponseCookie["domain"];
};

function baseCookieOptions(): StableCookieInit {
  const env = getEnv();
  return {
    sameSite: FF_COOKIE_SAMESITE,
    secure: env.FF_COOKIE_SECURE,
    path: env.FF_COOKIE_PATH,
    domain: env.FF_COOKIE_DOMAIN,
  } satisfies StableCookieInit;
}

export function getFFCookieDomain(): string | undefined {
  return getEnv().FF_COOKIE_DOMAIN;
}

export function getFFCookiePath(): string {
  return getEnv().FF_COOKIE_PATH;
}

export function isFFCookieSecure(): boolean {
  return getEnv().FF_COOKIE_SECURE;
}

export function stableCookieOptions(overrides: StableCookieInit = {}): StableCookieInit {
  return {
    ...overrides,
    ...baseCookieOptions(),
  } satisfies StableCookieInit;
}

export function getPublicCookieOptions(overrides: StableCookieInit = {}): StableCookieInit {
  return stableCookieOptions({ ...overrides, httpOnly: false });
}

export function getPrivateCookieOptions(overrides: StableCookieInit = {}): StableCookieInit {
  return stableCookieOptions({ ...overrides, httpOnly: true });
}

export const FF_PUBLIC_COOKIE_OPTIONS = getPublicCookieOptions();
export const FF_PRIVATE_COOKIE_OPTIONS = getPrivateCookieOptions();
