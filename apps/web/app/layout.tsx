import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";
import "klaro/dist/klaro.min.css";

import { correlationFromNextContext } from "../../../lib/metrics/correlation";

import { Providers } from "./providers";

import { ConsentPreferencesButton } from "@/components/ConsentPreferencesButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { buildMetadata } from "@/lib/seo";
import { SITE, canonical } from "@/lib/seo/site";

const defaultCanonical = canonical("/");
const languageAlternates: Record<string, string> = Object.fromEntries(
  SITE.locales.map((locale) => [locale, canonical("/", locale)]),
);

languageAlternates["x-default"] = defaultCanonical;

export const metadata: Metadata = buildMetadata({
  metadataBase: SITE.baseUrl,
  alternates: {
    canonical: defaultCanonical,
    languages: languageAlternates,
  },
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    url: defaultCanonical,
    locale: "en_US",
  },
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
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
    <html lang={SITE.defaultLocale} suppressHydrationWarning>
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
