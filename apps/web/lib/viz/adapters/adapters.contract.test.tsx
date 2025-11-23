import { tokens } from "@root/src/shared/theme/tokens";
import brandTokens from "@root/tokens/brand.tokens.json";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { emitVizEvent } from "../../analytics/send";
import type { VizHarnessEventDetail } from "../VizHarness";

const defaultEmbedResult = () => {
  const view = {
    finalize: vi.fn(),
    runAsync: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn(function thisFn(this: typeof view) {
      return this;
    }),
    signal: vi.fn(function thisFn(this: typeof view) {
      return this;
    }),
  };
  return { view };
};
const embedMock = vi.fn(async () => defaultEmbedResult());
vi.mock("vega-embed", () => ({
  default: embedMock,
}));

const mapSetStyle = vi.fn();
const mapSetCenter = vi.fn();
const mapSetZoom = vi.fn();
const mapSetPitch = vi.fn();
const mapSetBearing = vi.fn();
const mapSetPadding = vi.fn();
const mapAddLayer = vi.fn();
const mapRemoveLayer = vi.fn();
const mapGetLayer = vi.fn();
const mapGetSource = vi.fn();
const mapRemove = vi.fn();
const mapEaseTo = vi.fn();
const mapJumpTo = vi.fn();
const mapResize = vi.fn();
const mapAddControl = vi.fn();
const mapRemoveControl = vi.fn();

