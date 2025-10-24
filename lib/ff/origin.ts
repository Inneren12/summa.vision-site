/** Check that request is same-origin (Origin/Referer) against allowed origin. */
export function isSameSiteRequest(req: Request, fallbackOrigin?: string): boolean {
  const allowed = (
    process.env.ORIGIN ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    fallbackOrigin ||
    ""
  ).trim();
  // If we still don't have allowed origin, derive from request URL.
  const allowedOrigin = allowed || new URL(req.url).origin;
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const okOrigin = !origin || origin.startsWith(allowedOrigin);
  const okReferer = !referer || referer.startsWith(allowedOrigin);
  return okOrigin && okReferer;
}
