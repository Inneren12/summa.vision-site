import type { Metadata } from "next";

import { StorySteps } from "./StorySteps";
import { storyOfflineContent } from "./story-static-content";

export const metadata: Metadata = {
  title: "Story deep links",
  description: "Demo story experience with step deep links and URL restoration.",
};

export default function StoryPage() {
  return (
    <main className="min-h-screen bg-bg text-fg">
      <header className="bg-bg/80 py-16 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          {storyOfflineContent.heroTagline}
        </p>
        <h1 className="mt-4 text-4xl font-bold">{storyOfflineContent.heroTitle}</h1>
        <p className="mt-4 text-lg text-muted">{storyOfflineContent.heroDescription}</p>
      </header>
      <StorySteps />
    </main>
  );
}