class MapMock {
  constructor(options: Record<string, unknown>) {
    this.options = options;
    this.layers = new Map();
    this.listeners = new Map();
    this.container = options.container as HTMLElement;
    this.canvas = document.createElement("canvas");
    this.container.appendChild(this.canvas);
    queueMicrotask(() => {
      this.emit("load");
    });
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: Record<string, any>;
  layers: Map<string, unknown>;
  listeners: Map<string, Set<(...args: unknown[]) => void>>;
  container: HTMLElement;
  canvas: HTMLCanvasElement;
  controls: Set<unknown> = new Set();
  controlPositions: Map<unknown, string | undefined> = new Map();
  on(event: string, handler: (...args: unknown[]) => void) {
    const collection = this.listeners.get(event) ?? new Set();
    collection.add(handler);
    this.listeners.set(event, collection);
  }
  off(event: string, handler: (...args: unknown[]) => void) {
    this.listeners.get(event)?.delete(handler);
  }
  emit(event: string, payload?: unknown) {
    const handlers = this.listeners.get(event);
    if (!handlers) {
      return;
    }
    for (const handler of [...handlers]) {
      handler(payload);
    }
  }
  getCanvas() {
    return this.canvas;
  }
  getContainer() {
    return this.container;
  }
  getStyle() {
    return typeof this.options.style === "string"
      ? { sprite: this.options.style }
      : ((this.options.style as Record<string, unknown> | undefined) ?? null);
  }
  resize = () => {
    mapResize();
  };
  easeTo = (options: unknown) => {
    mapEaseTo(options);
  };
  jumpTo = (options: unknown) => {
    mapJumpTo(options);
  };
  setStyle = (style: unknown, opts?: unknown) => {
    this.options.style = style;
    mapSetStyle(style, opts);
  };
  setCenter = mapSetCenter;
  setZoom = mapSetZoom;
  setPitch = mapSetPitch;
  setBearing = mapSetBearing;
  setPadding = mapSetPadding;
  getLayer = (id: string) => {
    mapGetLayer(id);
    return this.layers.get(id);
  };
  getSource = (id: string) => {
    mapGetSource(id);
    return undefined;
  };
  addLayer = (layer: { id: string }) => {
    this.layers.set(layer.id, layer);
    mapAddLayer(layer);
  };
  removeLayer = (id: string) => {
    this.layers.delete(id);
    mapRemoveLayer(id);
  };
  addControl(control: { onAdd?: (map: this) => HTMLElement | void }, position?: string) {
    this.controls.add(control);
    this.controlPositions.set(control, position);
    mapAddControl(control, position);
    control.onAdd?.(this);
  }
  removeControl(control: { onRemove?: () => void }) {
    if (this.controls.has(control)) {
      this.controls.delete(control);
      this.controlPositions.delete(control);
    }
    mapRemoveControl(control);
    control.onRemove?.();
  }
  remove = mapRemove;
  isStyleLoaded() {
    return false;
  }
}

vi.mock("maplibre-gl", () => ({
  Map: MapMock,
}));

vi.mock("../../analytics/send", () => ({
  emitVizEvent: vi.fn(),
}));

const deckConstructor = vi.fn();
const deckSetProps = vi.fn();
const deckFinalize = vi.fn();
class DeckMock {
  props: Record<string, unknown>;
  constructor(props: Record<string, unknown>) {
    this.props = props;
    deckConstructor(props);
  }
  setProps = deckSetProps;
  finalize = deckFinalize;
}
vi.mock("@deck.gl/core", () => ({
  Deck: DeckMock,
}));

const overlayConstructor = vi.fn();
const overlaySetProps = vi.fn();
const overlayFinalize = vi.fn();
const overlayOnAdd = vi.fn();
const overlayOnRemove = vi.fn();
class MapboxOverlayMock {
  props: Record<string, unknown>;
  constructor(props: Record<string, unknown>) {
    this.props = props;
    overlayConstructor(props);
  }
  setProps = overlaySetProps;
  onAdd = (map: unknown) => {
    overlayOnAdd(map);
    return document.createElement("canvas");
  };
  onRemove = () => {
    overlayOnRemove();
  };
  finalize = overlayFinalize;
}
vi.mock("@deck.gl/mapbox", () => ({
  MapboxOverlay: MapboxOverlayMock,
}));

const { supportsWebGL, supportsWebGL2, renderWebglFallback } = vi.hoisted(() => {
  const supportsWebGL = vi.fn(() => true);
  const supportsWebGL2 = vi.fn(() => true);
  const renderWebglFallback = vi.fn(() => () => {});
  return { supportsWebGL, supportsWebGL2, renderWebglFallback };
});

vi.mock("../webgl", () => ({
  supportsWebGL,
  supportsWebGL2,
  renderWebglFallback,
}));

import { deckAdapter } from "./deck";
import { mapLibreAdapter } from "./maplibre.adapter";
import { vegaLiteAdapter } from "./vegaLite";
import { visxAdapter } from "./visx";

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("viz adapters contract", () => {
  beforeEach(() => {
    embedMock.mockImplementation(async () => defaultEmbedResult());
    embedMock.mockClear();
    supportsWebGL.mockReturnValue(true);
    supportsWebGL2.mockReturnValue(true);
    renderWebglFallback.mockReset();
    renderWebglFallback.mockReturnValue(() => {});
    deckConstructor.mockClear();
    deckSetProps.mockClear();
    deckFinalize.mockClear();
    overlayConstructor.mockClear();
    overlaySetProps.mockClear();
    overlayFinalize.mockClear();
    overlayOnAdd.mockClear();
    overlayOnRemove.mockClear();
    mapAddControl.mockClear();
    mapRemoveControl.mockClear();
  });

  it("vega-lite adapter mounts and re-renders", async () => {
    const element = document.createElement("div");
    const spec = { mark: "bar" } as Parameters<typeof embedMock>[0];
    const instance = await vegaLiteAdapter.mount({ el: element, spec, discrete: false });
    const [target, preparedSpec, options] = embedMock.mock.calls[0] ?? [];
    expect(target).toBe(element);
    expect(preparedSpec).toEqual(
      expect.objectContaining({
        mark: "bar",
        config: expect.objectContaining({
          axis: expect.objectContaining({ labelColor: tokens.color.fg.subtle }),
          legend: expect.objectContaining({ labelFont: tokens.font.family.sans }),
        }),
      }),
    );
    expect(preparedSpec?.autosize).toEqual(
      expect.objectContaining({ type: "fit", resize: true, contains: "padding" }),
    );
    const categoryRange = preparedSpec?.config?.range?.category;
    expect(Array.isArray(categoryRange)).toBe(true);
    expect(categoryRange?.length ?? 0).toBeGreaterThan(0);
    const expectedCategory = brandTokens.dataviz?.series?.["1"]?.value;
    if (expectedCategory) {
      expect(categoryRange?.[0]).toBe(expectedCategory);
    }
    expect(options?.config?.animation?.easing).toBe(tokens.motion.easing.standard);
    expect(options?.mode).toBe("vega-lite");

    const view = instance.result?.view;
    expect(view?.resize).toHaveBeenCalledTimes(1);
    expect(view?.runAsync).toHaveBeenCalledTimes(1);

    const resizeEvent = new CustomEvent<VizHarnessEventDetail>("viz_state", {
      detail: { width: 320, height: 240 },
    });
    element.dispatchEvent(resizeEvent);

    await Promise.resolve();
    expect(view?.resize).toHaveBeenCalledTimes(2);
    expect(view?.runAsync).toHaveBeenCalledTimes(2);

    const nextSpec = {
      mark: "line",
      transition: { duration: 300 },
      encode: {
        update: { fill: { value: "red" } },
        enter: { opacity: { value: 0.8 } },
      },
    } as Parameters<typeof embedMock>[0];
    await instance.setSpec(nextSpec, { discrete: true });
    const [, discreteSpec, discreteOptions] = embedMock.mock.calls[1] ?? [];
    expect(discreteSpec).toEqual(expect.objectContaining({ mark: "line" }));
    expect(discreteSpec).not.toHaveProperty("transition");
    expect(discreteSpec?.encode?.enter).toBeDefined();
    expect(discreteSpec?.encode).not.toHaveProperty("update");
    expect(discreteOptions?.config?.animation).toEqual({ duration: 0, easing: "linear" });

    await instance.destroy();
    expect(instance.result).toBeNull();
  });

  it("vega-lite adapter treats previous spec as immutable", async () => {
    const element = document.createElement("div");
    const spec = { mark: "bar", data: { values: [] } } as Parameters<typeof embedMock>[0];
    const instance = await vegaLiteAdapter.mount({ el: element, spec, discrete: false });
    const previous = instance.spec;

    await instance.setSpec((prev) => {
      expect(prev.mark).toBe("bar");
      // @ts-expect-error intentional mutation attempt
      prev.mark = "line";
      return { ...prev, mark: "area" };
    });

    expect(previous?.mark).toBe("bar");
    await instance.destroy();
  });

  it("vega-lite adapter re-renders DOM when spec changes", async () => {
    const element = document.createElement("div");
    embedMock.mockImplementation(async (el, spec) => {
      el.textContent = (spec as { mark?: string }).mark ?? "";
      return defaultEmbedResult();
    });

    const instance = await vegaLiteAdapter.mount({
      el: element,
      spec: { mark: "bar" } as never,
      discrete: false,
    });
    expect(element.textContent).toBe("bar");

    await instance.setSpec({ mark: "line" } as never, { discrete: false });

    await Promise.resolve();
    expect(element.textContent).toBe("line");
    await instance.destroy();
  });

  it("vega-lite adapter applies selection state via signals", async () => {
    const element = document.createElement("div");
    const spec = {
      mark: "point",
      params: [{ name: "highlight", select: { type: "point" } }],
    } as Parameters<typeof embedMock>[0];
    const instance = await vegaLiteAdapter.mount({ el: element, spec, discrete: false });

    await instance.applyState({ selection: "alpha" });

    const view = instance.result?.view;
    expect(view?.signal).toHaveBeenCalledWith("highlight", "alpha");

    await instance.destroy();
  });

  it("maplibre adapter mounts and applies view state", async () => {
    const element = document.createElement("div");
    element.style.setProperty("--sticky-top", "24px");
    const spec = { style: "style.json", camera: { center: [0, 0], zoom: 2 } };
    const instance = await mapLibreAdapter.mount(element, spec, { discrete: false });
    expect(instance.map).toBeInstanceOf(MapMock);
    expect(mapEaseTo).toHaveBeenCalledWith(
      expect.objectContaining({ center: [0, 0], zoom: 2, padding: { top: 24 } }),
    );
    mapLibreAdapter.applyState(
      instance,
      {
        ...spec,
        camera: { ...spec.camera, zoom: 4, pitch: 20, bearing: 30, padding: { top: 10 } },
        layers: [
          { id: "layer", op: "add", def: { id: "layer", type: "fill" } },
          { id: "layer", op: "update", def: { id: "layer", type: "line" } },
          { id: "layer", op: "remove" },
        ],
      },
      { discrete: true },
    );
    expect(mapSetStyle).not.toHaveBeenCalled();
    expect(mapJumpTo).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 4,
        pitch: 20,
        bearing: 30,
        padding: { top: 34 },
      }),
    );
    expect(mapAddLayer).toHaveBeenNthCalledWith(1, { id: "layer", type: "fill" });
    expect(mapAddLayer).toHaveBeenNthCalledWith(2, { id: "layer", type: "line" });
    expect(mapRemoveLayer).toHaveBeenCalledTimes(2);
    mapLibreAdapter.destroy(instance);
    expect(mapRemove).toHaveBeenCalled();
  });

  it("maplibre adapter renders fallback when WebGL is unavailable", async () => {
    supportsWebGL.mockReturnValueOnce(false);
    const cleanup = vi.fn();
    renderWebglFallback.mockReturnValueOnce(cleanup);

    const element = document.createElement("div");
    const spec = { style: "style.json" };
    const instance = await mapLibreAdapter.mount(element, spec, { discrete: true });

    expect(instance.map).toBeNull();
    expect(renderWebglFallback).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ lib: "maplibre" }),
    );
    expect(emitVizEvent).toHaveBeenCalledWith(
      "viz_fallback_engaged",
      expect.objectContaining({
        lib: "maplibre",
        motion: "discrete",
        reason: "webgl",
        fallback: "static",
      }),
    );

    mapLibreAdapter.destroy(instance);
    expect(cleanup).toHaveBeenCalled();
  });

  it("maplibre adapter wires resize observer with throttling", async () => {
    vi.useFakeTimers();
    const observers: MockResizeObserver[] = [];

    class MockResizeObserver {
      public readonly observe = vi.fn();
      public readonly disconnect = vi.fn();

      constructor(private readonly callback: ResizeObserverCallback) {
        observers.push(this);
      }

      trigger() {
        this.callback([], this as unknown as ResizeObserver);
      }
    }

    const originalResizeObserver = globalThis.ResizeObserver;
    // @ts-expect-error override for testing
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;

    const element = document.createElement("div");
    const spec = { style: "style.json" };

    try {
      const instance = await mapLibreAdapter.mount(element, spec, { discrete: false });

      const [observer] = observers;
      expect(observer).toBeDefined();
      expect(observer?.observe).toHaveBeenCalledWith(element);

      mapResize.mockClear();

      observer?.trigger();
      expect(mapResize).toHaveBeenCalledTimes(1);

      mapResize.mockClear();
      observer?.trigger();
      observer?.trigger();
      expect(mapResize).not.toHaveBeenCalled();

      vi.advanceTimersByTime(200);
      expect(mapResize).toHaveBeenCalledTimes(1);

      mapLibreAdapter.destroy(instance);
      expect(observer?.disconnect).toHaveBeenCalled();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
      vi.useRealTimers();
    }
  });

  it("maplibre adapter treats previous spec as immutable", async () => {
    const element = document.createElement("div");
    const spec = { style: "style.json", camera: { center: [0, 0], zoom: 2 }, layers: [] as const };
    const instance = await mapLibreAdapter.mount(element, spec, { discrete: false });
    const previous = instance.spec;

    mapLibreAdapter.applyState(
      instance,
      (prev) => {
        expect(prev.camera?.zoom).toBe(2);
        // @ts-expect-error mutation attempt
        prev.camera = { ...prev.camera, zoom: 3 };
        if (prev.layers) {
          (prev.layers as Array<{ id: string; op: "add" }>).push({ id: "layer", op: "add" });
        }
        return {
          ...prev,
          camera: { ...prev.camera, pitch: 20 },
          layers: [{ id: "layer", op: "remove" }],
        };
      },
      { discrete: true },
    );

    expect(previous.camera?.zoom).toBe(2);
    expect(previous.layers).toHaveLength(0);
  });

  it("maplibre adapter emits viz_error on runtime errors", async () => {
    const element = document.createElement("div");
    const spec = { style: "style.json" };
    const instance = await mapLibreAdapter.mount(element, spec, { discrete: true });

    (instance.map as MapMock).emit("error", { error: new Error("tile failed") });

    expect(emitVizEvent).toHaveBeenCalledWith(
      "viz_error",
      expect.objectContaining({
        lib: "maplibre",
        motion: "discrete",
        reason: "runtime",
        error: "tile failed",
      }),
    );

    mapLibreAdapter.destroy(instance);
  });

  it("visx adapter renders react components", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const component = ({ label }: { label: string; discrete: boolean }) => (
      <span data-testid="label">{label}</span>
    );
    const instance = visxAdapter.mount(
      element,
      { component, props: { label: "alpha" } },
      { discrete: false },
    );

    expect(element.querySelector("[data-testid='label']")?.textContent).toBe("alpha");

    visxAdapter.applyState(instance, { component, props: { label: "beta" } }, { discrete: true });
    expect(element.querySelector("[data-testid='label']")?.textContent).toBe("beta");

    visxAdapter.destroy(instance);
    expect(element.innerHTML).toBe("");
  });

  it("visx adapter treats previous spec as immutable", () => {
    const element = document.createElement("div");
    document.body.appendChild(element);

    const component = ({ label }: { label: string; discrete: boolean }) => (
      <span data-testid="label">{label}</span>
    );
    const instance = visxAdapter.mount(
      element,
      { component, props: { label: "alpha" } },
      { discrete: false },
    );

    const previous = instance.spec;

    visxAdapter.applyState(
      instance,
      (prev) => {
        expect(prev.props?.label).toBe("alpha");
        if (prev.props) {
          (prev.props as { label: string }).label = "gamma";
        }
        return { component, props: { label: "beta" } };
      },
      { discrete: true },
    );

    expect(previous.props?.label).toBe("alpha");

    visxAdapter.destroy(instance);
    expect(element.innerHTML).toBe("");
  });

  it("deck adapter mounts Deck instance and updates props", async () => {
    const element = document.createElement("div");
    const spec = {
      layers: [],
      viewState: { longitude: 10, latitude: 20, zoom: 4 },
    };
    const instance = await deckAdapter.mount(element, spec, { discrete: false });

    expect(deckConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        parent: element,
        layers: [],
        glOptions: expect.objectContaining({
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: true,
          antialias: true,
        }),
      }),
    );
    expect(instance.deck).toBeInstanceOf(DeckMock);

    const next = {
      layers: [{ id: "layer" }],
      viewState: { longitude: 12, latitude: 22, zoom: 5, transitionDuration: 300 },
      transitions: { getPosition: 120 },
    };
    deckAdapter.applyState(instance, next, { discrete: true });

    expect(deckSetProps).toHaveBeenCalledWith(
      expect.objectContaining({
        layers: next.layers,
        viewState: expect.objectContaining({
          longitude: 12,
          transitionDuration: 0,
        }),
      }),
    );

    const applied = deckSetProps.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(applied?.transitions).toEqual({});

    deckAdapter.destroy(instance);
    expect(deckFinalize).toHaveBeenCalled();
  });

  it("deck adapter renders fallback when WebGL is unavailable", async () => {
    supportsWebGL.mockReturnValueOnce(false);
    const cleanup = vi.fn();
    renderWebglFallback.mockReturnValueOnce(cleanup);

    const element = document.createElement("div");
    const spec = { layers: [] };
    const instance = await deckAdapter.mount(element, spec, { discrete: false });

    expect(instance.deck).toBeNull();
    expect(instance.overlay).toBeNull();
    expect(renderWebglFallback).toHaveBeenCalledWith(
      element,
      expect.objectContaining({ lib: "deck" }),
    );
    expect(emitVizEvent).toHaveBeenCalledWith(
      "viz_fallback_engaged",
      expect.objectContaining({ lib: "deck", reason: "webgl", fallback: "static" }),
    );

    deckAdapter.destroy(instance);
    expect(cleanup).toHaveBeenCalled();
  });

  it("deck adapter attaches Mapbox overlay when MapLibre map is provided", async () => {
    const element = document.createElement("div");
    const map = new MapMock({ container: element, style: "style.json" });
    const spec = {
      layers: [{ id: "initial" }],
      map: { map },
    };

    const instance = await deckAdapter.mount(element, spec, { discrete: false });

    expect(instance.deck).toBeNull();
    expect(instance.overlay).toBeInstanceOf(MapboxOverlayMock);
    expect(deckConstructor).not.toHaveBeenCalled();
    expect(overlayConstructor).toHaveBeenCalledWith(
      expect.objectContaining({
        layers: spec.layers,
        interleaved: true,
      }),
    );
    expect(mapAddControl).toHaveBeenCalledWith(expect.any(MapboxOverlayMock), undefined);
    expect(overlayOnAdd).toHaveBeenCalledWith(map);

    deckAdapter.applyState(
      instance,
      {
        layers: [{ id: "next" }],
        viewState: { zoom: 6, transitionDuration: 400 },
        transitions: { getRadius: 200 },
      },
      { discrete: true },
    );

    expect(overlaySetProps).toHaveBeenCalledWith(
      expect.objectContaining({
        layers: [{ id: "next" }],
        viewState: undefined,
      }),
    );

    const overlayAppliedCall = overlaySetProps.mock.calls[overlaySetProps.mock.calls.length - 1];
    const overlayApplied = overlayAppliedCall?.[0] as Record<string, unknown> | undefined;
    expect(overlayApplied?.transitions).toEqual({});

    deckAdapter.destroy(instance);
    expect(mapRemoveControl).toHaveBeenCalledWith(expect.any(MapboxOverlayMock));
    expect(overlayOnRemove).toHaveBeenCalled();
    expect(overlayFinalize).toHaveBeenCalled();
  });

  it("deck adapter treats previous spec as immutable", async () => {
    const element = document.createElement("div");
    const spec = { layers: [] };
    const instance = await deckAdapter.mount(element, spec, { discrete: false });
    const previous = instance.spec;

    deckAdapter.applyState(
      instance,
      (prev) => {
        expect(prev.layers).toEqual([]);
        (prev.layers as unknown[]).push({ id: "temp" });
        return { ...prev, views: [] };
      },
      { discrete: true },
    );

    expect(previous.layers).toEqual([]);
  });
});
