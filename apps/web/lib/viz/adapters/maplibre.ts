import { sendVizEvent } from "../events";
import type { MapLibreSpec, MapLibrePadding } from "../spec-types";
import type { MotionMode, VizAdapter } from "../types";

let stylesPromise: Promise<void> | null = null;

async function ensureMapLibreStyles(): Promise<void> {
  if (stylesPromise) {
    await stylesPromise;
    return;
  }

  if (typeof document === "undefined") {
    stylesPromise = Promise.resolve();
    await stylesPromise;
    return;
  }

  if (process.env.NODE_ENV === "test") {
    stylesPromise = Promise.resolve();
    await stylesPromise;
    return;
  }

  stylesPromise = import("maplibre-gl/dist/maplibre-gl.css").then(() => {});
  await stylesPromise;
}

// Лёгкие локальные типы: не завязываемся на версию maplibre-gl
type PaddingOptions = number | { top: number; right: number; bottom: number; left: number };
interface MapOptions {
  container: HTMLElement;
  style: string | object;
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  padding?: PaddingOptions;
  [key: string]: unknown;
}
type CameraState = {
  center?: [number, number];
  zoom?: number;
  bearing?: number;
  pitch?: number;
  padding?: MapLibrePadding;
};
interface MapLibreMap {
  on(event: string, handler: (...args: unknown[]) => void): void;
  off(event: string, handler: (...args: unknown[]) => void): void;
  getCanvas(): HTMLCanvasElement;
  getContainer?(): HTMLElement;
  fitBounds(bounds: unknown, options?: { padding?: PaddingOptions; duration?: number }): void;
  resize(): void;
  remove(): void;
  setCenter(center: [number, number]): void;
  setZoom(zoom: number): void;
  setPitch(pitch: number, options?: { duration?: number }): void;
  setBearing(bearing: number, options?: { duration?: number }): void;
  setPadding?(padding: PaddingOptions): void;
  easeTo?(options: CameraState & { duration?: number }): void;
  jumpTo?(options: CameraState): void;
  getLayer?(id: string): unknown;
  getSource?(id: string): unknown;
  removeLayer?(id: string): void;
  addLayer?(definition: unknown): void;
  setStyle(style: string | object, options?: { diff?: boolean }): void;
  isStyleLoaded?(): boolean;
}

interface MapLibreInstance {
  map: MapLibreMap;
  container: HTMLElement;
  spec: MapLibreSpec;
  discrete: boolean;
  cleanup: Array<() => void>;
}

function toMotion(discrete: boolean): MotionMode {
  return discrete ? "discrete" : "animated";
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

function parseCssLength(value: string | null | undefined, doc: Document | null): number {
  const raw = value?.trim();
  if (!raw) {
    return 0;
  }
  if (raw === "0") {
    return 0;
  }
  if (raw.endsWith("px")) {
    const parsed = Number.parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (!doc?.body) {
    return 0;
  }
  const probe = doc.createElement("div");
  probe.style.position = "absolute";
  probe.style.visibility = "hidden";
  probe.style.width = raw;
  probe.style.height = "0";
  probe.style.padding = "0";
  probe.style.border = "0";
  doc.body.appendChild(probe);
  const width = probe.offsetWidth;
  probe.remove();
  return Number.isFinite(width) ? width : 0;
}

function resolveStickyTop(element: HTMLElement): number {
  const doc = element.ownerDocument ?? null;
  const win = doc?.defaultView ?? null;
  if (!doc || !win) {
    return 0;
  }
  const style = win.getComputedStyle(element);
  const fromElement = style.getPropertyValue("--sticky-top");
  if (fromElement.trim()) {
    return parseCssLength(fromElement, doc);
  }
  const rootValue = win.getComputedStyle(doc.documentElement).getPropertyValue("--sticky-top");
  return parseCssLength(rootValue, doc);
}

function resolveCameraPadding(
  element: HTMLElement,
  padding?: MapLibrePadding,
): MapLibrePadding | undefined {
  const stickyTop = resolveStickyTop(element);
  if (!padding && stickyTop <= 0) {
    return undefined;
  }

  const next: MapLibrePadding = padding ? { ...padding } : {};
  if (stickyTop > 0) {
    next.top = (next.top ?? 0) + stickyTop;
  }

  const entries = Object.entries(next).filter(
    ([, value]) => typeof value === "number" && Number.isFinite(value),
  );
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries) as MapLibrePadding;
}

function applyCamera(
  instance: MapLibreInstance,
  camera: MapLibreSpec["camera"],
  discrete: boolean,
) {
  if (!camera) {
    return;
  }

  const padding = resolveCameraPadding(instance.container, camera.padding);
  const target: CameraState = {};

  if (camera.center) {
    target.center = camera.center;
  }
  if (typeof camera.zoom === "number") {
    target.zoom = camera.zoom;
  }
  if (typeof camera.bearing === "number") {
    target.bearing = camera.bearing;
  }
  if (typeof camera.pitch === "number") {
    target.pitch = camera.pitch;
  }
  if (padding) {
    target.padding = padding;
  }

  if (Object.keys(target).length === 0) {
    return;
  }

  if (!discrete && typeof instance.map.easeTo === "function") {
    instance.map.easeTo({ ...target });
    return;
  }

  if (typeof instance.map.jumpTo === "function") {
    instance.map.jumpTo(target);
    return;
  }

  if (target.center) {
    instance.map.setCenter(target.center);
  }
  if (typeof target.zoom === "number") {
    instance.map.setZoom(target.zoom);
  }
  if (typeof target.pitch === "number") {
    instance.map.setPitch(target.pitch, { duration: discrete ? 0 : undefined });
  }
  if (typeof target.bearing === "number") {
    instance.map.setBearing(target.bearing, { duration: discrete ? 0 : undefined });
  }
  if (target.padding) {
    instance.map.setPadding?.(target.padding as PaddingOptions);
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

    const sourceId =
      typeof definition === "object" && definition !== null
        ? ((definition as { source?: string }).source ?? undefined)
        : undefined;
    if (sourceId && typeof map.getSource === "function" && !map.getSource(sourceId)) {
      continue;
    }

    map.addLayer?.(definition);
  }
}

function applyMapState(
  instance: MapLibreInstance,
  spec: MapLibreSpec,
  discrete: boolean,
  previous?: MapLibreSpec,
) {
  if (previous && !isStyleEqual(previous.style, spec.style)) {
    instance.map.setStyle(spec.style, { diff: !discrete });
  }

  applyCamera(instance, spec.camera, discrete);
  applyLayers(instance.map, spec.layers);
}

function setupResizeObserver(map: MapLibreMap, element: HTMLElement): (() => void) | null {
  const ResizeObs = globalThis.ResizeObserver;
  if (typeof ResizeObs !== "function") {
    return null;
  }

  const win = element.ownerDocument?.defaultView ?? globalThis;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pending = false;

  const clear = () => {
    if (timeoutId !== null) {
      win.clearTimeout(timeoutId);
      timeoutId = null;
    }
    pending = false;
  };

  const schedule = () => {
    if (timeoutId === null) {
      map.resize();
      timeoutId = win.setTimeout(() => {
        timeoutId = null;
        if (pending) {
          pending = false;
          schedule();
        }
      }, 150);
      return;
    }
    pending = true;
  };

  const observer = new ResizeObs(() => {
    schedule();
  });
  observer.observe(element);

  return () => {
    observer.disconnect();
    clear();
  };
}

function waitForLoad(map: MapLibreMap): Promise<void> {
  if (typeof map.isStyleLoaded === "function" && map.isStyleLoaded()) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const handleLoad = () => {
      map.off("load", handleLoad);
      resolve();
    };
    map.on("load", handleLoad);
  });
}

