import { parseCookieHeader } from "./overrides";

export function getStableIdFromCookieHeader(cookieHeader?: string): string | undefined {
  if (!cookieHeader) return undefined;
  const jar = parseCookieHeader(cookieHeader);
  return jar["sv_id"];
}
