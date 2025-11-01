import { beforeEach, describe, expect, it, vi } from "vitest";

import type { EChartsSpec } from "@/lib/viz/spec-types";

const coreMocks = vi.hoisted(() => {
  const createChart = () => ({
    setOption: vi.fn(),
    resize: vi.fn(),
    dispose: vi.fn(),
  });

  const state: { chart: ReturnType<typeof createChart> } = {
    chart: createChart(),
  };

  const use = vi.fn();
  const init = vi.fn(() => state.chart);

  const reset = () => {
    state.chart = createChart();
    use.mockReset();
    init.mockReset();
    init.mockImplementation(() => state.chart);
  };

  reset();

  return {
    get chart() {
      return state.chart;
    },
    use,
    init,
    reset,
  };
});

vi.mock("echarts/core", () => ({
  __esModule: true,
  use: coreMocks.use,
  init: coreMocks.init,
  default: { use: coreMocks.use, init: coreMocks.init },
}));

vi.mock("echarts/charts", () => ({
  __esModule: true,
  LineChart: { type: "line" },
  BarChart: { type: "bar" },
  PieChart: { type: "pie" },
  ScatterChart: { type: "scatter" },
}));

vi.mock("echarts/components", () => ({
  __esModule: true,
  GridComponent: { type: "grid" },
  DatasetComponent: { type: "dataset" },
  TooltipComponent: { type: "tooltip" },
  LegendComponent: { type: "legend" },
  TitleComponent: { type: "title" },
}));

vi.mock("echarts/features", () => ({
  __esModule: true,
  LabelLayout: { type: "labelLayout" },
  UniversalTransition: { type: "universalTransition" },
}));

vi.mock("echarts/renderers", () => ({
  __esModule: true,
  CanvasRenderer: { type: "canvas" },
}));

const BASE_SPEC: EChartsSpec = {
  title: { text: "demo" },
  xAxis: { type: "category", data: ["A", "B"] },
  yAxis: { type: "value" },
  series: [{ type: "bar", data: [1, 2] }],
};

const createHostElement = () => ({}) as unknown as HTMLElement;

async function loadAdapter() {
  const mod = await import("../echarts.adapter");
  return mod.echartsVizAdapter;
}

describe("ECharts adapter — harden", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coreMocks.reset();
  });

  it("registers modules via echarts.use with a non-empty list", async () => {
    const adapter = await loadAdapter();
    const element = createHostElement();

    await adapter.mount({
      el: element,
      spec: BASE_SPEC,
      discrete: false,
      onEvent: vi.fn(),
    });

    expect(coreMocks.use).toHaveBeenCalledTimes(1);
    const args = coreMocks.use.mock.calls[0]?.[0];
    expect(Array.isArray(args)).toBe(true);
    expect(args?.length ?? 0).toBeGreaterThan(0);
  });

  it("disables animations when discrete mode is enabled", async () => {
    const adapter = await loadAdapter();
    const element = createHostElement();

    await adapter.mount({
      el: element,
      spec: BASE_SPEC,
      discrete: true,
      onEvent: vi.fn(),
    });

    expect(coreMocks.chart.setOption).toHaveBeenCalledTimes(1);
    const initialOption = coreMocks.chart.setOption.mock.calls[0]?.[0] as EChartsSpec;
    expect(initialOption).toMatchObject({
      animation: false,
      animationDuration: 0,
      animationDurationUpdate: 0,
      animationEasing: "linear",
      universalTransition: false,
    });
  });

  it("cleans up resize observer and disposes chart on destroy", async () => {
    const adapter = await loadAdapter();
    const element = createHostElement();
    const cleanup = vi.fn();

    const instance = await adapter.mount({
      el: element,
      spec: BASE_SPEC,
      discrete: false,
      onEvent: vi.fn(),
      registerResizeObserver: vi.fn(() => cleanup),
    });

    await instance.destroy();

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(coreMocks.chart.dispose).toHaveBeenCalledTimes(1);
  });

  it("invokes resize from registerResizeObserver once and emits viz_resized", async () => {
    const adapter = await loadAdapter();
    const element = createHostElement();
    const onEvent = vi.fn();
    let resizeHandler: (() => void) | null = null;

    await adapter.mount({
      el: element,
      spec: BASE_SPEC,
      discrete: false,
      onEvent,
      registerResizeObserver: vi.fn((_, cb) => {
        resizeHandler = cb;
        return vi.fn();
      }),
    });

    expect(typeof resizeHandler).toBe("function");
    resizeHandler?.();

    expect(coreMocks.chart.resize).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: "viz_resized" }));
  });
});
