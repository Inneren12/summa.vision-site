export type VizEventType = "viz_init" | "viz_ready" | "viz_state" | "viz_error";

export type VizEvent = {
  readonly type: VizEventType;
  readonly ts: number;
  readonly meta?: Record<string, unknown>;
};

export interface VizInstance<S = unknown> {
  applyState(next: Partial<S>): Promise<void> | void;
  destroy(): Promise<void> | void;
}

export type RegisterResizeObserver = (callback: ResizeObserverCallback) => () => void;

export type VizMountArgs<S, Spec, Data> = {
  readonly el: HTMLElement;
  readonly spec?: Spec;
  readonly data?: Data;
  readonly initialState?: S;
  readonly discrete?: boolean;
  readonly onEvent?: (event: VizEvent) => void;
  readonly registerResizeObserver?: RegisterResizeObserver;
};

export interface VizAdapter<S = unknown, Spec = unknown, Data = unknown> {
  mount(args: VizMountArgs<S, Spec, Data>): Promise<VizInstance<S>> | VizInstance<S>;
}

export type InferVizState<TAdapter extends VizAdapter<unknown, unknown, unknown>> =
  TAdapter extends VizAdapter<infer State, unknown, unknown> ? State : never;

export type InferVizSpec<TAdapter extends VizAdapter<unknown, unknown, unknown>> =
  TAdapter extends VizAdapter<unknown, infer Spec, unknown> ? Spec : never;

export type InferVizData<TAdapter extends VizAdapter<unknown, unknown, unknown>> =
  TAdapter extends VizAdapter<unknown, unknown, infer Data> ? Data : never;

export type MotionMode = "animated" | "discrete";

type LegacyMountOptions = {
  readonly discrete: boolean;
  readonly onEvent?: (event: VizEvent) => void;
  readonly registerResizeObserver?: RegisterResizeObserver;
};

type LegacyApplyOptions = {
  readonly discrete: boolean;
  readonly onEvent?: (event: VizEvent) => void;
};

export interface LegacyVizAdapter<TInstance, TSpec extends object> {
  mount(el: HTMLElement, spec: TSpec, opts: LegacyMountOptions): Promise<TInstance> | TInstance;
  applyState(
    instance: TInstance,
    next: TSpec | ((prev: Readonly<TSpec>) => TSpec),
    opts: LegacyApplyOptions,
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
