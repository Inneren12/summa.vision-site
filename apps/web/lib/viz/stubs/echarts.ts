// Минимальная заглушка для echarts
export type ECharts = { dispose: () => void; resize: () => void } & Record<string, unknown>;
export type EChartsOption = Record<string, unknown>;

const echarts = {
  init: (..._args: unknown[]): ECharts => {
    void _args;
    throw new Error(
      "[viz-stub] echarts не установлен. Установите пакет, чтобы использовать ECharts-адаптер.",
    );
  },
};

export default echarts;
