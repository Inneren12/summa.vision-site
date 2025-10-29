import type { StoryVisualizationNeed as StoryVisualizationNeedType } from "./schemas";

export type StoryVisualizationNeed = StoryVisualizationNeedType;
export type { StoryFrontMatter, StoryStep } from "./schemas";

export interface StoryVisualizationPrefetchPlan {
  readonly needs: StoryVisualizationNeed[];
  readonly specPath?: string;
}
