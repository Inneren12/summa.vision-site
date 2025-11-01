// prettier-ignore
'use client';

import type { EChartsSpec } from "../spec-types";
import type { RegisterResizeObserver, VizEmit, VizLifecycleEvent } from "../types";

import { echartsAdapter } from "./echarts.adapter";

export { echartsAdapter } from "./echarts.adapter";
export default echartsAdapter;

interface LegacyMountOptions {
  readonly emit?: VizEmit;
  readonly onEvent?: (event: VizLifecycleEvent) => void;
  readonly registerResizeObserver?: RegisterResizeObserver;
  readonly discrete?: boolean;
}

type ModernMountArgs = Parameters<typeof echartsAdapter.mount>[1];

const isModernArgs = (value: unknown): value is ModernMountArgs =>
  typeof value === "object" && value !== null && "state" in (value as Record<string, unknown>);

export const mount = (...args: unknown[]): ReturnType<typeof echartsAdapter.mount> => {
  if (args.length === 2 && isModernArgs(args[1])) {
    return echartsAdapter.mount(args[0] as HTMLElement, args[1]);
  }

  const [element, spec, legacy = {}] = args as [
    HTMLElement,
    EChartsSpec | undefined,
    LegacyMountOptions | undefined,
  ];

  const { emit, onEvent, registerResizeObserver, discrete } = legacy ?? {};

  const emitFn = typeof emit === "function" ? emit : undefined;
  const onEventFn = typeof onEvent === "function" ? onEvent : undefined;
  const registerResizeObserverFn =
    typeof registerResizeObserver === "function" ? registerResizeObserver : undefined;

  return echartsAdapter.mount(element, {
    state: { spec },
    emit: emitFn,
    onEvent: onEventFn,
    registerResizeObserver: registerResizeObserverFn,
    discrete,
  });
};
