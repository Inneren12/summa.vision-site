import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EChartsSpec } from "../../spec-types";
import * as legacyModule from "../echarts";
import { echartsAdapter } from "../echarts.adapter";

const mocks = vi.hoisted(() => {
  const setOption = vi.fn();
  const resize = vi.fn();
  const dispose = vi.fn();
  const getDom = vi.fn();
  const chart = { setOption, resize, dispose, getDom };
  const init = vi.fn(() => chart);
  const use = vi.fn();
  const reset = () => {
    setOption.mockClear();
    resize.mockClear();
    dispose.mockClear();
    getDom.mockClear();
    init.mockClear();
    use.mockClear();
  };
  return { setOption, resize, dispose, getDom, chart, init, use, reset };
});

vi.mock("echarts/core", () => ({
  __esModule: true,
  use: mocks.use,
  init: (...args: Parameters<typeof mocks.init>) => mocks.init(...args),
  default: {
    use: mocks.use,
    init: (...args: Parameters<typeof mocks.init>) => mocks.init(...args),
  },
}));

vi.mock("echarts/charts", () => ({
  __esModule: true,
  LineChart: { name: "LineChart" },
  BarChart: { name: "BarChart" },
}));

vi.mock("echarts/components", () => ({
  __esModule: true,
  GridComponent: { name: "GridComponent" },
  DatasetComponent: { name: "DatasetComponent" },
  TooltipComponent: { name: "TooltipComponent" },
  LegendComponent: { name: "LegendComponent" },
  TitleComponent: { name: "TitleComponent" },
}));

vi.mock("echarts/features", () => ({
  __esModule: true,
  LabelLayout: { name: "LabelLayout" },
  UniversalTransition: { name: "UniversalTransition" },
}));

vi.mock("echarts/renderers", () => ({
  __esModule: true,
  CanvasRenderer: { name: "CanvasRenderer" },
}));

describe("ECharts adapter", () => {
  beforeEach(() => {
    mocks.reset();
  });

  it("ECharts adapter uses strict setOption arguments for mount and state updates", async () => {
    const el = { nodeName: "DIV" } as unknown as HTMLElement;
    const spec = { series: [{ type: "line" }] } as EChartsSpec;

    const instance = await echartsAdapter.mount(el, {
      state: { spec },
      emit: vi.fn(),
    });

    expect(mocks.setOption).toHaveBeenCalledTimes(1);
    expect(mocks.setOption).toHaveBeenCalledWith(expect.any(Object), { lazyUpdate: true });

    const nextSpec = { series: [{ type: "bar" }] } as EChartsSpec;
    echartsAdapter.applyState(instance, nextSpec);

    expect(mocks.setOption).toHaveBeenCalledTimes(2);
    expect(mocks.setOption.mock.calls[1]?.[1]).toEqual({
      notMerge: false,
      lazyUpdate: true,
      silent: true,
    });
  });

  it("ECharts adapter resizes via provided observer and emits viz_resized", async () => {
    const el = { nodeName: "DIV" } as unknown as HTMLElement;
    const spec = { series: [] } as EChartsSpec;
    const emit = vi.fn();
    const disposeResize = vi.fn();
    let resizeHandler: (() => void) | undefined;

    const registerResizeObserver = vi.fn((element: HTMLElement, handler: () => void) => {
      expect(element).toBe(el);
      resizeHandler = handler;
      return disposeResize;
    });

    await echartsAdapter.mount(el, {
      state: { spec },
      emit,
      registerResizeObserver,
    });

    expect(registerResizeObserver).toHaveBeenCalledTimes(1);
    expect(typeof resizeHandler).toBe("function");

    resizeHandler?.();

    expect(mocks.resize).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      "viz_resized",
      undefined,
      expect.objectContaining({ reason: "resize" }),
    );
  });

  it("ECharts adapter disables animation when discrete mode is active", async () => {
    const el = { nodeName: "DIV" } as unknown as HTMLElement;
    const spec = { title: { text: "chart" } } as EChartsSpec;

    await echartsAdapter.mount(el, {
      state: { spec },
      emit: vi.fn(),
      discrete: true,
    });

    const firstCallArgs = mocks.setOption.mock.calls[0]?.[0] as Record<string, unknown> | undefined;
    expect(firstCallArgs).toMatchObject({
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      universalTransition: false,
    });
  });

  it("ECharts adapter legacy mount exposes immutable spec snapshots", async () => {
    const el = { nodeName: "DIV" } as unknown as HTMLElement;
    const initialSpec = { series: [] } as EChartsSpec;
    const instance = await legacyModule.mount(el, initialSpec, { discrete: false });

    const firstSnapshot = instance.spec;
    expect(firstSnapshot).not.toBeUndefined();
    expect(firstSnapshot).not.toBe(initialSpec);
    expect(firstSnapshot).toEqual(initialSpec);

    const nextSpec = { series: [{ type: "pie" }] } as EChartsSpec;
    instance.applyState?.({ spec: nextSpec });

    const updatedSnapshot = instance.spec;
    expect(updatedSnapshot).not.toBe(firstSnapshot);
    expect(updatedSnapshot).not.toBe(nextSpec);
    expect(firstSnapshot).toEqual(initialSpec);
    expect(updatedSnapshot).toEqual(nextSpec);
  });
});
