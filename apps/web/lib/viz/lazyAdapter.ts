import { emitVizEvent } from "./events";
import type {
  MotionMode,
  VizAdapter,
  VizAdapterLoader,
  VizAdapterModule,
  VizLibraryTag,
} from "./types";

function toMotion(discrete: boolean | undefined): MotionMode {
  return discrete ? "discrete" : "animated";
}

function normalizeAdapterModule<TInstance, TSpec extends object>(
  module: VizAdapterModule<TInstance, TSpec>,
): VizAdapter<TInstance, TSpec> {
  if (typeof (module as { default?: unknown }).default !== "undefined") {
    return (module as { default: VizAdapter<TInstance, TSpec> }).default;
  }
  return module as VizAdapter<TInstance, TSpec>;
}

export interface LazyAdapterHandle<TInstance, TSpec extends object> {
  readonly adapter: VizAdapter<TInstance, TSpec>;
  readonly prefetch: (options?: { discrete?: boolean; reason?: string }) => Promise<void>;
  readonly load: () => Promise<VizAdapter<TInstance, TSpec>>;
}

export function createLazyAdapter<TInstance, TSpec extends object>(
  lib: VizLibraryTag,
  loader: VizAdapterLoader<TInstance, TSpec>,
): LazyAdapterHandle<TInstance, TSpec> {
  let resolvedAdapter: VizAdapter<TInstance, TSpec> | null = null;
  let loadingPromise: Promise<VizAdapter<TInstance, TSpec>> | null = null;
  let emittedPrefetch = false;
  let emittedLazyMount = false;

  const ensureLoaded = async () => {
    if (resolvedAdapter) {
      return resolvedAdapter;
    }

    if (!loadingPromise) {
      loadingPromise = Promise.resolve(loader()).then((module) => {
        const adapter = normalizeAdapterModule(module);
        resolvedAdapter = adapter;
        return adapter;
      });
    }

    return loadingPromise;
  };

  const emitLazyMount = (motion: MotionMode) => {
    if (emittedLazyMount) {
      return;
    }
    emittedLazyMount = true;
    emitVizEvent("viz_lazy_mount", { lib, motion, reason: "mount" });
  };

  const emitPrefetch = (motion: MotionMode, reason?: string) => {
    if (emittedPrefetch) {
      return;
    }
    emittedPrefetch = true;
    emitVizEvent("viz_prefetch", { lib, motion, reason: reason ?? "prefetch" });
  };

  const adapter: VizAdapter<TInstance, TSpec> = {
    async mount(element, spec, opts) {
      const motion = toMotion(opts?.discrete);
      emitLazyMount(motion);
      const target = await ensureLoaded();
      return target.mount(element, spec, opts);
    },
    applyState(instance, next, opts) {
      if (!resolvedAdapter) {
        throw new Error(`Lazy adapter for "${lib}" has not been mounted`);
      }
      resolvedAdapter.applyState(instance, next, opts);
    },
    destroy(instance) {
      if (!resolvedAdapter) {
        return;
      }
      resolvedAdapter.destroy(instance);
    },
  };

  const prefetch = async (options?: { discrete?: boolean; reason?: string }) => {
    const motion = toMotion(options?.discrete);
    emitPrefetch(motion, options?.reason);
    await ensureLoaded();
  };

  return {
    adapter,
    prefetch,
    load: ensureLoaded,
  };
}