function extractErrorMessage(event: unknown): string | undefined {
  if (!event) {
    return undefined;
  }
  if (typeof event === "string") {
    return event;
  }
  if (event instanceof Error) {
    return event.message;
  }
  if (typeof event === "object") {
    const message = (event as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
    const error = (event as { error?: unknown }).error;
    if (typeof error === "string") {
      return error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === "object" && error) {
      const nested = (error as { message?: unknown }).message;
      if (typeof nested === "string") {
        return nested;
      }
    }
  }
  return undefined;
}

function setupErrorHandling(instance: MapLibreInstance): () => void {
  const handler = (event: unknown) => {
    const message = extractErrorMessage(event) ?? "Unknown MapLibre error";
    sendVizEvent("viz_error", {
      lib: "maplibre",
      motion: toMotion(instance.discrete),
      reason: "runtime",
      error: message,
    });
  };
  instance.map.on("error", handler);
  return () => {
    instance.map.off("error", handler);
  };
}

function resolveMapConstructor(mod: unknown): new (options: MapOptions) => MapLibreMap {
  if (typeof mod === "function") {
    return mod as new (options: MapOptions) => MapLibreMap;
  }

  if (mod && typeof (mod as { Map?: unknown }).Map === "function") {
    return (mod as { Map: new (options: MapOptions) => MapLibreMap }).Map;
  }

  const defaultExport = (mod as { default?: unknown }).default;

  if (typeof defaultExport === "function") {
    return defaultExport as new (options: MapOptions) => MapLibreMap;
  }

  if (defaultExport && typeof (defaultExport as { Map?: unknown }).Map === "function") {
    return (defaultExport as { Map: new (options: MapOptions) => MapLibreMap }).Map;
  }

  throw new Error("MapLibre constructor not found");
}

export const mapLibreAdapter: VizAdapter<MapLibreInstance, MapLibreSpec> = {
  async mount(el, spec, opts) {
    await ensureMapLibreStyles();
    const mod = await import("maplibre-gl");
    const clone = cloneSpec(spec);
    const initialPadding = resolveCameraPadding(el, clone.camera?.padding);
    const mapOptions: MapOptions = {
      container: el,
      style: clone.style,
      center: clone.camera?.center,
      zoom: clone.camera?.zoom,
      bearing: clone.camera?.bearing,
      pitch: clone.camera?.pitch,
      padding: initialPadding as PaddingOptions | undefined,
    };
    // Универсально получаем конструктор (ESM/CJS/стаб)
    const MapCtor = resolveMapConstructor(mod);
    const map: MapLibreMap = new MapCtor(mapOptions);

    const instance: MapLibreInstance = {
      map,
      container: el,
      spec: clone,
      discrete: opts.discrete,
      cleanup: [],
    };

    const removeErrorHandler = setupErrorHandling(instance);
    instance.cleanup.push(removeErrorHandler);

    const stopResizeObserver = setupResizeObserver(map, el);
    if (stopResizeObserver) {
      instance.cleanup.push(stopResizeObserver);
    }

    await waitForLoad(map);

    applyMapState(instance, clone, opts.discrete);
    map.resize();

    return instance;
  },
  applyState(instance, next, opts) {
    const previousForCallback = cloneSpec(instance.spec);
    const spec = typeof next === "function" ? next(previousForCallback) : next;
    const clone = cloneSpec(spec);
    const previousStored = instance.spec;
    instance.spec = clone;
    instance.discrete = opts.discrete;
    applyMapState(instance, clone, opts.discrete, previousStored);
  },
  destroy(instance) {
    while (instance.cleanup.length > 0) {
      const cleanup = instance.cleanup.pop();
      try {
        cleanup?.();
      } catch {
        // ignore cleanup errors
      }
    }
    instance.map.remove();
  },
};
