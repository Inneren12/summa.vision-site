"use client";

import { deckAdapter } from "@/lib/viz/adapters/deck";
import { echartsAdapter } from "@/lib/viz/adapters/echarts";
import { mapLibreAdapter } from "@/lib/viz/adapters/maplibre";
import { vegaLiteAdapter } from "@/lib/viz/adapters/vegaLite";
import { visxAdapter } from "@/lib/viz/adapters/visx";
import { registerAdapter } from "@/lib/viz/registry";
import type { VizAdapter, VizLibraryTag } from "@/lib/viz/types";

type AnyAdapter = VizAdapter<unknown, unknown>;

const ADAPTERS: Array<{
  flag: string;
  lib: VizLibraryTag;
  adapter: AnyAdapter;
}> = [
  {
    flag: "NEXT_PUBLIC_VIZ_DECK",
    lib: "deck",
    adapter: deckAdapter as unknown as AnyAdapter,
  },
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
  {
    flag: "NEXT_PUBLIC_VIZ_VEGA",
    lib: "vega",
    adapter: vegaLiteAdapter as unknown as AnyAdapter,
  },
  {
    flag: "NEXT_PUBLIC_VIZ_VISX",
    lib: "visx",
    adapter: visxAdapter as unknown as AnyAdapter,
  },
];

function isEnabled(flag: string): boolean {
  const value = process.env[flag];
  return value === undefined || value === "1";
}

for (const entry of ADAPTERS) {
  if (isEnabled(entry.flag)) {
    registerAdapter(entry.lib, entry.adapter);
  }
}
