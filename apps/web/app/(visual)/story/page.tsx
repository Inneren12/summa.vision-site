import type { Metadata } from "next";

import { StorySteps } from "./StorySteps";

export const metadata: Metadata = {
  title: "Story deep links",
  description: "Demo story experience with step deep links and URL restoration.",
};

export default function StoryPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="bg-bg/80 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          Scrollytelling preview
        </p>
        <h1 className="mt-4 text-4xl font-bold">Infrastructure story with deep linked steps</h1>
        <p className="mt-4 text-lg text-muted">
          Navigate the steps below or copy the URL hash/query—refreshing or sharing restores the
          same section.
        </p>
      </header>
      <StorySteps />
    </main>
  );
}
