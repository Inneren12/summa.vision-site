import type { MapLibreSpec } from "../spec-types";
import type { VizAdapter } from "../types";

type MapLibreMap = import("maplibre-gl").Map;
type MapOptions = import("maplibre-gl").MapOptions;
type PaddingOptions = import("maplibre-gl").PaddingOptions;

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
  return {
    style: typeof spec.style === "string" ? spec.style : JSON.parse(JSON.stringify(spec.style)),
    camera: spec.camera
      ? {
          center: spec.camera.center ? ([...spec.camera.center] as [number, number]) : undefined,
          zoom: spec.camera.zoom,
          bearing: spec.camera.bearing,
          pitch: spec.camera.pitch,
          padding: spec.camera.padding ? { ...spec.camera.padding } : undefined,
        }
      : undefined,
    layers: spec.layers
      ? spec.layers.map((layer) => ({
          id: layer.id,
          op: layer.op,
          def: layer.def ? JSON.parse(JSON.stringify(layer.def)) : undefined,
        }))
      : undefined,
  } satisfies MapLibreSpec;
}

function isStyleEqual(previous: MapLibreSpec["style"], next: MapLibreSpec["style"]): boolean {
  if (typeof previous === "string" || typeof next === "string") {
    return previous === next;
  }
  try {
    return JSON.stringify(previous) === JSON.stringify(next);
  } catch {
    return false;
  }
}

function applyCamera(map: MapLibreMap, camera: MapLibreSpec["camera"], discrete: boolean) {
  if (!camera) {
    return;
  }

  if (camera.center) {
    map.setCenter(camera.center as MapOptions["center"]);
  }

  if (typeof camera.zoom === "number") {
    map.setZoom(camera.zoom);
  }

  if (typeof camera.pitch === "number") {
    map.setPitch(camera.pitch, { duration: discrete ? 0 : undefined });
  }

  if (typeof camera.bearing === "number") {
    map.setBearing(camera.bearing, { duration: discrete ? 0 : undefined });
  }

  if (camera.padding) {
    map.setPadding?.(camera.padding as PaddingOptions);
  }
}

function applyLayers(map: MapLibreMap, layers: MapLibreSpec["layers"]) {
  if (!layers?.length) {
    return;
  }

  for (const layer of layers) {
    const current = map.getLayer?.(layer.id);
    if (layer.op === "remove") {
      if (current) {
        map.removeLayer?.(layer.id);
      }
      continue;
    }

    const definition = layer.def;
    if (!definition) {
      continue;
    }

    if (layer.op === "update" && current) {
      map.removeLayer?.(layer.id);
    }

    if (layer.op === "add" && current) {
      map.removeLayer?.(layer.id);
    }

    map.addLayer?.(definition);
  }
}

function applyMapState(
  map: MapLibreMap,
  spec: MapLibreSpec,
  discrete: boolean,
  previous?: MapLibreSpec,
) {
  if (previous && !isStyleEqual(previous.style, spec.style)) {
    map.setStyle(spec.style, { diff: !discrete });
  }

  applyCamera(map, spec.camera, discrete);
  applyLayers(map, spec.layers);
}

export const mapLibreAdapter: VizAdapter<MapLibreInstance, MapLibreSpec> = {
  async mount(el, spec, opts) {
    const maplibre = await import("maplibre-gl");
    const clone = cloneSpec(spec);
    const mapOptions: MapOptions = {
      container: el,
      style: clone.style,
      center: clone.camera?.center,
      zoom: clone.camera?.zoom,
      bearing: clone.camera?.bearing,
      pitch: clone.camera?.pitch,
      padding: clone.camera?.padding as PaddingOptions | undefined,
    };
    const map = new maplibre.Map(mapOptions);
    applyMapState(map, clone, opts.discrete);
    return { map, spec: clone };
  },
  applyState(instance, next, opts) {
    const previousForCallback = cloneSpec(instance.spec);
    const spec = typeof next === "function" ? next(previousForCallback) : next;
    const clone = cloneSpec(spec);
    const previousStored = instance.spec;
    instance.spec = clone;
    applyMapState(instance.map, clone, opts.discrete, previousStored);
  },
  destroy(instance) {
    instance.map.remove();
  },
};
