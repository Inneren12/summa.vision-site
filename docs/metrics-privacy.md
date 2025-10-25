# Metrics privacy guard

This service only collects health telemetry (web vitals and runtime errors). To stay compliant with GDPR/CCPA we gate every ingestion endpoint behind both the user's browser privacy preferences and our consent banner state.

## Consent levels

We recognize two consent levels:

- `necessary` (default): minimal, privacy-preserving telemetry for service health only.
- `all`: full diagnostics where stack traces and request URLs remain available for debugging.

Consent is resolved in the following order: an explicit `x-consent` header wins, the `sv_consent` cookie is used as a fallback, and a missing or malformed value defaults to `necessary`.

## Respecting the "Do Not Track" signal

If the incoming request carries any of the standard DNT headers (`DNT`, `X-Do-Not-Track`, or `Sec-GPC`) with an enabled value (`1`, `yes`), the API short-circuits immediately with a `204` response and **does not** persist any event. The response emits the header `sv-telemetry-status: ok:true, skipped:true` so clients can log the skip without parsing a body.

## Sensitive fields and modes

When consent is limited to `necessary` we **only** persist the enumerated allow-list below. Every other field—including URLs, selectors, stack traces, filenames, and arbitrary nested metadata—is removed prior to storage.

| Allow-listed key | Notes |
| ---------------- | ----- |
| `eventType` | Event classification for interaction metrics. |
| `navigationType` | Navigation type reported by the Web Vitals attribution helpers. |
| `loadState` | Load state tag emitted by the attribution helper. |
| `timeToFirstByte` | Timing data needed for LCP/FCP trend analysis. |
| `firstByteToFCP` | Complementary timing to `timeToFirstByte`. |
| `resourceLoadDelay` | Breakdown of resource loading delays for LCP. |
| `resourceLoadTime` | Breakdown of resource loading durations for LCP. |
| `elementRenderDelay` | Rendering delay component for LCP. |
| `interactionType` | Interaction category for INP diagnostics. |
| `interactionTime` | Timestamp used to plot INP spikes. |
| `inputDelay` | Input delay value for INP. |
| `processingDuration` | Processing duration component for INP. |
| `presentationDelay` | Presentation delay component for INP. |
| `totalBlockingTime` | Blocking time metric for INP/LCP analysis. |
| `largestShiftValue` | Aggregate layout shift magnitude (no DOM references). |
| `largestShiftTime` | Timestamp of the largest shift. |
| `totalShiftValue` | Cumulative layout shift value. |
| `largestInteractionType` | Interaction classification for INP outliers. |
| `largestInteractionTime` | Timestamp for the largest interaction. |
| `rating` | Web Vital qualitative rating. |

The list intentionally excludes targets, selectors, URLs, stack traces, filenames, and any nested objects. This may remove helpful debugging context; during local investigations you can temporarily opt-in to `x-consent: all` to retain full payloads.

When consent is `all`, the guard bypasses the allow-list and persists the payload verbatim for diagnostic parity.

## Identifiers for DSR clean-up

Every stored event is annotated with the stable visitor identifier (`sid`, sourced from the `sv_id` cookie or `x-sid` header) and the account identifier (`aid`, taken from the `sv_aid` cookie or `x-aid` header when present). These markers let us locate and delete telemetry quickly during Data Subject Requests.

## Erasure workflow

- `POST /api/privacy/erase` — self-service, deletes the current `sv_id` / `ff_aid` cookies from future telemetry. Admins (`x-ff-console-role: admin|ops`) may pass a JSON payload with `userId`, `sid`, or `aid` to trigger a Data Subject Request; feature-flag overrides for that user are deleted as part of the operation.
- `GET /api/privacy/status` — returns `{ erased: true }` when the resolved identifiers (from cookies or explicit query params) already reside in the erasure registry.

Erased identifiers are appended to `.runtime/privacy.erasure.ndjson`. The metrics providers (`SelfMetricsProvider` and `SelfHostedMetricsProvider`) filter vitals/error events using that registry, so p75/error-rate reports exclude deleted visitors immediately. For small (<50 MB) NDJSON logs (`telemetry.ndjson`, `vitals.ndjson`, `errors.ndjson`) we rewrite the files in place to remove matching lines; larger files fall back to lazy filtering until the next rotation.

Aggregated or anonymous audit rows without `sid`/`userId` markers are not altered.

## Endpoints covered

- `POST /api/vitals`
- `POST /api/js-error`
- `POST /api/privacy/erase`
- `GET /api/privacy/status`

The telemetry ingestion routes share the same privacy guard logic described above.
