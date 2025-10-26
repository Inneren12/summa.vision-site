export interface VizAdapter<TInstance, TSpec = unknown> {
  mount(el: HTMLElement, spec: TSpec, opts: { discrete: boolean }): Promise<TInstance> | TInstance;
  applyState(
    instance: TInstance,
    next: TSpec | ((prev: TSpec) => TSpec),
    opts: { discrete: boolean },
  ): void;
  destroy(instance: TInstance): void;
}

export type VizLibraryTag = "vega" | "echarts" | "maplibre" | "visx" | "deck" | "fake";

export type VizEventName = "viz_init" | "viz_ready" | "viz_state" | "viz_error";

export interface VizEventDetail {
  readonly lib: VizLibraryTag;
  readonly discrete: boolean;
  readonly stepId?: string | null;
  readonly reason?: string;
  readonly error?: string;
}

export interface VizStateMeta {
  readonly stepId?: string | null;
  readonly reason?: string;
}
