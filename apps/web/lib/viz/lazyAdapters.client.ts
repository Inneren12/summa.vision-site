"use client";

export type AdapterLoader<T = unknown> = () => Promise<T>;

/**
 * Набор ленивых загрузчиков. Никаких top-level import "maplibre-gl"/"echarts"/"deck.gl" здесь быть не должно.
 * Каждый пункт — только () => import("…").
 */
export const lazyAdapters = {
  echarts: () => import("./adapters/echarts.adapter"),
  deck: () => import("./adapters/deck"),
  map: () => import("./adapters/maplibre.adapter"),
} satisfies Record<string, AdapterLoader>;
