import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

import { correlationFromNextContext } from "../../../lib/metrics/correlation";

import { Providers } from "./providers";

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
      <body className="bg-bg text-fg" data-ff-snapshot={snapshotId}>
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
