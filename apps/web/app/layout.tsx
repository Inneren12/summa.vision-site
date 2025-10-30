import type { Metadata, Viewport } from "next";
import dynamic from "next/dynamic";
import { headers } from "next/headers";
import type { ReactNode } from "react";

// Глобальные токены и стили подключаем только в корневом layout,
// чтобы Next.js не ругался на импорты CSS вне App Router.
import "./tokens.css";
import "./typography.css";
import "./globals.css";
import "klaro/dist/klaro.min.css";

import { correlationFromNextContext } from "../../../lib/metrics/correlation";

const E2EInit = dynamic(() => import("./e2e-init.client"), { ssr: false });
import { Providers } from "./providers";

import { ConsentPreferencesButton } from "@/components/ConsentPreferencesButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata();

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  let snapshotId = "";
  try {
    snapshotId = headers().get("x-ff-snapshot") ?? "";
  } catch {
    snapshotId = "";
  }
  const correlation = correlationFromNextContext();
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="bg-bg text-fg"
        data-ff-snapshot={snapshotId}
        data-e2e={
          process.env.CI === "true" ||
          process.env.NEXT_PUBLIC_E2E === "1" ||
          process.env.SV_ALLOW_DEV_API === "1"
            ? "1"
            : "0"
        }
        data-e2e-ci={process.env.CI === "true" ? "1" : "0"}
      >
        <E2EInit />
        <Providers correlation={correlation}>
          <a href="#main" className="sr-only focus:not-sr-only">
            Skip to content
          </a>
          <div className="min-h-screen bg-bg text-fg">
            <header className="border-b border-muted/20">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-4">
                <span className="text-sm font-medium uppercase tracking-[0.2em] text-muted">
                  Summa Vision
                </span>
                <div className="flex items-center gap-3">
                  <ThemeToggle />
                  <ConsentPreferencesButton />
                </div>
              </div>
            </header>
            <main id="main" role="main" className="px-4 py-8">
              {children}
            </main>
          </div>
        </Providers>
        <div id="klaro" aria-live="polite" />
      </body>
    </html>
  );
}
