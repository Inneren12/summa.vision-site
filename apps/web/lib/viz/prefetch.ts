import { lazyVizAdapters } from "./lazyAdapters.client";
import type { VizLibraryTag } from "./types";

export async function prefetchVizAdapter(
  lib: VizLibraryTag,
  options?: { discrete?: boolean; reason?: string },
): Promise<void> {
  const entry = lazyVizAdapters[lib as keyof typeof lazyVizAdapters];
  if (!entry) {
    return;
  }
  await entry.prefetch(options);
}
