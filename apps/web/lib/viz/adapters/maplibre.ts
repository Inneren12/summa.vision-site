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
    const map = new maplibre.Map({ container: el, ...spec });
    applyMapState(map, spec, opts.discrete);
    return { map, spec };
  },
  applyState(instance, next, opts) {
    const spec = typeof next === "function" ? next(instance.spec) : next;
    instance.spec = spec;
    applyMapState(instance.map, spec, opts.discrete);
  },
  destroy(instance) {
    instance.map.remove();
  },
};
