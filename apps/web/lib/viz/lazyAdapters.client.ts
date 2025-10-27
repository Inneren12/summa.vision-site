import { createLazyAdapter } from "./lazyAdapter";
import type { VizAdapter } from "./types";

type AnyAdapter = VizAdapter<unknown, Record<string, unknown>>;

type LazyAdapterRecord = {
  readonly adapter: AnyAdapter;
  readonly prefetch: (options?: { discrete?: boolean; reason?: string }) => Promise<void>;
  readonly load: () => Promise<AnyAdapter>;
};

function wrapHandle(handle: ReturnType<typeof createLazyAdapter>): LazyAdapterRecord {
  return handle as unknown as LazyAdapterRecord;
}

export const lazyDeckAdapter = wrapHandle(
  createLazyAdapter("deck", async () => (await import("./adapters/deck")).deckAdapter),
);

export const lazyEChartsAdapter = wrapHandle(
  createLazyAdapter("echarts", async () => (await import("./adapters/echarts")).echartsAdapter),
);

export const lazyMapLibreAdapter = wrapHandle(
  createLazyAdapter("maplibre", async () => (await import("./adapters/maplibre")).mapLibreAdapter),
);

export const lazyVizAdapters = {
  deck: lazyDeckAdapter,
  echarts: lazyEChartsAdapter,
  maplibre: lazyMapLibreAdapter,
} satisfies Record<string, LazyAdapterRecord>;
