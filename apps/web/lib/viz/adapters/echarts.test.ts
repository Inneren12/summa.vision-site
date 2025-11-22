import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { VizLifecycleEvent } from "../types";

import { echartsAdapter } from "./echarts";

const echartsSetOption = vi.fn();
const echartsResize = vi.fn();
const echartsDispose = vi.fn();
const echartsUse = vi.fn();
const echartsInit = vi.fn((el: HTMLElement) => ({
  setOption: echartsSetOption,
  resize: echartsResize,
  dispose: echartsDispose,
  getDom: () => el,
}));

vi.mock("echarts/core", () => ({
  __esModule: true,
  init: (...args: Parameters<typeof echartsInit>) => echartsInit(...args),
  use: (...args: Parameters<typeof echartsUse>) => echartsUse(...args),
  version: "5.6.0",
}));

vi.mock("echarts/charts", () => ({
  __esModule: true,
  LineChart: class {},
  BarChart: class {},
}));

vi.mock("echarts/components", () => ({
  __esModule: true,
  GridComponent: class {},
  LegendComponent: class {},
  TooltipComponent: class {},
}));

vi.mock("echarts/renderers", () => ({
  __esModule: true,
  CanvasRenderer: class {},
}));

describe("echartsAdapter", () => {
  beforeEach(() => {
    echartsSetOption.mockClear();
    echartsResize.mockClear();
    echartsDispose.mockClear();
    echartsUse.mockClear();
    echartsInit.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mounts with modular imports and emits lifecycle events", async () => {
    const events: VizLifecycleEvent[] = [];
    const el = document.createElement("div");
    const spec = { series: [] };

    const instance = await echartsAdapter.mount({
      el,
      spec,
      discrete: false,
      onEvent: (event) => events.push(event),
    });

    expect(echartsUse).toHaveBeenCalled();
    expect(echartsInit).toHaveBeenCalledWith(el, "light", { renderer: "canvas" });
    expect(echartsSetOption).toHaveBeenCalledWith(spec, { notMerge: true, lazyUpdate: false });
    expect(events.map((event) => event.type)).toEqual(["viz_init", "viz_ready"]);

    await instance.destroy();
    expect(echartsDispose).toHaveBeenCalledTimes(1);
  });

  it("applies discrete options when requested", async () => {
    const el = document.createElement("div");
    const spec = {
      animation: true,
      series: [{ type: "line" }],
      tooltip: {},
    };

    await echartsAdapter.mount({ el, spec, discrete: true });

    const [option] = echartsSetOption.mock.calls[0] ?? [];
    expect(option?.animation).toBe(false);
    expect(option?.series?.[0]?.animation).toBe(false);
    expect(option?.tooltip?.transitionDuration).toBe(0);
  });

  it("applies new state with notMerge semantics and emits viz_state", async () => {
    const events: VizLifecycleEvent[] = [];
    const el = document.createElement("div");
    const spec = { series: [] };
    const next = { series: [{ type: "line" }] };

    const instance = await echartsAdapter.mount({
      el,
      spec,
      discrete: false,
      onEvent: (event) => events.push(event),
    });

    echartsSetOption.mockClear();
    await instance.applyState?.({ option: next });

    expect(echartsSetOption).toHaveBeenCalledWith(next, { notMerge: true, lazyUpdate: false });
    expect(events.map((event) => event.type)).toContain("viz_state");
  });

  it("throttles resize observer callbacks", async () => {
    vi.useFakeTimers();
    const observers: ResizeObserver[] = [];

    class MockResizeObserver {
      public readonly observe = vi.fn((el: HTMLElement) => {
        observers.push(this as unknown as ResizeObserver);
        return el;
      });

      public readonly disconnect = vi.fn();

      constructor(private readonly callback: ResizeObserverCallback) {
        void callback;
        this.callback = callback;
      }

      private readonly callback: ResizeObserverCallback;

      trigger() {
        this.callback([], this as unknown as ResizeObserver);
      }
    }

    const originalResizeObserver = globalThis.ResizeObserver;
    // @ts-expect-error override for testing
    globalThis.ResizeObserver = MockResizeObserver;

    const el = document.createElement("div");
    await echartsAdapter.mount({ el, spec: { series: [] } });

    const [observer] = observers as unknown as MockResizeObserver[];
    expect(observer).toBeDefined();
    observer?.trigger();
    observer?.trigger();

    vi.runOnlyPendingTimers();
    expect(echartsResize).toHaveBeenCalledTimes(1);

    // cleanup
    globalThis.ResizeObserver = originalResizeObserver;
  });
});
