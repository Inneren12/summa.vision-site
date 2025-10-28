export type MotionMode = "animated" | "discrete";

export interface VizAdapter<TInstance, TSpec extends object> {
  mount(el: HTMLElement, spec: TSpec, opts: { discrete: boolean }): Promise<TInstance> | TInstance;
  applyState(
    instance: TInstance,
    next: TSpec | ((prev: Readonly<TSpec>) => TSpec),
    opts: { discrete: boolean },
  ): void;
  destroy(instance: TInstance): void;
}

export type VizAdapterModule<TInstance, TSpec extends object> =
  | VizAdapter<TInstance, TSpec>
  | { default: VizAdapter<TInstance, TSpec> };

export type VizAdapterLoader<TInstance, TSpec extends object> = () =>
  | VizAdapterModule<TInstance, TSpec>
  | Promise<VizAdapterModule<TInstance, TSpec>>;

export type VizLibraryTag = "vega" | "echarts" | "maplibre" | "visx" | "deck" | "fake";

export type VizEventName =
  | "viz_init"
  | "viz_ready"
  | "viz_state"
  | "viz_error"
  | "viz_lazy_mount"
  | "viz_prefetch"
  | "viz_destroyed"
  | "viz_fallback_engaged";

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
