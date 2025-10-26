const embed = async (el: HTMLElement, spec: unknown, opts?: unknown) => {
  void el;
  void spec;
  void opts;
  return {
    view: { runAsync: async () => {}, finalize: () => {} },
  };
};

export default embed;
