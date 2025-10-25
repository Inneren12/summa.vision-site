"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import type { JsErrorCorrelation } from "@/lib/reportError";
import { reportJsError } from "@/lib/reportError";

type ProvidersProps = {
  children: ReactNode;
  snapshotId: string;
  correlation: JsErrorCorrelation;
};

export function Providers({ children, snapshotId, correlation }: ProvidersProps) {
  const { requestId, sessionId, namespace } = correlation;

  useEffect(() => {
    if (!snapshotId) return;
    const context = { requestId, sessionId, namespace };
    const onError = (event: ErrorEvent) => {
      const message =
        event.message || (event.error instanceof Error ? event.error.message : undefined);
      const stack = event.error instanceof Error ? event.error.stack : undefined;
      void reportJsError(snapshotId, context, {
        message,
        stack,
        filename: event.filename || undefined,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error ? reason.message : reason != null ? String(reason) : undefined;
      const stack = reason instanceof Error ? reason.stack : undefined;
      void reportJsError(snapshotId, context, {
        message,
        stack,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [snapshotId, namespace, requestId, sessionId]);

  return (
    <GlobalErrorBoundary snapshotId={snapshotId} correlation={correlation}>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
      </ThemeProvider>
    </GlobalErrorBoundary>
  );
}
