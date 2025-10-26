import type { EChartsCoreOption } from "echarts/core";
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";

const echartsSetOption = vi.fn();
const echartsDispose = vi.fn();
const echartsResize = vi.fn();
const echartsUse = vi.fn();
const echartsInit = vi.fn(() => ({
  setOption: echartsSetOption,
  dispose: echartsDispose,
  resize: echartsResize,
}));

async function importAdapter() {
  const mod = await import("./echarts");
  return mod.echartsAdapter;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  echartsInit.mockImplementation(() => ({
    setOption: echartsSetOption,
    dispose: echartsDispose,
    resize: echartsResize,
  }));
  vi.doMock("echarts/core", () => ({
    init: echartsInit,
    use: echartsUse,
  }));
  vi.doMock("echarts/charts", () => ({}));
  vi.doMock("echarts/components", () => ({}));
  vi.doMock("echarts/renderers", () => ({ CanvasRenderer: {} }));
  vi.doMock("echarts/features", () => ({}));
});

afterEach(() => {
  vi.doUnmock("echarts/core");
  vi.doUnmock("echarts/charts");
  vi.doUnmock("echarts/components");
  vi.doUnmock("echarts/renderers");
  vi.doUnmock("echarts/features");
});

describe("echartsAdapter", () => {
  it("sets option flags for mount and updates", async () => {
    const adapter = await importAdapter();
    const element = document.createElement("div");
    const spec = { series: [] } as EChartsCoreOption;

    const instance = await adapter.mount(element, spec, { discrete: false });

    expect(echartsSetOption).toHaveBeenCalledTimes(1);
    expect(echartsSetOption.mock.calls[0][0]).toEqual(spec);
    expect(echartsSetOption.mock.calls[0][1]).toEqual({ lazyUpdate: true });

    echartsSetOption.mockClear();

    const nextSpec = { ...spec, legend: { show: true } } as EChartsCoreOption;
    adapter.applyState(instance, nextSpec, { discrete: false });
    expect(echartsSetOption).toHaveBeenCalledWith(nextSpec, {
      notMerge: true,
      lazyUpdate: true,
      animation: true,
    });

    echartsSetOption.mockClear();

    adapter.applyState(instance, nextSpec, { discrete: true });
    expect(echartsSetOption).toHaveBeenCalledWith(nextSpec, {
      notMerge: true,
      lazyUpdate: true,
      animation: false,
    });

    adapter.destroy(instance);
  });

  it("throttles resize observer callbacks", async () => {
    vi.useFakeTimers();
    const observe = vi.fn();
    const disconnect = vi.fn();
    let resizeCallback: ResizeObserverCallback | null = null;

    class ResizeObserverMock implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe = observe;
      unobserve(): void {}
      disconnect = disconnect;
    }

    const originalResizeObserver = globalThis.ResizeObserver;
    // @ts-expect-error override for tests
    globalThis.ResizeObserver = ResizeObserverMock;

    try {
      const adapter = await importAdapter();
      const element = document.createElement("div");
      const spec = { series: [] } as EChartsCoreOption;

      const instance = await adapter.mount(element, spec, { discrete: false });

      expect(observe).toHaveBeenCalledWith(element);

      echartsResize.mockClear();

      resizeCallback?.([] as ResizeObserverEntry[]);
      resizeCallback?.([] as ResizeObserverEntry[]);
      expect(echartsResize).not.toHaveBeenCalled();

      vi.advanceTimersByTime(100);
      expect(echartsResize).toHaveBeenCalledTimes(1);

      resizeCallback?.([] as ResizeObserverEntry[]);
      vi.advanceTimersByTime(99);
      expect(echartsResize).toHaveBeenCalledTimes(1);
      vi.advanceTimersByTime(1);
      expect(echartsResize).toHaveBeenCalledTimes(2);

      resizeCallback?.([] as ResizeObserverEntry[]);
      adapter.destroy(instance);
      vi.advanceTimersByTime(100);
      expect(echartsResize).toHaveBeenCalledTimes(2);
      expect(disconnect).toHaveBeenCalled();
    } finally {
      globalThis.ResizeObserver = originalResizeObserver;
      vi.useRealTimers();
    }
  });
});
