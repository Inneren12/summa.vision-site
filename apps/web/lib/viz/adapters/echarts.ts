import type { VizAdapter } from "../types";

type ECharts = import("echarts").ECharts;
type EChartsOption = import("echarts").EChartsOption;

interface EChartsInstance {
  element: HTMLElement;
  chart: ECharts;
  spec: EChartsOption;
}

function cloneSpec(spec: EChartsOption): EChartsOption {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // ignore
    }
  }
  if (Array.isArray(spec)) {
    return spec.slice() as unknown as EChartsOption;
  }
  return { ...(spec as Record<string, unknown>) } as EChartsOption;
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
    const clone = cloneSpec(spec);
    applyOption(chart, clone, opts.discrete);
    return { element: el, chart, spec: clone };
  },
  applyState(instance, next, opts) {
    const previous = cloneSpec(instance.spec);
    const option = typeof next === "function" ? next(previous) : next;
    const clone = cloneSpec(option);
    instance.spec = clone;
    applyOption(instance.chart, clone, opts.discrete);
  },
  destroy(instance) {
    instance.chart.dispose();
  },
};
