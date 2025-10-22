import { buildCSP } from "./csp.mjs";

export function securityHeaders({ reportOnly = false, isDev = false, withSentry = false } = {}) {
  const csp = buildCSP({ isDev, withSentry });
  const cspKey = reportOnly ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";

  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
    { key: cspKey, value: csp },
  ];
}
