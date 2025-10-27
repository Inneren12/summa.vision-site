import type { VizEventName } from "./types";

export const NECESSARY_VIZ_EVENTS: ReadonlySet<VizEventName> = new Set([
  "viz_init",
  "viz_ready",
  "viz_error",
]);
