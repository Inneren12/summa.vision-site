export type EChartsOption = unknown;

export function init(el: HTMLElement) {
  void el;
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setOption(option: any, opts?: unknown) {
      void option;
      void opts;
    },
    dispose() {},
  };
}

export function use(): void {}

export class BarChart {}
export class LineChart {}
export class ScatterChart {}
export class GridComponent {}
export class DatasetComponent {}
export class TooltipComponent {}
export class VisualMapComponent {}
export class LegendComponent {}
export class CanvasRenderer {}

const echartsMock = { init, use };

export default echartsMock;
