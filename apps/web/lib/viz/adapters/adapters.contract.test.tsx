import { tokens } from "@root/src/shared/theme/tokens";
import brandTokens from "@root/tokens/brand.tokens.json";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const defaultEmbedResult = () => ({ view: { finalize: vi.fn() } });
const embedMock = vi.fn(async () => defaultEmbedResult());
vi.mock("vega-embed", () => ({
  default: embedMock,
}));

const echartsSetOption = vi.fn();
const echartsResize = vi.fn();
const echartsDispose = vi.fn();
const echartsInit = vi.fn(() => ({
  setOption: echartsSetOption,
  resize: echartsResize,
  dispose: echartsDispose,
}));
vi.mock("echarts", () => ({
  init: echartsInit,
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

const deckSetProps = vi.fn();
const deckFinalize = vi.fn();
class DeckMock {
  constructor(public readonly props: Record<string, unknown>) {}
  setProps = deckSetProps;
  finalize = deckFinalize;
}
vi.mock("@deck.gl/core", () => ({
  Deck: DeckMock,
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

import { emitVizEvent } from "../../analytics/send";

import { deckAdapter } from "./deckgl.adapter";
import { echartsAdapter } from "./echarts.adapter";
import { mapLibreAdapter } from "./maplibre.adapter";
import { vegaLiteAdapter } from "./vegaLite";
import { visxAdapter } from "./visx";

afterEach(() => {
  vi.clearAllMocks();
});

describe("viz adapters contract", () => {
  beforeEach(() => {
    embedMock.mockImplementation(async () => defaultEmbedResult());
    embedMock.mockClear();
    echartsSetOption.mockClear();
    echartsResize.mockClear();
    echartsDispose.mockClear();
    echartsInit.mockClear();
    supportsWebGL.mockReturnValue(true);
    supportsWebGL2.mockReturnValue(true);
    renderWebglFallback.mockReset();
    renderWebglFallback.mockReturnValue(() => {});
  });

  it("vega-lite adapter mounts and re-renders", async () => {
    const element = document.createElement("div");
    const spec = { mark: "bar" } as Parameters<typeof embedMock>[0];
    const instance = await vegaLiteAdapter.mount(element, spec, { discrete: false });
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
    const categoryRange = preparedSpec?.config?.range?.category;
    expect(Array.isArray(categoryRange)).toBe(true);
    expect(categoryRange?.length ?? 0).toBeGreaterThan(0);
    const expectedCategory = brandTokens.dataviz?.series?.["1"]?.value;
    if (expectedCategory) {
      expect(categoryRange?.[0]).toBe(expectedCategory);
    }
    expect(options?.config?.animation?.easing).toBe(tokens.motion.easing.standard);

    const nextSpec = {
      mark: "line",
      transition: { duration: 300 },
      encode: {
        update: { fill: { value: "red" } },
        enter: { opacity: { value: 0.8 } },
      },
    } as Parameters<typeof embedMock>[0];
    vegaLiteAdapter.applyState(instance, nextSpec, { discrete: true });
    const [, discreteSpec, discreteOptions] = embedMock.mock.calls[1] ?? [];
    expect(discreteSpec).toEqual(expect.objectContaining({ mark: "line" }));
    expect(discreteSpec).not.toHaveProperty("transition");
    expect(discreteSpec?.encode?.enter).toBeDefined();
    expect(discreteSpec?.encode).not.toHaveProperty("update");
    expect(discreteOptions?.config?.animation).toEqual({ duration: 0, easing: "linear" });

    vegaLiteAdapter.destroy(instance);
    expect(instance.result).toBeNull();
  });

  it("vega-lite adapter treats previous spec as immutable", async () => {
    const element = document.createElement("div");
    const spec = { mark: "bar", data: { values: [] } } as Parameters<typeof embedMock>[0];
    const instance = await vegaLiteAdapter.mount(element, spec, { discrete: false });
    const previous = instance.spec;

    vegaLiteAdapter.applyState(
      instance,
      (prev) => {
        expect(prev.mark).toBe("bar");
        // @ts-expect-error intentional mutation attempt
        prev.mark = "line";
        return { ...prev, mark: "area" };
      },
      { discrete: true },
    );

    expect(previous.mark).toBe("bar");
  });

  it("vega-lite adapter re-renders DOM when spec changes", async () => {
    const element = document.createElement("div");
    embedMock.mockImplementation(async (el, spec) => {
      el.textContent = (spec as { mark?: string }).mark ?? "";
      return defaultEmbedResult();
    });

    const instance = await vegaLiteAdapter.mount(element, { mark: "bar" } as never, {
      discrete: false,
    });
    expect(element.textContent).toBe("bar");

    vegaLiteAdapter.applyState(instance, { mark: "line" } as never, { discrete: false });

    await Promise.resolve();
    expect(element.textContent).toBe("line");
  });

  it("echarts adapter mounts and updates options", async () => {
    const element = document.createElement("div");
    const spec = { series: [] };
    const instance = await echartsAdapter.mount(element, spec, { discrete: false });
    expect(echartsInit).toHaveBeenCalledWith(element, undefined, { renderer: "canvas" });
    expect(echartsSetOption).toHaveBeenNthCalledWith(1, spec, { lazyUpdate: true });

    const nextSpec = { series: [{ type: "line" }] };
    echartsAdapter.applyState(instance, nextSpec, { discrete: true });
    expect(echartsSetOption).toHaveBeenNthCalledWith(2, nextSpec, {
      notMerge: true,
      lazyUpdate: true,
      animation: false,
    });

    echartsAdapter.destroy(instance);
    expect(echartsDispose).toHaveBeenCalled();
  });

  it("echarts adapter wires resize observer with throttling", async () => {
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
    globalThis.ResizeObserver = MockResizeObserver;

    const element = document.createElement("div");
    const spec = { series: [] };

    try {
      const instance = await echartsAdapter.mount(element, spec, { discrete: false });

      const [observer] = observers;
      expect(observer).toBeDefined();
      expect(observer?.observe).toHaveBeenCalledWith(element);

      observer?.trigger();
      expect(echartsResize).toHaveBeenCalledTimes(1);

      echartsResize.mockClear();
      observer?.trigger();
      observer?.trigger();
      expect(echartsResize).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(echartsResize).toHaveBeenCalledTimes(1);

      echartsAdapter.destroy(instance);
      expect(observer?.disconnect).toHaveBeenCalled();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
      vi.useRealTimers();
    }
  });

  it("echarts adapter treats previous spec as immutable", async () => {
    const element = document.createElement("div");
    const spec = { series: [] };
    const instance = await echartsAdapter.mount(element, spec, { discrete: false });
    const previous = instance.spec;

    echartsAdapter.applyState(
      instance,
      (prev) => {
        expect(prev.series).toEqual([]);
        (prev.series as unknown[]).push({ type: "line" });
        return { ...prev, legend: { show: true } };
      },
      { discrete: true },
    );

    expect(previous.series).toEqual([]);
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

  it("deck adapter mounts and updates props", async () => {
    const element = document.createElement("div");
    const spec = { layers: [] };
    const instance = await deckAdapter.mount(element, spec, { discrete: false });
    expect(instance.deck).toBeInstanceOf(DeckMock);

    const next = { layers: [{ id: "layer" }] };
    deckAdapter.applyState(instance, next, { discrete: true });
    expect(deckSetProps).toHaveBeenCalledWith(next);

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
