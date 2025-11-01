// Минимальная заглушка для echarts
export type EChartsOption = Record<string, unknown>;

export interface ECharts {
  setOption(option: EChartsOption, opts?: Record<string, unknown>): void;
  resize(): void;
  dispose(): void;
}

function throwMissingLibrary(): never {
  throw new Error(
    "[viz-stub] echarts не установлен. Установите пакет, чтобы использовать ECharts-адаптер.",
  );
}

export const init = (
  ..._args: [element: HTMLElement, theme?: string | object, opts?: { renderer?: "canvas" | "svg" }]
): ECharts => {
  void _args;
  throwMissingLibrary();
};

export const use = (..._args: unknown[]): void => {
  void _args;
  throwMissingLibrary();
};

export class BarChart {}
export class LineChart {}
export class ScatterChart {}

export class GridComponent {}
export class DatasetComponent {}
export class TooltipComponent {}
export class VisualMapComponent {}
export class LegendComponent {}

export class CanvasRenderer {}

const echarts = { init, use };
export default echarts;
