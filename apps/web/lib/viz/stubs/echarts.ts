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

const echarts = { init };
export default echarts;
