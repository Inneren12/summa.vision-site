import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { afterEach, describe, expect, it, vi } from "vitest";

const embedMock = vi.fn(async () => ({ view: { finalize: vi.fn() } }));
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

import { emitVizEvent } from "../../analytics/send";

import { deckAdapter } from "./deck";
import { echartsAdapter } from "./echarts";
import { mapLibreAdapter } from "./maplibre";
import { vegaLiteAdapter } from "./vegaLite";
import { visxAdapter } from "./visx";

afterEach(() => {
  vi.clearAllMocks();
});

describe("viz adapters contract", () => {
  beforeEach(() => {
    echartsSetOption.mockClear();
    echartsResize.mockClear();
    echartsDispose.mockClear();
    echartsInit.mockClear();
  });

  it("vega-lite adapter mounts and re-renders", async () => {
    const element = document.createElement("div");
    const spec = { mark: "bar" } as Parameters<typeof embedMock>[0];
    const instance = await vegaLiteAdapter.mount(element, spec, { discrete: false });
    expect(embedMock).toHaveBeenCalledWith(element, spec, expect.any(Object));

    const nextSpec = { mark: "line" } as Parameters<typeof embedMock>[0];
    vegaLiteAdapter.applyState(instance, nextSpec, { discrete: true });
    expect(embedMock).toHaveBeenCalledWith(element, nextSpec, expect.any(Object));

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
