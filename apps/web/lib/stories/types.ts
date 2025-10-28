export type StoryVisualizationNeed = "vega" | "echarts" | "maplibre" | "visx" | "deck";

export interface StoryVisualizationPrefetchPlan {
  readonly needs: StoryVisualizationNeed[];
  readonly specPath?: string;
}
