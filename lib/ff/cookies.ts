/** Общие параметры cookie для фиче-флагов. */
export const FF_COOKIE_DOMAIN = process.env.FF_COOKIE_DOMAIN || undefined; // пример: ".example.com"
export const FF_COOKIE_PATH = "/";
export const FF_COOKIE_SECURE = process.env.NODE_ENV === "production";
