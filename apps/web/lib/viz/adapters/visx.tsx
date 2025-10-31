import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";

import type { VisxSpec } from "../spec-types";
import type { LegacyVizAdapter } from "../types";

export type { VisxRenderer, VisxSpec } from "../spec-types";

interface VisxInstance<TProps extends Record<string, unknown> = Record<string, unknown>> {
  container: HTMLElement;
  root: Root;
  spec: VisxSpec<TProps>;
  id: string;
}

let instanceCounter = 0;

function cloneSpec<TProps extends Record<string, unknown>>(
  spec: VisxSpec<TProps>,
): VisxSpec<TProps> {
  const props = spec.props ? { ...spec.props } : undefined;
  return {
    kind: "visx",
    component: spec.component,
    props: props as TProps | undefined,
    width: spec.width,
    height: spec.height,
    title: spec.title,
    description: spec.description,
  };
}

function snapshotSpec<TProps extends Record<string, unknown>>(
  spec: VisxSpec<TProps>,
): Readonly<VisxSpec<TProps>> {
  return cloneSpec(spec) as Readonly<VisxSpec<TProps>>;
}

function render<TProps extends Record<string, unknown>>(
  instance: VisxInstance<TProps>,
  spec: VisxSpec<TProps>,
  discrete: boolean,
) {
  const { component, props } = spec;
  const titleId = `${instance.id}-title`;
  const descriptionId = `${instance.id}-description`;
  const baseProps = (props ? { ...(props as TProps) } : {}) as TProps;
  const element = createElement(component, {
    ...baseProps,
    discrete,
    width: spec.width,
    height: spec.height,
    accessibility: {
      titleId,
      descriptionId,
      title: spec.title,
      description: spec.description,
    },
  });
  flushSync(() => {
    instance.root.render(element);
  });
  instance.spec = spec;
}

export const visxAdapter: LegacyVizAdapter<VisxInstance, VisxSpec> = {
  mount(el, spec, opts) {
    const root = createRoot(el);
    instanceCounter += 1;
    const id = `visx-${instanceCounter}`;
    const instance: VisxInstance = {
      container: el,
      root,
      spec: cloneSpec(spec),
      id,
    };
    render(instance, instance.spec, opts.discrete);
    return instance;
  },
  applyState(instance, next, opts) {
    const previous = snapshotSpec(instance.spec);
    const spec = typeof next === "function" ? next(previous) : next;
    render(instance, cloneSpec(spec), opts.discrete);
  },
  destroy(instance) {
    // React roots manage DOM listeners internally, so unmounting is sufficient cleanup.
    instance.root.unmount();
  },
};
