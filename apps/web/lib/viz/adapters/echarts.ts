import type { EChartsSpec } from "../spec-types";
import type { VizAdapter } from "../types";

type ECharts = import("echarts").ECharts;

interface EChartsInstance {
  element: HTMLElement;
  chart: ECharts;
  spec: EChartsSpec;
}

function cloneSpec(spec: EChartsSpec): EChartsSpec {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // ignore
    }
  }
  if (Array.isArray(spec)) {
    return spec.slice() as unknown as EChartsSpec;
  }
  return { ...(spec as Record<string, unknown>) } as EChartsSpec;
}

function applyOption(chart: ECharts, option: EChartsSpec, discrete: boolean) {
  chart.setOption(option, {
    notMerge: false,
    lazyUpdate: !discrete,
    silent: false,
    animation: !discrete,
    replaceMerge: discrete ? ["series", "dataset"] : undefined,
  } as never);
}

export const echartsAdapter: VizAdapter<EChartsInstance, EChartsSpec> = {
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
