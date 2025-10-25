"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { useEffect } from "react";

import { getClientEventBuffer } from "./telemetry/client-buffer";

function readSnapshotId(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.body?.dataset.ffSnapshot || undefined;
}

export function Providers({ children }: { children: ReactNode }) {
  useEffect(() => {
    const snapshotId = readSnapshotId();
    if (!snapshotId) return;
    const buffer = getClientEventBuffer({ url: "/api/js-error", snapshotId });
    const onError = (event: ErrorEvent) => {
      buffer.enqueue({
        message: event.message,
        stack: event.error?.stack,
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      buffer.enqueue({
        message: event.reason instanceof Error ? event.reason.message : String(event.reason),
        stack: event.reason instanceof Error ? event.reason.stack : undefined,
      });
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
