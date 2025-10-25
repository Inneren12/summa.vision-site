export type JsErrorCorrelation = {
  requestId: string | null;
  sessionId: string | null;
  namespace: string;
};

export type JsErrorPayload = {
  message?: string;
  stack?: string;
  url?: string;
  filename?: string;
};

const reportedErrors = new Set<string>();

function dedupeKey(correlation: JsErrorCorrelation, message: string | undefined) {
  const req = correlation.requestId ?? "no-request";
  const msg = message && message.trim() ? message : "unknown";
  return `${req}::${msg}`;
}

function headersFor(snapshotId: string, correlation: JsErrorCorrelation) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-ff-snapshot": snapshotId,
  };
  if (correlation.requestId) {
    headers["x-request-id"] = correlation.requestId;
  }
  if (correlation.sessionId) {
    headers["x-sid"] = correlation.sessionId;
  }
  if (correlation.namespace) {
    headers["x-ff-namespace"] = correlation.namespace;
  }
  return headers;
}

async function postJson(
  url: string,
  payload: JsErrorPayload,
  snapshotId: string,
  correlation: JsErrorCorrelation,
) {
  try {
    if (typeof fetch === "undefined") return;
    const headers = headersFor(snapshotId, correlation);
    const body = JSON.stringify(payload);
    await fetch(url, {
      method: "POST",
      headers,
      body,
      keepalive: true,
    });
  } catch {
    // ignore network errors
  }
}

export async function reportJsError(
  snapshotId: string,
  correlation: JsErrorCorrelation,
  payload: JsErrorPayload,
) {
  if (!snapshotId) return;

  const key = dedupeKey(correlation, payload.message);
  if (reportedErrors.has(key)) {
    return;
  }
  reportedErrors.add(key);

  await postJson("/api/js-error", payload, snapshotId, correlation);
}

export function __resetReportedJsErrors() {
  reportedErrors.clear();
}
