# Metrics privacy guard

This service only collects health telemetry (web vitals and runtime errors). To stay compliant with GDPR/CCPA we gate every ingestion endpoint behind both the user's browser privacy preferences and our consent banner state.

## Consent levels

We recognize two consent levels:

- `necessary` (default): minimal, privacy-preserving telemetry for service health only.
- `all`: full diagnostics where stack traces and request URLs remain available for debugging.

The level can be supplied via the `x-consent` header or the `sv_consent` cookie. Missing or malformed values fall back to `necessary`.

## Respecting the "Do Not Track" signal

If the incoming request carries any of the standard DNT headers (`DNT`, `X-Do-Not-Track`, or `Sec-GPC`) with an enabled value (`1`, `yes`), the API responds with `{"skipped": true}` and **does not** persist any event.

## Sensitive fields

When consent is limited to `necessary` we strip the following Personally Identifiable Information (PII) fields from the payload before persisting it:

| Field      | Notes                                                    |
| ---------- | -------------------------------------------------------- |
| `url`      | Removed from vital payloads, error reports, and metadata |
| `message`  | JavaScript error message bodies                          |
| `stack`    | JavaScript stack traces                                  |
| `filename` | Source filenames reported with JS errors                 |

Nested metadata (for example, attribution details) is scrubbed recursively to ensure no sensitive keys survive inside objects or arrays.

When consent is `all`, the fields above are retained to aid incident debugging.

## Identifiers for DSR clean-up

Every stored event is annotated with the stable visitor identifier (`sid`, sourced from the `sv_id` cookie or `x-sid` header) and the account identifier (`aid`, taken from the `sv_aid` cookie or `x-aid` header when present). These markers let us locate and delete telemetry quickly during Data Subject Requests.

## Endpoints covered

- `POST /api/vitals`
- `POST /api/js-error`

Both routes share the same privacy guard logic described above.

## Data erasure requests (GDPR/CCPA)

To support right-to-be-forgotten workflows we maintain an erasure registry at `PRIVACY_ERASURE_FILE` (defaults to
`./.runtime/privacy.erasure.ndjson`). Each entry contains the identifiers that must be forgotten (`sid`, `aid`, and/or `userId`) and
the timestamp of the request. Telemetry providers consult this registry and ignore matching events when computing aggregate
metrics.

- `POST /api/privacy/erase` (no role header) — self-service endpoint. The current `sv_id` / `sv_aid` / `ff_aid` cookies are added to
  the erasure registry, the response clears those cookies, and any matching vitals/errors/telemetry entries are purged from the
  local NDJSON logs (when the files are under 50 MB).
- `POST /api/privacy/erase` (`x-ff-console-role: admin|ops`) — administrative erasure by `userId` (with optional `sid`/`aid`). This
  endpoint removes all user overrides, appends the identifiers to the erasure registry, and logs a `privacy_erase` audit event with
  a summary of the purge.
- `GET /api/privacy/status` — reports whether the caller's cookies (or query parameters `sid`/`aid`/`userId`) are already marked as
  erased.

For large NDJSON files (> 50 MB) the purge happens lazily: events remain on disk until rotation, but analytics ignore them by
consulting the erasure registry.
