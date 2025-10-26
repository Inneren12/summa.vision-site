"use client";

if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("@/lib/viz/bootstrap.client");
}

import { ThemeProvider } from "next-themes";
import type { ReactNode, ErrorInfo } from "react";
import { useCallback, useEffect, useMemo } from "react";

import type { RequestCorrelation } from "../../../lib/metrics/correlation";

import { getClientEventBuffer } from "./telemetry/client-buffer";

import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";

function readSnapshotId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.body?.dataset.ffSnapshot || undefined;
}

type ProvidersProps = {
  children: ReactNode;
  correlation: RequestCorrelation;
};

type ReporterPayload = {
  message?: string;
  stack?: string;
  componentStack?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  url?: string;
  source?: string;
};

type JsErrorReporter = {
  send: (payload: ReporterPayload) => void;
};

function createJsErrorReporter(correlation: RequestCorrelation): JsErrorReporter {
  let buffer: ReturnType<typeof getClientEventBuffer> | null = null;
  const seen = new Set<string>();

  const ensureBuffer = () => {
    if (buffer) return buffer;
    const snapshotId = readSnapshotId();
    if (!snapshotId) return null;
    buffer = getClientEventBuffer({ url: "/api/js-error", snapshotId });
    return buffer;
  };

  const withCorrelation = (payload: ReporterPayload & { message: string }) => ({
    ...payload,
    requestId: correlation.requestId ?? undefined,
    sessionId: correlation.sessionId ?? undefined,
    namespace: correlation.namespace,
  });

  const getUrl = (payload: ReporterPayload) => {
    if (typeof payload.url === "string") return payload.url;
    if (typeof window === "undefined") return undefined;
    try {
      return window.location?.href;
    } catch {
      return undefined;
    }
  };

  return {
    send(payload) {
      const target = ensureBuffer();
      if (!target) return;

      const message =
        typeof payload.message === "string" && payload.message.trim().length > 0
          ? payload.message
          : "Unknown error";
      const dedupeKey = `${correlation.requestId ?? "?"}:${message}`;
      if (seen.has(dedupeKey)) return;
      seen.add(dedupeKey);

      target.enqueue(
        withCorrelation({
          ...payload,
          url: getUrl(payload),
          message,
        }),
      );
    },
  };
}

export function Providers({ children, correlation }: ProvidersProps) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const reporter = useMemo(
    () => createJsErrorReporter(correlation),
    [correlation.namespace, correlation.requestId, correlation.sessionId],
  );

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      reporter.send({
        message: event.message,
        stack: event.error instanceof Error ? event.error.stack : undefined,
        filename: event.filename,
        lineno: event.lineno ?? undefined,
        colno: event.colno ?? undefined,
        source: "window:error",
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : (() => {
                try {
                  return JSON.stringify(reason);
                } catch {
                  return String(reason);
                }
              })();
      reporter.send({
        message,
        stack: reason instanceof Error ? reason.stack : undefined,
        source: "window:unhandledrejection",
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [reporter]);

  const handleBoundaryError = useCallback(
    (error: Error, info?: ErrorInfo) => {
      reporter.send({
        message: error?.message,
        stack: error?.stack,
        componentStack: info?.componentStack ?? undefined,
        source: "boundary",
      });
    },
    [reporter],
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <GlobalErrorBoundary
        onError={handleBoundaryError}
        showStack={process.env.NODE_ENV !== "production"}
      >
        {children}
      </GlobalErrorBoundary>
    </ThemeProvider>
  );
}
