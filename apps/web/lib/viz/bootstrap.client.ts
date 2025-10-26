"use client";

import { deckAdapter } from "./adapters/deck";
import { echartsAdapter } from "./adapters/echarts";
import { mapLibreAdapter } from "./adapters/maplibre";
import { vegaLiteAdapter } from "./adapters/vegaLite";
import { visxAdapter } from "./adapters/visx";
import { registerAdapter } from "./registry";
import type { VizAdapter } from "./types";

type AnyAdapter = VizAdapter<unknown, unknown>;

// Регистрация по фичфлагам; в тестах флаги обычно пустые → побочек нет.
const CANDIDATES: Array<{ flag: string; lib: string; adapter: AnyAdapter }> = [
  { flag: "NEXT_PUBLIC_VIZ_DECK", lib: "deck", adapter: deckAdapter as unknown as AnyAdapter },
  {
    flag: "NEXT_PUBLIC_VIZ_ECHARTS",
    lib: "echarts",
    adapter: echartsAdapter as unknown as AnyAdapter,
  },
  {
    flag: "NEXT_PUBLIC_VIZ_MAPLIBRE",
    lib: "maplibre",
    adapter: mapLibreAdapter as unknown as AnyAdapter,
  },
  { flag: "NEXT_PUBLIC_VIZ_VEGA", lib: "vega", adapter: vegaLiteAdapter as unknown as AnyAdapter },
  { flag: "NEXT_PUBLIC_VIZ_VISX", lib: "visx", adapter: visxAdapter as unknown as AnyAdapter },
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
