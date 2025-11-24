import type { VizEvent, VizEventType } from "./types";

type VizBrowserEventName = VizEventType | "viz_lifecycle";

export const NECESSARY_LIFECYCLE_EVENTS: ReadonlySet<VizEventType> = new Set([
  "viz_init",
  "viz_ready",
  "viz_error",
]);

export function dispatchVizBrowserEvent(
  type: VizBrowserEventName,
  detail: VizEvent | Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;

  const event = new CustomEvent(type, { detail, bubbles: false });
  window.dispatchEvent(event);
}
