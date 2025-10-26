import type { VizAdapter } from "../types";

type MapLibreMap = import("maplibre-gl").Map;
type MapOptions = import("maplibre-gl").MapOptions;
type LngLatLike = import("maplibre-gl").LngLatLike;

export type MapLibreSpec = MapOptions & {
  readonly center?: LngLatLike;
  readonly zoom?: number;
  readonly pitch?: number;
  readonly bearing?: number;
};

interface MapLibreInstance {
  map: MapLibreMap;
  spec: MapLibreSpec;
}

function cloneSpec(spec: MapLibreSpec): MapLibreSpec {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // ignore
    }
  }
  return Object.assign({}, spec);
}

function applyMapState(map: MapLibreMap, spec: MapLibreSpec, discrete: boolean) {
  if (spec.style) {
    const currentStyle = map.getStyle()?.sprite;
    if (!currentStyle || currentStyle !== spec.style) {
      map.setStyle(spec.style, { diff: !discrete });
    }
  }

  if (spec.center) {
    map.setCenter(spec.center);
  }

  if (typeof spec.zoom === "number") {
    map.setZoom(spec.zoom);
  }

  if (typeof spec.pitch === "number") {
    map.setPitch(spec.pitch, { duration: discrete ? 0 : undefined });
  }

  if (typeof spec.bearing === "number") {
    map.setBearing(spec.bearing, { duration: discrete ? 0 : undefined });
  }
}

export const mapLibreAdapter: VizAdapter<MapLibreInstance, MapLibreSpec> = {
  async mount(el, spec, opts) {
    const maplibre = await import("maplibre-gl");
    const clone = cloneSpec(spec);
    const map = new maplibre.Map({ container: el, ...clone });
    applyMapState(map, clone, opts.discrete);
    return { map, spec: clone };
  },
  applyState(instance, next, opts) {
    const previous = cloneSpec(instance.spec);
    const spec = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(spec);
    instance.spec = clone;
    applyMapState(instance.map, clone, opts.discrete);
  },
  destroy(instance) {
    instance.map.remove();
  },
};
