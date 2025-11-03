import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { EChartsSpec } from "../../spec-types";

const { setOptionMock, resizeMock, disposeMock, initMock, useMock } = vi.hoisted(() => {
  const setOption = vi.fn();
  const resize = vi.fn();
  const dispose = vi.fn();
  const init = vi.fn();
  const use = vi.fn();
  return {
    setOptionMock: setOption,
    resizeMock: resize,
    disposeMock: dispose,
    initMock: init,
    useMock: use,
  };
});

const echartsStubPath = vi.hoisted(
  () => new URL("../../stubs/echarts.ts", import.meta.url).pathname,
);

vi.mock(echartsStubPath, () => ({
  init: initMock,
  use: useMock,
  LineChart: { type: "line" },
  BarChart: { type: "bar" },
  ScatterChart: { type: "scatter" },
  PieChart: { type: "pie" },
  GridComponent: { type: "grid" },
  DatasetComponent: { type: "dataset" },
  TooltipComponent: { type: "tooltip" },
  LegendComponent: { type: "legend" },
  TitleComponent: { type: "title" },
  LabelLayout: { type: "label" },
  UniversalTransition: { type: "universalTransition" },
  CanvasRenderer: { type: "canvas" },
}));

beforeEach(() => {
  setOptionMock.mockClear();
  resizeMock.mockClear();
  disposeMock.mockClear();
  useMock.mockClear();
  initMock.mockImplementation((element: HTMLElement) => ({
    setOption: setOptionMock,
    resize: resizeMock,
    dispose: disposeMock,
    getDom: () => element,
  }));
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ECharts adapter hardening", () => {
  it("ECharts adapter uses contract-friendly setOption arguments", async () => {
    const { echartsAdapter } = await import("../echarts.adapter");
    const element = document.createElement("div");
    document.body.appendChild(element);

    const spec = { series: [] } as EChartsSpec;
    const emit = vi.fn();

    const instance = await echartsAdapter.mount(element, {
      state: { spec },
      emit,
      registerResizeObserver: () => () => {},
    });

    expect(setOptionMock).toHaveBeenNthCalledWith(1, expect.any(Object), {
      lazyUpdate: true,
    });

    instance.applyState?.({
      spec: { series: [{ type: "bar" }] } as EChartsSpec,
    });

    expect(setOptionMock).toHaveBeenNthCalledWith(2, expect.any(Object), {
      notMerge: false,
      lazyUpdate: true,
      silent: true,
    });

    instance.destroy();
    element.remove();
  });

  it("ECharts adapter disables motion when discrete mode is enabled", async () => {
    const { echartsAdapter } = await import("../echarts.adapter");
    const element = document.createElement("div");
    document.body.appendChild(element);

    const spec = { series: [] } as EChartsSpec;

    const instance = await echartsAdapter.mount(element, {
      state: { spec },
      emit: vi.fn(),
      registerResizeObserver: () => () => {},
      discrete: true,
    });

    const [appliedSpec] = setOptionMock.mock.calls[0] ?? [];

    expect(appliedSpec).toMatchObject({
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      universalTransition: false,
    });

    instance.destroy();
    element.remove();
  });

  it("ECharts adapter relays resize observer callbacks and emits viz_resized", async () => {
    const { echartsAdapter } = await import("../echarts.adapter");
    const element = document.createElement("div");
    document.body.appendChild(element);

    const emit = vi.fn();
    let resizeCallback: (() => void) | null = null;
    const registerResizeObserver = vi.fn((_, cb: () => void) => {
      resizeCallback = cb;
      return () => {};
    });

    const instance = await echartsAdapter.mount(element, {
      state: { spec: { series: [] } as EChartsSpec },
      emit,
      registerResizeObserver,
    });

    expect(registerResizeObserver).toHaveBeenCalledWith(element, expect.any(Function));
    expect(resizeCallback).toBeTypeOf("function");

    resizeCallback?.();

    expect(resizeMock).toHaveBeenCalledTimes(1);
    const resizeEvent = emit.mock.calls.find(([event]) => event === "viz_resized");
    expect(resizeEvent?.[1]).toMatchObject({
      lib: "echarts",
      motion: "animated",
      reason: "resize",
    });

    instance.destroy();
    element.remove();
  });

  it("ECharts adapter exposes immutable spec snapshots through the legacy mount shim", async () => {
    const legacy = await import("../echarts");
    const element = document.createElement("div");
    document.body.appendChild(element);

    const initialSpec = { series: [{ type: "pie" }] } as EChartsSpec;
    const instance = await legacy.mount(element, initialSpec, { discrete: true });

    const firstSnapshot = instance.spec;
    firstSnapshot?.series && firstSnapshot.series.push({ type: "mutated" } as never);

    instance.applyState?.({
      spec: { series: [{ type: "line" }] } as EChartsSpec,
    });

    const secondSnapshot = instance.spec;

    expect(secondSnapshot).not.toBe(firstSnapshot);
    expect(secondSnapshot?.series?.[0]?.type).toBe("line");
    expect(firstSnapshot?.series?.[0]?.type).toBe("pie");

    instance.destroy();
    element.remove();
  });
});
