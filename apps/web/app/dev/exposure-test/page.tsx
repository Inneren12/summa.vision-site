"use client";

import { useEffect } from "react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function ExposureTestPage() {
  useEffect(() => {
    const id = Math.random().toString(36).slice(2);
    void fetch(`/api/dev/flags-events?emit=exposure-ssr-${id}`, {
      headers: { "x-msw-bypass": "true" },
    }).catch(() => {});
  }, []);

  return (
    <main className="p-6 space-y-3">
      <div data-testid="exp-a">exp-a</div>
      <div data-testid="exp-b">exp-b</div>
      <div data-testid="exp-c">exp-c</div>
    </main>
  );
}
