"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useEffect } from "react";

function readSnapshotId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.body?.dataset.ffSnapshot || undefined;
}

function postBeacon(url: string, payload: Record<string, unknown>, snapshot: string) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    if (typeof fetch === "undefined") return;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-ff-snapshot": snapshot,
    };
    fetch(url, {
      method: "POST",
      headers,
      body,
      keepalive: true,
    }).catch(() => {
      /* ignore */
    });
  } catch {
    /* noop */
  }
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const snapshotId = readSnapshotId();
    if (!snapshotId) return;
    const onError = (event: ErrorEvent) => {
      postBeacon(
        "/api/js-error",
        {
          message: event.message,
          stack: event.error?.stack,
        },
        snapshotId,
      );
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      postBeacon(
        "/api/js-error",
        {
          message: event.reason instanceof Error ? event.reason.message : String(event.reason),
          stack: event.reason instanceof Error ? event.reason.stack : undefined,
        },
        snapshotId,
      );
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  );
}
