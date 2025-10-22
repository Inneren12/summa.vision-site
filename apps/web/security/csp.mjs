export function buildCSP({ isDev = false, withSentry = false } = {}) {
  const directives = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
    "img-src": ["'self'", "data:", "https:"],
    "style-src": ["'self'", "'unsafe-inline'"],
    "font-src": ["'self'", "data:"],
    "connect-src": ["'self'"].concat(withSentry ? ["https://*.sentry.io"] : []),
    "script-src": ["'self'"].concat(isDev ? ["'unsafe-eval'"] : []).concat(["'unsafe-inline'"]),
    "form-action": ["'self'"],
  };

  return Object.entries(directives)
    .map(([key, value]) =>
      Array.isArray(value) && value.length ? `${key} ${value.join(" ")}` : key,
    )
    .join("; ");
}
