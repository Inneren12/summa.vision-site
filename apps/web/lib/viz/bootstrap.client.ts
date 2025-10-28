"use client";

import { vegaLiteAdapter } from "./adapters/vegaLite";
import { visxAdapter } from "./adapters/visx";
import { registerAdapter } from "./registry";
import type { VizAdapter, VizLibraryTag } from "./types";

type AnyAdapter = VizAdapter<unknown, Record<string, unknown>>;
type DynamicAdapterLoader = () => Promise<AnyAdapter>;

function asAnyAdapter<TInstance, TSpec extends object>(
  adapter: VizAdapter<TInstance, TSpec>,
): AnyAdapter {
  return adapter as unknown as AnyAdapter;
}

function registerStatic(flag: string, lib: VizLibraryTag, adapter: AnyAdapter) {
  if (process.env[flag] === "1") {
    try {
      registerAdapter(lib, adapter);
    } catch {
      /* не валим тесты/SSR */
    }
  }
}

function registerDynamic(flag: string, lib: VizLibraryTag, loader: DynamicAdapterLoader) {
  if (process.env[flag] !== "1") {
    return;
  }

  void loader()
    .then((adapter) => {
      try {
        registerAdapter(lib, adapter);
      } catch {
        /* ignore */
      }
    })
    .catch(() => {
      /* ignore */
    });
}

registerStatic("NEXT_PUBLIC_VIZ_VEGA", "vega", asAnyAdapter(vegaLiteAdapter));
registerStatic("NEXT_PUBLIC_VIZ_VISX", "visx", asAnyAdapter(visxAdapter));

const DYNAMIC_CANDIDATES: Array<{
  flag: string;
  lib: VizLibraryTag;
  loader: DynamicAdapterLoader;
}> = [
  {
    flag: "NEXT_PUBLIC_VIZ_DECK",
    lib: "deck",
    loader: async () => {
      const mod = await import("./adapters/deck");
      return asAnyAdapter(mod.deckAdapter);
    },
  },
  {
    flag: "NEXT_PUBLIC_VIZ_ECHARTS",
    lib: "echarts",
    loader: async () => {
      const mod = await import("./adapters/echarts");
      return asAnyAdapter(mod.echartsAdapter);
    },
  },
  {
    flag: "NEXT_PUBLIC_VIZ_MAPLIBRE",
    lib: "maplibre",
    loader: async () => {
      const mod = await import("./adapters/maplibre");
      return asAnyAdapter(mod.mapLibreAdapter);
    },
  },
];

for (const { flag, lib, loader } of DYNAMIC_CANDIDATES) {
  registerDynamic(flag, lib, loader);
}
