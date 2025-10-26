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

const echartsMock = { init };

export default echartsMock;
