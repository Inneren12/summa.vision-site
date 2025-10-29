export interface StoryStepContent {
  id: string;
  title: string;
  description: string;
}

export interface StoryOfflineContent {
  readonly heroTagline: string;
  readonly heroTitle: string;
  readonly heroDescription: string;
  readonly coverImage: { src: string; alt: string };
  readonly steps: readonly StoryStepContent[];
}

export const storyOfflineContent: StoryOfflineContent = {
  heroTagline: "Scrollytelling preview",
  heroTitle: "Infrastructure story with deep linked steps",
  heroDescription:
    "Navigate the steps below or copy the URL hash/query—refreshing or sharing restores the same section.",
  coverImage: {
    src: "/brand/summa-vision-mark.png",
    alt: "Summa Vision logomark",
  },
  steps: [
    {
      id: "baseline",
      title: "Baseline momentum",
      description:
        "Summa Vision’s programmes start by mapping existing community assets and aligning local partners around a shared north star. Baseline data on education, health, and climate risks lets teams focus on leverage points rather than duplicating efforts.",
    },
    {
      id: "activation",
      title: "Activation and pilots",
      description:
        "Pilot projects launch quickly to prove traction—think microgrid pilots, digital skills cohorts, or regenerative agriculture demos. Every activation publishes metrics publicly so peers can replicate what works.",
    },
    {
      id: "scale",
      title: "Scaling with partners",
      description:
        "Once the pilot playbook is solid, it expands with regional delivery partners. Shared infrastructure, toolkits, and funding rails help municipalities and NGOs adopt the blueprint while adapting to local context.",
    },
    {
      id: "impact",
      title: "Measuring real outcomes",
      description:
        "Impact dashboards track emissions avoided, jobs created, and resilience gains. Communities can subscribe to alerts for new data drops, and media kits make it easy to report on progress without waiting for quarterly summaries.",
    },
  ],
} as const;

export const storySteps = storyOfflineContent.steps;
