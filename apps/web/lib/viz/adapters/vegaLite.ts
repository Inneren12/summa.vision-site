import type { VegaLiteSpec } from "../spec-types";
import type { VizAdapter } from "../types";

type VisualizationSpec = import("vega-embed").VisualizationSpec;

interface VegaEmbedResult {
  view?: {
    finalize?: () => void;
  };
}

interface VegaLiteInstance {
  element: HTMLElement | null;
  embed: typeof import("vega-embed") | null;
  result: VegaEmbedResult | null;
  spec: VegaLiteSpec | null;
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
  const element = instance.element;
  const embedModule = instance.embed;
  if (!element || !embedModule) {
    return instance.result ?? ({} as VegaEmbedResult);
  }
  const embed = embedModule.default ?? embedModule;
  const result = await embed(element, spec as VisualizationSpec, {
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
    const currentSpec = instance.spec;
    if (!currentSpec) {
      return;
    }
    const previous = cloneSpec(currentSpec);
    const spec = typeof next === "function" ? next(previous) : next;
    void render(instance, cloneSpec(spec), opts.discrete);
  },
  destroy(instance) {
    instance.result?.view?.finalize?.();
    instance.result = null;
    instance.embed = null;
    instance.element = null;
    instance.spec = null;
  },
};
