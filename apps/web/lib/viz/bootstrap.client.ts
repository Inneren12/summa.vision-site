"use client";

import { deckAdapter } from "./adapters/deck";
import { echartsAdapter } from "./adapters/echarts";
import { mapLibreAdapter } from "./adapters/maplibre";
import { vegaLiteAdapter } from "./adapters/vegaLite";
import { visxAdapter } from "./adapters/visx";
import { registerAdapter } from "./registry";
import type { VizAdapter, VizLibraryTag } from "./types";

type AnyAdapter = VizAdapter<unknown, unknown>;

function asAnyAdapter<TInstance, TSpec>(adapter: VizAdapter<TInstance, TSpec>): AnyAdapter {
  return adapter as unknown as AnyAdapter;
}

// Регистрация по фичфлагам; в тестах флаги обычно пустые → побочек нет.
const CANDIDATES: Array<{ flag: string; lib: VizLibraryTag; adapter: AnyAdapter }> = [
  { flag: "NEXT_PUBLIC_VIZ_DECK", lib: "deck", adapter: asAnyAdapter(deckAdapter) },
  { flag: "NEXT_PUBLIC_VIZ_ECHARTS", lib: "echarts", adapter: asAnyAdapter(echartsAdapter) },
  { flag: "NEXT_PUBLIC_VIZ_MAPLIBRE", lib: "maplibre", adapter: asAnyAdapter(mapLibreAdapter) },
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
