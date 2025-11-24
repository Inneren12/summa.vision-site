export type VizEventType = "viz_init" | "viz_ready" | "viz_state" | "viz_error";

export interface VizEvent {
  type: VizEventType;
  ts: number;
  meta?: Record<string, unknown>;
}

export type VizEmit = (
  event: VizEventType,
  payload?: unknown,
  meta?: Record<string, unknown>,
) => void;

export type VizInstance<S = unknown> = {
  applyState?: (next: Partial<S>) => void | Promise<void>;
  destroy: () => void | Promise<void>;
  /** Optional fields supported by current adapters */
  selectionSignal?: string | null;
  emitState?: () => void;
};

export type VizLifecycleEvent = {
  readonly type: VizEventType;
  readonly ts: number;
  readonly meta?: Record<string, unknown>;
};

export type VizAdapter<S = unknown> = {
  mount: (
    el: HTMLElement,
    opts: {
      state: Readonly<S>;
      emit: VizEmit;
      onEvent?: (name: string, payload?: unknown) => void;
      registerResizeObserver?: (el: HTMLElement, cb: () => void) => () => void;
    },
  ) => VizInstance<S> | Promise<VizInstance<S>>;
};

export type RegisterResizeObserver = (element: HTMLElement, callback: () => void) => () => void;

export type VizMountArgs<S, Spec, Data> = {
  readonly el: HTMLElement;
  readonly spec?: Spec;
  readonly data?: Data;
  readonly initialState?: S;
  readonly discrete?: boolean;
  readonly onEvent?: (event: VizLifecycleEvent) => void;
  readonly registerResizeObserver?: RegisterResizeObserver;
};

export interface VizAdapterWithConfig<S = unknown, Spec = unknown, Data = unknown> {
  mount(args: VizMountArgs<S, Spec, Data>): Promise<VizInstance<S>> | VizInstance<S>;
}

export type VizAdapterLoader<S, Spec, Data> = () =>
  | VizAdapterWithConfig<S, Spec, Data>
  | Promise<VizAdapterWithConfig<S, Spec, Data>>;

export type InferVizState<TAdapter extends VizAdapterWithConfig<unknown, unknown, unknown>> =
  TAdapter extends VizAdapterWithConfig<infer State, unknown, unknown> ? State : never;

export type InferVizSpec<TAdapter extends VizAdapterWithConfig<unknown, unknown, unknown>> =
  TAdapter extends VizAdapterWithConfig<unknown, infer Spec, unknown> ? Spec : never;

export type InferVizData<TAdapter extends VizAdapterWithConfig<unknown, unknown, unknown>> =
  TAdapter extends VizAdapterWithConfig<unknown, unknown, infer Data> ? Data : never;

export type MotionMode = "animated" | "discrete";

export interface LegacyVizAdapter<TInstance, TSpec extends object> {
  mount(el: HTMLElement, spec: TSpec, opts: { discrete: boolean }): Promise<TInstance> | TInstance;
  applyState(
    instance: TInstance,
    next: TSpec | ((prev: Readonly<TSpec>) => TSpec),
    opts: { discrete: boolean },
  ): void;
  destroy(instance: TInstance): void;
}

export type LegacyVizAdapterModule<TInstance, TSpec extends object> =
  | LegacyVizAdapter<TInstance, TSpec>
  | { default: LegacyVizAdapter<TInstance, TSpec> };

export type LegacyVizAdapterLoader<TInstance, TSpec extends object> = () =>
  | LegacyVizAdapterModule<TInstance, TSpec>
  | Promise<LegacyVizAdapterModule<TInstance, TSpec>>;

export type VizLibraryTag = "vega" | "echarts" | "maplibre" | "visx" | "deck" | "fake";

export type VizEventName =
  | "viz_init"
  | "viz_ready"
  | "viz_state"
  | "viz_error"
  | "viz_lazy_mount"
  | "viz_prefetch"
  | "viz_destroyed"
  | "viz_fallback_engaged"
  | "viz_data_mapped"
  | "viz_motion_mode"
  | "viz_spec_load";

export type VizBrowserEventName = VizEventType | "viz_lifecycle";

export const VIZ_BROWSER_EVENT_NAMES: ReadonlySet<VizBrowserEventName> = new Set([
  "viz_init",
  "viz_ready",
  "viz_state",
  "viz_error",
  "viz_lifecycle",
]);

export function isVizBrowserEventName(name: VizEventName | string): name is VizBrowserEventName {
  return VIZ_BROWSER_EVENT_NAMES.has(name as VizBrowserEventName);
}

export interface VizEventDetail {
  readonly [key: string]: unknown;
  readonly lib?: VizLibraryTag;
  readonly motion: MotionMode;
  readonly stepId?: string | null;
  readonly reason?: string;
  readonly error?: string;
}

export interface VizStateMeta {
  readonly stepId?: string | null;
  readonly reason?: string;
}
