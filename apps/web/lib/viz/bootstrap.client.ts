"use client";

import { vegaLiteAdapter } from "./adapters/vegaLite";
import { visxAdapter } from "./adapters/visx";
import { lazyDeckAdapter, lazyEChartsAdapter, lazyMapLibreAdapter } from "./lazyAdapters.client";
import { registerAdapter } from "./registry";
import type { VizAdapter, VizLibraryTag } from "./types";

type AnyAdapter = VizAdapter<unknown, Record<string, unknown>>;

function asAnyAdapter<TInstance, TSpec extends object>(
  adapter: VizAdapter<TInstance, TSpec>,
): AnyAdapter {
  return adapter as unknown as AnyAdapter;
}

// Регистрация по фичфлагам; в тестах флаги обычно пустые → побочек нет.
const CANDIDATES: Array<{ flag: string; lib: VizLibraryTag; adapter: AnyAdapter }> = [
  { flag: "NEXT_PUBLIC_VIZ_DECK", lib: "deck", adapter: asAnyAdapter(lazyDeckAdapter.adapter) },
  {
    flag: "NEXT_PUBLIC_VIZ_ECHARTS",
    lib: "echarts",
    adapter: asAnyAdapter(lazyEChartsAdapter.adapter),
  },
  {
    flag: "NEXT_PUBLIC_VIZ_MAPLIBRE",
    lib: "maplibre",
    adapter: asAnyAdapter(lazyMapLibreAdapter.adapter),
  },
  { flag: "NEXT_PUBLIC_VIZ_VEGA", lib: "vega", adapter: asAnyAdapter(vegaLiteAdapter) },
  { flag: "NEXT_PUBLIC_VIZ_VISX", lib: "visx", adapter: asAnyAdapter(visxAdapter) },
];

for (const { flag, lib, adapter } of CANDIDATES) {
  if (process.env[flag] === "1") {
    try {
      registerAdapter(lib, adapter);
    } catch {
      /* не валим тесты/SSR */
    }
  }
}
