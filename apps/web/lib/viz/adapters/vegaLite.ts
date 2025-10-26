import type { VisualizationSpec } from "vega-embed";

import type { VizAdapter } from "../types";

interface VegaEmbedResult {
  view?: {
    finalize?: () => void;
  };
}

interface VegaLiteInstance {
  element: HTMLElement;
  embed: typeof import("vega-embed");
  result: VegaEmbedResult | null;
  spec: VisualizationSpec;
}

function animationConfig(discrete: boolean) {
  if (!discrete) {
    return undefined;
  }
  return {
    duration: 0,
    easing: "linear",
  };
}

async function render(
  instance: VegaLiteInstance,
  spec: VisualizationSpec,
  discrete: boolean,
): Promise<VegaEmbedResult> {
  const embed = instance.embed.default ?? instance.embed;
  const result = await embed(instance.element, spec, {
    actions: false,
    renderer: "canvas",
    config: {
      animation: animationConfig(discrete),
    },
  });
  instance.result?.view?.finalize?.();
  instance.result = result as VegaEmbedResult;
  instance.spec = spec;
  return instance.result;
}

export const vegaLiteAdapter: VizAdapter<VegaLiteInstance, VisualizationSpec> = {
  async mount(el, spec, opts) {
    const embed = await import("vega-embed");
    const instance: VegaLiteInstance = {
      element: el,
      embed,
      result: null,
      spec,
    };
    await render(instance, spec, opts.discrete);
    return instance;
  },
  applyState(instance, next, opts) {
    const spec = typeof next === "function" ? next(instance.spec) : next;
    void render(instance, spec, opts.discrete);
  },
  destroy(instance) {
    instance.result?.view?.finalize?.();
    instance.result = null;
  },
};
