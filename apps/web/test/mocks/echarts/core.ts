export const __used: unknown[] = [];

export function use(mods: unknown[]) {
  if (!Array.isArray(mods)) {
    return;
  }
  __used.push(...mods);
}

export function init(el: HTMLElement, _theme?: unknown, _opts?: unknown) {
  void _theme;
  void _opts;
  return {
    setOption: (_option: unknown, _config?: unknown) => {
      void _option;
      void _config;
    },
    dispose: () => {},
    resize: (_size?: unknown) => {
      void _size;
    },
    getDom: () => el,
  };
}

const core = { use, init };

export default core;
