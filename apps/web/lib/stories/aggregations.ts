import { desc, from, op } from "arquero";

import type { StoryFrontMatter, StoryVisualizationNeed } from "./schemas";

const NO_VIZ_LIBRARY = "none" as const;

type VizLibraryBucket = StoryVisualizationNeed | typeof NO_VIZ_LIBRARY;

type StepsPerStory = {
  readonly slug: string;
  readonly title: string;
  readonly stepCount: number;
};

type VizLibraryUsageEntry = {
  readonly lib: VizLibraryBucket;
  readonly count: number;
};

type VizNeedUsageEntry = {
  readonly need: StoryVisualizationNeed;
  readonly stories: number;
  readonly occurrences: number;
};

export interface StoryAggregations {
  readonly totals: {
    readonly stories: number;
    readonly steps: number;
  };
  readonly stepsPerStory: StepsPerStory[];
  readonly vizLibraryUsage: VizLibraryUsageEntry[];
  readonly vizNeedUsage: VizNeedUsageEntry[];
}

export function buildStoryAggregations(stories: StoryFrontMatter[]): StoryAggregations {
  const storyRows = stories.map((story) => ({
    slug: story.slug,
    title: story.title,
    vizLib: (story.viz?.lib ?? NO_VIZ_LIBRARY) as VizLibraryBucket,
    stepCount: story.steps.length,
  }));

  const storyTable = from(storyRows);

  const rollupRow = storyTable
    .rollup({
      stories: () => op.count(),
      steps: (d) => op.sum(d.stepCount),
    })
    .objects()[0] ?? { stories: 0, steps: 0 };

  const stepsPerStory = storyTable
    .select("slug", "title", "stepCount")
    .orderby(desc("stepCount"), "slug")
    .objects() as StepsPerStory[];

  const vizLibraryUsage = (
    storyTable
      .groupby("vizLib")
      .rollup({ count: () => op.count() })
      .orderby(desc("count"), "vizLib")
      .objects() as Record<string, unknown>[]
  )
    // Берём только корректные строки: vizLib:string, count:number
    .filter(
      (row): row is { vizLib: string; count: number } =>
        typeof row.vizLib === "string" && typeof row.count === "number",
    )
    .map(({ vizLib, count }) => ({
      lib: vizLib as VizLibraryBucket,
      count,
    }));

  const needRows = stories.flatMap((story) =>
    (story.viz?.needs ?? []).map((need) => ({
      need,
      slug: story.slug,
    })),
  );

  const needTable = from(needRows);

  const vizNeedUsage =
    needTable.numRows() === 0
      ? []
      : (
          needTable
            .groupby("need")
            .rollup({
              occurrences: () => op.count(),
              storySlugs: (d) => op.array_agg(d.slug),
            })
            .orderby(desc("occurrences"), "need")
            .objects() as Record<string, unknown>[]
        )
          // Берём только строки с нужными типами: need:string, occurrences:number
          .filter(
            (row): row is { need: string; occurrences: number; storySlugs?: unknown } =>
              typeof row.need === "string" && typeof row.occurrences === "number",
          )
          .map(({ need, occurrences, storySlugs }) => ({
            need: need as StoryVisualizationNeed,
            occurrences,
            stories: Array.isArray(storySlugs) ? new Set((storySlugs as string[]) ?? []).size : 0,
          }));

  return {
    totals: {
      stories: Number(rollupRow.stories ?? 0),
      steps: Number(rollupRow.steps ?? 0),
    },
    stepsPerStory,
    vizLibraryUsage,
    vizNeedUsage,
  } satisfies StoryAggregations;
}
