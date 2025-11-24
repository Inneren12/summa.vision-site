import type { VizEventType } from "@/lib/viz/types";

export interface VizAnalyticsContext {
  adapter: string;
  vizId?: string;
  storyId?: string;
  route?: string;
  discrete?: boolean;
  stepId?: string;
}

export interface VizAnalyticsEvent {
  type: VizEventType;
  ts: number;
  context: VizAnalyticsContext;
  meta?: Record<string, unknown>;
  error?: {
    message?: string;
    name?: string;
    code?: string | number;
  };
}
