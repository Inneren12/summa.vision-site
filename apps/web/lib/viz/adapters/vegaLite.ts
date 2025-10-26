import type { VegaLiteSpec } from "../spec-types";
import type { VizAdapter } from "../types";

type VisualizationSpec = import("vega-embed").VisualizationSpec;

interface VegaEmbedResult {
  view?: {
    finalize?: () => void;
  };
}

interface VegaLiteInstance {
  element: HTMLElement;
  embed: typeof import("vega-embed");
  result: VegaEmbedResult | null;
  spec: VegaLiteSpec;
}

function cloneSpec(spec: VegaLiteSpec): VegaLiteSpec {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // fall through
    }
  }
  return JSON.parse(JSON.stringify(spec)) as VegaLiteSpec;
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
  spec: VegaLiteSpec,
  discrete: boolean,
): Promise<VegaEmbedResult> {
  const embed = instance.embed.default ?? instance.embed;
  const result = await embed(instance.element, spec as VisualizationSpec, {
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

export const vegaLiteAdapter: VizAdapter<VegaLiteInstance, VegaLiteSpec> = {
  async mount(el, spec, opts) {
    const embed = await import("vega-embed");
    const instance: VegaLiteInstance = {
      element: el,
      embed,
      result: null,
      spec: cloneSpec(spec),
    };
    await render(instance, instance.spec, opts.discrete);
    return instance;
  },
  applyState(instance, next, opts) {
    const previous = cloneSpec(instance.spec);
    const spec = typeof next === "function" ? next(previous) : next;
    void render(instance, cloneSpec(spec), opts.discrete);
  },
  destroy(instance) {
    instance.result?.view?.finalize?.();
    instance.result = null;
  },
};
