import type { VizAdapter } from "../types";

type ECharts = import("echarts").ECharts;
type EChartsOption = import("echarts").EChartsOption;

interface EChartsInstance {
  element: HTMLElement;
  chart: ECharts;
  spec: EChartsOption;
}

function applyOption(chart: ECharts, option: EChartsOption, discrete: boolean) {
  chart.setOption(option, {
    notMerge: false,
    lazyUpdate: !discrete,
    silent: false,
    animation: !discrete,
    replaceMerge: discrete ? ["series", "dataset"] : undefined,
  } as never);
}

export const echartsAdapter: VizAdapter<EChartsInstance, EChartsOption> = {
  async mount(el, spec, opts) {
    const echarts = await import("echarts");
    const chart = echarts.init(el, undefined, { renderer: "canvas" });
    applyOption(chart, spec, opts.discrete);
    return { element: el, chart, spec };
  },
  applyState(instance, next, opts) {
    const option = typeof next === "function" ? next(instance.spec) : next;
    instance.spec = option;
    applyOption(instance.chart, option, opts.discrete);
  },
  destroy(instance) {
    instance.chart.dispose();
  },
};
