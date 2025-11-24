import type { VizEventType } from "./types";

export const NECESSARY_LIFECYCLE_EVENTS: ReadonlySet<VizEventType> = new Set([
  "viz_init",
  "viz_ready",
  "viz_error",
]);
