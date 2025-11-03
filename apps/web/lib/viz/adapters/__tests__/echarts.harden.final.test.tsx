import { beforeEach, describe, expect, test, vi } from "vitest";

import type { VizLifecycleEvent } from "../../types";

const coreInit = vi.fn();
const coreUse = vi.fn();

vi.mock("echarts/core", () => ({
  init: (...args: unknown[]) => coreInit(...args),
  use: (...args: unknown[]) => coreUse(...args),
}));

vi.mock("echarts/charts", () => ({
  LineChart: { __m: "Line" },
  BarChart: { __m: "Bar" },
}));

vi.mock("echarts/components", () => ({
  GridComponent: { __m: "Grid" },
  DatasetComponent: { __m: "Dataset" },
  TooltipComponent: { __m: "Tooltip" },
  LegendComponent: { __m: "Legend" },
  TitleComponent: { __m: "Title" },
}));

vi.mock("echarts/features", () => ({
  LabelLayout: { __m: "LabelLayout" },
  UniversalTransition: { __m: "UniversalTransition" },
}));

vi.mock("echarts/renderers", () => ({
  CanvasRenderer: { __m: "CanvasRenderer" },
}));

type ChartStub = {
  setOption: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
  getDom: ReturnType<typeof vi.fn>;
};

const createChartStub = (): ChartStub => ({
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  getDom: vi.fn(),
});

const flushPromises = async () => {
  await Promise.resolve();
};

test("ECharts adapter basic smoke", () => {
  expect(true).toBe(true);
});

describe("ECharts adapter hardening", () => {
  let chart: ChartStub;

  beforeEach(() => {
    vi.resetAllMocks();
    chart = createChartStub();
    coreInit.mockImplementation((element: HTMLElement) => {
      chart.getDom.mockReturnValue(element);
      return chart;
    });
  });

  test("ECharts adapter: uses the documented setOption call signatures", async () => {
    const { echartsAdapter } = await import("../echarts.adapter");

    const element = document.createElement("div");
    const spec = { series: [] };
    const emit = vi.fn();
    const onEvent = vi.fn<(event: VizLifecycleEvent) => void>();

    const instance = await echartsAdapter.mount(element, {
      state: { spec },
      emit,
      onEvent,
    });

    expect(chart.setOption).toHaveBeenCalledTimes(1);
    expect(chart.setOption).toHaveBeenNthCalledWith(
      1,
      expect.any(Object),
      expect.objectContaining({ lazyUpdate: true }),
    );

    await echartsAdapter.applyState(instance, { title: { text: "updated" } });

    expect(chart.setOption).toHaveBeenCalledTimes(2);
    expect(chart.setOption).toHaveBeenNthCalledWith(
      2,
      expect.any(Object),
      expect.objectContaining({ notMerge: false, lazyUpdate: true, silent: true }),
    );
    expect(emit).toHaveBeenCalledWith(
      "viz_state",
      undefined,
      expect.objectContaining({ reason: "apply_state" }),
    );
  });

  test("ECharts adapter: uses the provided resize observer and emits viz_resized", async () => {
    const { echartsAdapter } = await import("../echarts.adapter");

    const element = document.createElement("div");
    const spec = { series: [] };
    const emit = vi.fn();
    const onEvent = vi.fn<(event: VizLifecycleEvent) => void>();
    const disposer = vi.fn();
    let resizeCallback: (() => void) | undefined;

    const registerResizeObserver = vi.fn((_, cb: () => void) => {
      resizeCallback = cb;
      return disposer;
    });

    await echartsAdapter.mount(element, {
      state: { spec },
      emit,
      onEvent,
      registerResizeObserver,
    });

    expect(registerResizeObserver).toHaveBeenCalledTimes(1);
    expect(typeof resizeCallback).toBe("function");

    resizeCallback?.();
    await flushPromises();

    expect(chart.resize).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith(
      "viz_resized",
      undefined,
      expect.objectContaining({ reason: "resize" }),
    );
  });

  test("ECharts adapter: disables animation when discrete mode is requested", async () => {
    const { echartsAdapter } = await import("../echarts.adapter");

    const element = document.createElement("div");
    const spec = { series: [] };

    await echartsAdapter.mount(element, {
      state: { spec },
      emit: vi.fn(),
      onEvent: vi.fn<(event: VizLifecycleEvent) => void>(),
      discrete: true,
    });

    const [initialSpec] = chart.setOption.mock.calls[0] ?? [];
    expect(initialSpec).toMatchObject({
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      universalTransition: false,
    });
  });

  test("ECharts adapter: legacy mount returns immutable spec snapshots", async () => {
    const { mount } = await import("../echarts");

    const element = document.createElement("div");
    const spec = { series: [] };

    const instance = await mount(element, spec, { discrete: true });

    expect(instance).toBeTruthy();

    const before = instance.spec;
    expect(before).toMatchObject({ series: [] });

    await instance.applyState?.({ spec: { title: { text: "after" } } });

    const after = instance.spec;

    expect(after).toMatchObject({ title: { text: "after" } });
    expect(after).not.toBe(before);
    expect(before).toMatchObject({ series: [] });
  });
});
