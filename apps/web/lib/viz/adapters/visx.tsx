import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import type { VisxSpec } from "../spec-types";
import type { VizAdapter } from "../types";

export type { VisxRenderer, VisxSpec } from "../spec-types";

interface VisxInstance<TProps extends Record<string, unknown> = Record<string, unknown>> {
  container: HTMLElement | null;
  root: Root | null;
  spec: VisxSpec<TProps> | null;
}

function cloneSpec<TProps extends Record<string, unknown>>(
  spec: VisxSpec<TProps>,
): VisxSpec<TProps> {
  const props = spec.props ? { ...spec.props } : undefined;
  return {
    component: spec.component,
    props: props as TProps | undefined,
    width: spec.width,
    height: spec.height,
  };
}

function render<TProps extends Record<string, unknown>>(
  instance: VisxInstance<TProps>,
  spec: VisxSpec<TProps>,
  discrete: boolean,
) {
  const root = instance.root;
  if (!root) {
    return;
  }
  const { component, props } = spec;
  const element = createElement(component, { ...(props as TProps), discrete });
  flushSync(() => {
    root.render(element);
  });
  instance.spec = spec;
}

export const visxAdapter: VizAdapter<VisxInstance, VisxSpec> = {
  mount(el, spec, opts) {
    const root = createRoot(el);
    const instance: VisxInstance = {
      container: el,
      root,
      spec: cloneSpec(spec),
    };
    render(instance, instance.spec, opts.discrete);
    return instance;
  },
  applyState(instance, next, opts) {
    const currentSpec = instance.spec;
    if (!currentSpec) {
      return;
    }
    const previous = cloneSpec(currentSpec);
    const spec = typeof next === "function" ? next(previous) : next;
    render(instance, cloneSpec(spec), opts.discrete);
  },
  destroy(instance) {
    instance.root?.unmount();
    instance.root = null;
    instance.container = null;
    instance.spec = null;
  },
};
