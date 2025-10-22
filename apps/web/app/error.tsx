"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    const hub = typeof Sentry.getCurrentHub === "function" ? Sentry.getCurrentHub() : undefined;
    if (hub?.getClient()) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <section className="p-8">
      <h2 className="text-xl font-bold">Error</h2>
      <pre className="mt-2 text-sm">{error.message}</pre>
      <button className="mt-4 border px-3 py-1" type="button" onClick={() => reset()}>
        Retry
      </button>
    </section>
  );
}
