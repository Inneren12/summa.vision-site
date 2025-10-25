import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";

import { Providers } from "./providers";

import { ThemeToggle } from "@/components/ThemeToggle";
import type { JsErrorCorrelation } from "@/lib/reportError";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata();

const HEADER_NAMESPACE_CANDIDATES = ["x-ff-namespace", "x-namespace", "x-tenant"] as const;

function sanitize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function resolveNamespace(hdrs: Headers | null): string {
  if (!hdrs) return "default";
  for (const key of HEADER_NAMESPACE_CANDIDATES) {
    const value = hdrs.get(key);
    if (value && value.trim()) {
      return value.trim();
    }
  }
  return "default";
}

function readCorrelation(hdrs: Headers | null): JsErrorCorrelation {
  const requestId = sanitize(hdrs?.get("x-request-id"));
  let sessionId: string | null = null;
  try {
    const cookieStore = cookies();
    sessionId =
      sanitize(cookieStore.get("ff_aid")?.value) || sanitize(cookieStore.get("sv_id")?.value);
  } catch {
    sessionId = null;
  }

  return {
    requestId,
    sessionId,
    namespace: resolveNamespace(hdrs),
  };
}

export default function RootLayout({ children }: { children: ReactNode }) {
  let headerStore: Headers | null = null;
  try {
    headerStore = headers();
  } catch {
    headerStore = null;
  }
  const snapshotId = headerStore?.get("x-ff-snapshot") ?? "";
  const correlation = readCorrelation(headerStore);
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg text-fg" data-ff-snapshot={snapshotId}>
        <Providers snapshotId={snapshotId} correlation={correlation}>
          <a href="#main" className="sr-only focus:not-sr-only">
            Skip to content
          </a>
          <div className="min-h-screen bg-bg text-fg">
            <header className="border-b border-muted/20">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
                <span className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
                  Summa Vision
                </span>
                <ThemeToggle />
              </div>
            </header>
            <main id="main" role="main" className="px-4 py-8">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
