# Flags — Security & Privacy Appendix

## Cookies
- `sv_id`: anonymous stable identifier. **Not PII**. Attributes: `Path=/`, `SameSite=Lax`, `HttpOnly=false`, `Secure` (production).
- `sv_flags_override`: developer/testing override cookie. Max ~3KB, same attributes as above.
- No cross-site setting: `/api/ff-override` enforces same-origin (Origin/Referer) and tester token in production.

## Stable ID
- Anonymous users: `sv_id` (UUID v4). Max-Age ~1y. Reset on cookie removal.
- Authenticated users (S3+): `stableId("u:<userId>")` — sanitized and prefixed. Cross-device consistency.
- No third-party tracking, no cross-domain correlation.

## Rollout Salt
- Changing `salt` **reshuffles** cohorts. Keep salt stable or version the flag (`_v1`, `_v2`) for re-runs.

## Overrides
- Cookie overrides are **dev/test tools**; production is guarded (rate limit + tester token + same-origin).
- `ignoreOverrides: true` for security-critical flags.

## ENV
- All JSON configs are read **server-side** and never shipped to client bundles.
- `FEATURE_FLAGS_JSON` is validated in dev/test; issues are shown without logging ENV contents.

## Migration Path
1. Create flag → 0% (disabled).
2. Canary → 1–5%.
3. Ramp → 5% → 25% → 50%.
4. Full rollout → 100%.
5. Sunset: mark `deprecated: true`, set `sunsetDate`, keep for cookie/backward compatibility → remove after date.

## Troubleshooting
- Hydration mismatch? Ensure you use `<FlagsProvider>` + `useFlags()`; do not re-evaluate on client.
- Unknown flag in cookie? Prod returns 400; dev warns. Add to registry or remove cookie.

## Notes
- This document is repo-local and should be kept up to date with the registry and S2/S3 behavior.
