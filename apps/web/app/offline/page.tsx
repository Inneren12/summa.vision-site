import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { storyOfflineContent } from "../(visual)/story/story-static-content";

export const metadata: Metadata = {
  title: "Offline fallback",
  description:
    "You appear to be offline. Cached story steps and the Summa Vision cover remain available until the connection returns.",
};

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-16 lg:flex-row">
        <aside className="flex flex-col items-center gap-6 rounded-3xl border border-muted/30 bg-bg/80 p-8 text-center shadow-lg backdrop-blur">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            {storyOfflineContent.heroTagline}
          </p>
          <Image
            src={storyOfflineContent.coverImage.src}
            alt={storyOfflineContent.coverImage.alt}
            width={256}
            height={256}
            className="h-40 w-40 rounded-3xl border border-muted/30 bg-muted/10 object-contain p-6"
            priority
          />
          <h1 className="text-3xl font-semibold">{storyOfflineContent.heroTitle}</h1>
          <p className="text-sm text-muted">{storyOfflineContent.heroDescription}</p>
          <div className="space-y-2 rounded-2xl border border-muted/20 bg-warning/5 p-4 text-left text-sm">
            <p className="font-semibold text-warning">You are offline</p>
            <p className="text-muted">
              The latest cached content is shown below. When you reconnect, refresh to restore live
              visualisations and interactive data.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full border border-muted/30 px-4 py-2 text-sm font-medium text-accent transition hover:border-accent/70 hover:text-accent"
            prefetch={false}
          >
            Return home
          </Link>
        </aside>
        <section className="flex-1 space-y-8">
          <h2 className="text-xl font-semibold">Story steps (cached)</h2>
          <ol className="space-y-6">
            {storyOfflineContent.steps.map((step) => (
              <li
                key={step.id}
                className="rounded-2xl border border-muted/20 bg-bg/70 p-6 shadow-sm"
              >
                <h3 className="text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted">{step.description}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
