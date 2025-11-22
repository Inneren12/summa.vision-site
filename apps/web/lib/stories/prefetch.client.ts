"use client";

import { storyVisualizationSpecSchema } from "./schemas";
import type { StoryVisualizationSpec } from "./schemas";
import type { StoryVisualizationNeed, StoryVisualizationPrefetchPlan } from "./types";

import { emitVizEvent } from "@/lib/analytics/send";
import type { MotionMode, VizLibraryTag } from "@/lib/viz/types";

const needPromises = new Map<StoryVisualizationNeed, Promise<void>>();
const specPromises = new Map<string, Promise<StoryVisualizationSpec>>();
const specCache = new Map<string, StoryVisualizationSpec>();

const NEED_LOADERS: Record<StoryVisualizationNeed, () => Promise<void>> = {
  echarts: async () => {
    await import("@/lib/viz/adapters/echarts");
  },
  maplibre: async () => {
    const adapterModule = await import("@/lib/viz/adapters/maplibre.adapter");
    if (typeof adapterModule.loadMapLibre === "function") {
      await adapterModule.loadMapLibre();
    }
  },
  deck: async () => {
    await Promise.all([
      import("@/lib/viz/adapters/deck"),
      import("@deck.gl/core"),
      import("@deck.gl/mapbox"),
    ]);
  },
  vega: async () => {
    await Promise.all([import("@/lib/viz/adapters/vegaLite"), import("vega-embed")]);
  },
  visx: async () => {
    await import("@/lib/viz/adapters/visx");
  },
};

function loadNeed(need: StoryVisualizationNeed): Promise<void> {
  const cached = needPromises.get(need);
  if (cached) {
    return cached;
  }
  const loader = NEED_LOADERS[need];
  const task = loader ? loader().then(() => undefined) : Promise.resolve();
  needPromises.set(need, task);
  return task;
}

async function fetchSpec(specPath: string, signal?: AbortSignal): Promise<StoryVisualizationSpec> {
  const response = await fetch(`/api/story-spec?path=${encodeURIComponent(specPath)}`, {
    method: "GET",
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Unable to load story spec (${response.status})`);
  }

  const payload = await response.json();
  const parsed = storyVisualizationSpecSchema.safeParse(payload);
  if (!parsed.success) {
    throw parsed.error;
  }
  return parsed.data;
}

export async function loadStorySpec(
  specPath: string,
  options: { signal?: AbortSignal } = {},
): Promise<StoryVisualizationSpec> {
  const existing = specPromises.get(specPath);
  if (existing) {
    return existing;
  }

  const task = (async () => {
    const result = await fetchSpec(specPath, options.signal);
    specCache.set(specPath, result);
    return result;
  })();

  specPromises.set(specPath, task);

  try {
    return await task;
  } catch (error) {
    specPromises.delete(specPath);
    if (!options.signal || !options.signal.aborted) {
      specCache.delete(specPath);
    }
    throw error;
  }
}

export function getCachedStorySpec(specPath: string): StoryVisualizationSpec | undefined {
  return specCache.get(specPath);
}

interface PrefetchOptions {
  readonly signal?: AbortSignal;
  readonly lib?: VizLibraryTag;
  readonly motion: MotionMode;
  readonly storyId?: string;
}

export async function prefetchVisualizationAssets(
  plan: StoryVisualizationPrefetchPlan,
  options: PrefetchOptions,
): Promise<void> {
  if (options.signal?.aborted) {
    return;
  }

  const tasks: Promise<unknown>[] = [];

  for (const need of new Set(plan.needs)) {
    tasks.push(loadNeed(need));
  }

  if (plan.specPath) {
    const specTask = loadStorySpec(plan.specPath, { signal: options.signal })
      .then(() => {
        emitVizEvent("viz_spec_load", {
          lib: options.lib,
          motion: options.motion,
          storyId: options.storyId,
        });
      })
      .catch((error) => {
        if (
          options.signal?.aborted &&
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }
        throw error;
      });
    tasks.push(specTask);
  }

  await Promise.all(tasks);
}
