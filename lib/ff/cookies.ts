/** Общие параметры cookie для фиче-флагов. */
export const FF_COOKIE_DOMAIN = process.env.FF_COOKIE_DOMAIN || undefined; // пример: ".example.com"
export const FF_COOKIE_PATH = process.env.FF_COOKIE_PATH || "/";
export const FF_COOKIE_SECURE = process.env.NODE_ENV === "production";
export const FF_COOKIE_SAME_SITE = "lax" as const;

export const FF_COOKIE_BASE_OPTIONS = {
  sameSite: FF_COOKIE_SAME_SITE,
  secure: FF_COOKIE_SECURE,
  path: FF_COOKIE_PATH,
  domain: FF_COOKIE_DOMAIN,
};

export const FF_PUBLIC_COOKIE_OPTIONS = {
  ...FF_COOKIE_BASE_OPTIONS,
  httpOnly: false as const,
};

export const FF_PRIVATE_COOKIE_OPTIONS = {
  ...FF_COOKIE_BASE_OPTIONS,
  httpOnly: true as const,
};

export const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
