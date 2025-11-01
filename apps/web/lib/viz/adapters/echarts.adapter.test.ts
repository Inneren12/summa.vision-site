import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { echartsAdapter } from "./echarts.adapter";

import type { EChartsSpec } from "@/lib/viz/spec-types";


const lineChart = { type: "line" };
const barChart = { type: "bar" };
const pieChart = { type: "pie" };
const gridComponent = { type: "grid" };
const datasetComponent = { type: "dataset" };
const tooltipComponent = { type: "tooltip" };
const legendComponent = { type: "legend" };
const titleComponent = { type: "title" };
const labelLayout = { type: "label" };
const universalTransition = { type: "transition" };
const canvasRenderer = { type: "canvas" };

const setOptionMock = vi.fn();
const resizeMock = vi.fn();
const disposeMock = vi.fn();
const chartMock = {
  setOption: setOptionMock,
  resize: resizeMock,
  dispose: disposeMock,
};

const useMock = vi.fn();
const initMock = vi.fn(() => chartMock);

vi.mock("echarts/core", () => ({
  use: useMock,
  init: initMock,
}));

vi.mock("echarts/charts", () => ({
  LineChart: lineChart,
  BarChart: barChart,
  PieChart: pieChart,
  ScatterChart: undefined,
}));

vi.mock("echarts/components", () => ({
  GridComponent: gridComponent,
  DatasetComponent: datasetComponent,
  TooltipComponent: tooltipComponent,
  LegendComponent: legendComponent,
  TitleComponent: titleComponent,
}));

vi.mock("echarts/features", () => ({
  LabelLayout: labelLayout,
  UniversalTransition: universalTransition,
}));

vi.mock("echarts/renderers", () => ({
  CanvasRenderer: canvasRenderer,
}));

describe("ECharts adapter", () => {
  let cleanupMock: ReturnType<typeof vi.fn>;
  let resizeCallback: (() => void) | undefined;

  beforeEach(() => {
    cleanupMock = vi.fn();
    resizeCallback = undefined;
    setOptionMock.mockClear();
    resizeMock.mockClear();
    disposeMock.mockClear();
    useMock.mockClear();
    initMock.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("ECharts adapter initializes via modular imports and manages lifecycle events", async () => {
    const el = document.createElement("div");
    document.body.appendChild(el);

    const emit = vi.fn();
    const registerResizeObserver = vi.fn((_: HTMLElement, handler: () => void) => {
      resizeCallback = handler;
      return cleanupMock;
    });

    const spec = { series: ["foo"] } as unknown as EChartsSpec;

    const instance = await echartsAdapter.mount(el, {
      state: { spec },
      emit,
      registerResizeObserver,
      discrete: true,
    });

    expect(emit).toHaveBeenNthCalledWith(1, "viz_init");
    expect(initMock).toHaveBeenCalledWith(el, undefined, { renderer: "canvas" });
    expect(useMock).toHaveBeenCalledTimes(1);
    expect(useMock).toHaveBeenCalledWith([
      lineChart,
      barChart,
      pieChart,
      gridComponent,
      datasetComponent,
      tooltipComponent,
      legendComponent,
      titleComponent,
      labelLayout,
      universalTransition,
      canvasRenderer,
    ]);

    expect(setOptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        animation: false,
        animationDuration: 0,
        animationDurationUpdate: 0,
        animationEasing: "linear",
        universalTransition: false,
        series: spec.series,
      }),
      { notMerge: false, lazyUpdate: true, silent: true },
    );

    expect(emit).toHaveBeenNthCalledWith(2, "viz_ready");

    expect(registerResizeObserver).toHaveBeenCalledWith(el, expect.any(Function));
    resizeCallback?.();
    expect(resizeMock).toHaveBeenCalledTimes(1);
    expect(emit).toHaveBeenCalledWith("viz_resized");

    const nextSpec = { tooltip: { show: true } } as unknown as EChartsSpec;
    instance.applyState({ spec: nextSpec });
    expect(setOptionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        tooltip: { show: true },
        animation: false,
        universalTransition: false,
      }),
      { notMerge: false, lazyUpdate: true, silent: true },
    );
    expect(emit).toHaveBeenCalledWith("viz_state", { specApplied: true });
    expect(nextSpec).toEqual({ tooltip: { show: true } });

    instance.destroy();
    expect(cleanupMock).toHaveBeenCalledTimes(1);
    expect(disposeMock).toHaveBeenCalledTimes(1);
    expect(instance.chart).toBeNull();
    expect(instance.spec).toBeUndefined();
  });
});
