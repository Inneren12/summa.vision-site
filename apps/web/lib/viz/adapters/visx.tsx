import { createElement } from "react";
import { createRoot, type Root } from "react-dom/client";

import type { VizAdapter } from "../types";

export type VisxRenderer<TProps extends object = Record<string, unknown>> = (
  props: TProps & { discrete: boolean },
) => JSX.Element;

export interface VisxSpec<TProps extends object = Record<string, unknown>> {
  readonly component: VisxRenderer<TProps>;
  readonly props?: TProps;
}

interface VisxInstance<TProps extends object = Record<string, unknown>> {
  container: HTMLElement;
  root: Root;
  spec: VisxSpec<TProps>;
}

function render<TProps extends object>(
  instance: VisxInstance<TProps>,
  spec: VisxSpec<TProps>,
  discrete: boolean,
) {
  const { component, props } = spec;
  const element = createElement(component, { ...(props as TProps), discrete });
  instance.root.render(element);
  instance.spec = spec;
}

export const visxAdapter: VizAdapter<VisxInstance, VisxSpec> = {
  mount(el, spec, opts) {
    const root = createRoot(el);
    const instance: VisxInstance = {
      container: el,
      root,
      spec,
    };
    render(instance, spec, opts.discrete);
    return instance;
  },
  applyState(instance, next, opts) {
    const spec = typeof next === "function" ? next(instance.spec) : next;
    render(instance, spec, opts.discrete);
  },
  destroy(instance) {
    instance.root.unmount();
  },
};
