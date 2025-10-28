"use client";

import { useReducedMotion } from "@root/components/motion/useReducedMotion";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

import { emitVizEvent } from "../analytics/send";

import type {
  MotionMode,
  VizAdapter,
  VizAdapterLoader,
  VizAdapterModule,
  VizLibraryTag,
  VizStateMeta,
} from "./types";


type InitialSpecResolver<TSpec extends object> =
  | TSpec
  | ((context: { discrete: boolean }) => TSpec);

type PendingState<TSpec extends object> = {
  value: TSpec;
  wasFunction: boolean;
  meta?: VizStateMeta;
};

type AdapterSource<TInstance, TSpec extends object> =
  | VizAdapter<TInstance, TSpec>
  | VizAdapterLoader<TInstance, TSpec>;

function toMotion(discrete: boolean): MotionMode {
  return discrete ? "discrete" : "animated";
}

function isAdapterLoader<TInstance, TSpec extends object>(
  source: AdapterSource<TInstance, TSpec>,
): source is VizAdapterLoader<TInstance, TSpec> {
  return typeof source === "function";
}

function hasDefaultExport<TInstance, TSpec extends object>(
  module: VizAdapterModule<TInstance, TSpec>,
): module is { default: VizAdapter<TInstance, TSpec> } {
  return typeof (module as { default?: unknown }).default !== "undefined";
}

function normalizeAdapterModule<TInstance, TSpec extends object>(
  module: VizAdapterModule<TInstance, TSpec>,
): VizAdapter<TInstance, TSpec> {
  if (hasDefaultExport(module)) {
    return module.default;
  }
  return module as VizAdapter<TInstance, TSpec>;
}

function freezeSpec<TSpec extends object>(spec: TSpec): Readonly<TSpec> {
  if (typeof Object.freeze === "function") {
    return Object.freeze(spec);
  }
  return spec;
}

function cloneSpec<TSpec extends object>(spec: TSpec): TSpec {
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(spec);
    } catch {
      // fall through to shallow copy
    }
  }

  if (Array.isArray(spec)) {
    return spec.slice() as unknown as TSpec;
  }

  return { ...(spec as Record<string, unknown>) } as TSpec;
}

function asError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(typeof error === "string" ? error : "Unknown visualization error");
}

function buildErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message || error.name;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

export interface UseVizMountOptions<TInstance, TSpec extends object> {
  readonly adapter: AdapterSource<TInstance, TSpec>;
  readonly lib: VizLibraryTag;
  readonly initialSpec: InitialSpecResolver<TSpec>;
}

export interface UseVizMountResult<TInstance, TSpec extends object> {
  readonly ref: (element: HTMLElement | null) => void;
  readonly elementRef: MutableRefObject<HTMLElement | null>;
  readonly instance: TInstance | null;
  readonly currentSpec: TSpec;
  readonly isReady: boolean;
  readonly discrete: boolean;
  readonly error: Error | null;
  readonly applyState: (
    next: TSpec | ((prev: Readonly<TSpec>) => TSpec),
    meta?: VizStateMeta,
  ) => void;
}

export function useVizMount<TInstance, TSpec extends object>(
  options: UseVizMountOptions<TInstance, TSpec>,
): UseVizMountResult<TInstance, TSpec> {
  const { adapter: adapterSource, lib, initialSpec } = options;
  const { isReducedMotion } = useReducedMotion();
  const discreteRef = useRef(isReducedMotion);
  discreteRef.current = isReducedMotion;

  const adapterRef = useRef<VizAdapter<TInstance, TSpec> | null>(
    isAdapterLoader(adapterSource) ? null : adapterSource,
  );
  const [adapterState, setAdapterState] = useState<VizAdapter<TInstance, TSpec> | null>(
    adapterRef.current,
  );

  const elementStateRef = useRef<HTMLElement | null>(null);
  const [element, setElement] = useState<HTMLElement | null>(null);

  const resolveInitialSpec = useCallback((): TSpec => {
    const resolver = initialSpec as InitialSpecResolver<TSpec>;
    if (typeof resolver === "function") {
      return (resolver as (context: { discrete: boolean }) => TSpec)({
        discrete: discreteRef.current,
      });
    }
    return resolver;
  }, [initialSpec]);

  const initialSpecRef = useRef<TSpec | null>(null);
  if (initialSpecRef.current === null) {
    initialSpecRef.current = resolveInitialSpec();
  }

  const [currentSpec, setCurrentSpec] = useState<TSpec>(() => {
    return initialSpecRef.current as TSpec;
  });

  const specRef = useRef<TSpec>(initialSpecRef.current as TSpec);
  specRef.current = currentSpec;

  const instanceRef = useRef<TInstance | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const pendingStatesRef = useRef<PendingState<TSpec>[]>([]);

  useEffect(() => {
    if (!isAdapterLoader(adapterSource)) {
      adapterRef.current = adapterSource;
      setAdapterState(adapterSource);
      setError(null);
      return;
    }

    adapterRef.current = null;
    setAdapterState(null);

    let cancelled = false;
    const loadAdapter = async () => {
      try {
        const loadedModule = await adapterSource();
        if (cancelled) {
          return;
        }
        const resolved = normalizeAdapterModule(loadedModule);
        adapterRef.current = resolved;
        setAdapterState(resolved);
        setError(null);
      } catch (err) {
        if (cancelled) {
          return;
        }
        const nextError = asError(err);
        setError(nextError);
        emitVizEvent("viz_error", {
          lib,
          motion: toMotion(discreteRef.current),
          reason: "adapter-load",
          error: buildErrorMessage(err),
        });
      }
    };

    loadAdapter();

    return () => {
      cancelled = true;
    };
  }, [adapterSource, lib]);

  const applyToInstance = useCallback(
    (instance: TInstance, payload: PendingState<TSpec>) => {
      const adapter = adapterRef.current;
      if (!adapter) {
        return;
      }
      try {
        const discrete = discreteRef.current;
        const motion = toMotion(discrete);
        if (payload.wasFunction) {
          const value = payload.value;
          adapter.applyState(instance, () => value, { discrete });
        } else {
          adapter.applyState(instance, payload.value, { discrete });
        }
        emitVizEvent("viz_state", {
          lib,
          motion,
          stepId: payload.meta?.stepId,
          reason: payload.meta?.reason ?? "update",
        });
      } catch (err) {
        const nextError = asError(err);
        setError(nextError);
        emitVizEvent("viz_error", {
          lib,
          motion: toMotion(discreteRef.current),
          stepId: payload.meta?.stepId,
          reason: payload.meta?.reason ?? "apply",
          error: buildErrorMessage(err),
        });
      }
    },
    [lib],
  );

  const applyState = useCallback(
    (next: TSpec | ((prev: Readonly<TSpec>) => TSpec), meta?: VizStateMeta) => {
      const wasFunction = typeof next === "function";
      const value = wasFunction
        ? (next as (prev: Readonly<TSpec>) => TSpec)(freezeSpec(cloneSpec(specRef.current)))
        : (next as TSpec);

      specRef.current = value;
      setCurrentSpec(value);

      const payload: PendingState<TSpec> = {
        value,
        wasFunction,
        meta,
      };

      const instance = instanceRef.current;
      if (instance) {
        applyToInstance(instance, payload);
        return;
      }

      pendingStatesRef.current.push(payload);
    },
    [applyToInstance],
  );

  const flushPendingStates = useCallback(
    (instance: TInstance) => {
      if (pendingStatesRef.current.length === 0) {
        return;
      }

      const states = pendingStatesRef.current.splice(0, pendingStatesRef.current.length);
      for (const payload of states) {
        applyToInstance(instance, payload);
      }
    },
    [applyToInstance],
  );

  const mountRef = useCallback((node: HTMLElement | null) => {
    elementStateRef.current = node;
    setElement(node);
  }, []);

  useEffect(() => {
    const nextInitial = resolveInitialSpec();
    if (!instanceRef.current) {
      initialSpecRef.current = nextInitial;
      specRef.current = nextInitial;
      setCurrentSpec(nextInitial);
    }
  }, [resolveInitialSpec]);

  useEffect(() => {
    const target = element;
    const adapter = adapterRef.current;
    if (!target || !adapter) {
      return;
    }

    let cancelled = false;
    let mountedInstance: TInstance | null = null;

    const destroySafely = (
      instance: TInstance,
      reason: "cancelled" | "destroy",
      options: { clearPending?: boolean } = {},
    ) => {
      const motion = toMotion(discreteRef.current);
      const { clearPending = true } = options;
      try {
        adapter.destroy(instance);
      } catch (err) {
        emitVizEvent("viz_error", {
          lib,
          motion,
          reason: "destroy",
          error: buildErrorMessage(err),
        });
      } finally {
        emitVizEvent("viz_destroyed", { lib, motion, reason });
        if (instanceRef.current === instance) {
          instanceRef.current = null;
        }
        if (mountedInstance === instance) {
          mountedInstance = null;
        }
        if (clearPending) {
          pendingStatesRef.current = [];
        }
      }
    };

    const discrete = discreteRef.current;
    emitVizEvent("viz_init", { lib, motion: toMotion(discrete), reason: "mount" });

    const runMount = async () => {
      try {
        const result = await adapter.mount(target, specRef.current, { discrete });
        if (cancelled) {
          destroySafely(result, "cancelled", { clearPending: false });
          return;
        }
        mountedInstance = result;
        instanceRef.current = result;
        setIsReady(true);
        emitVizEvent("viz_ready", { lib, motion: toMotion(discreteRef.current) });
        flushPendingStates(result);
      } catch (err) {
        const nextError = asError(err);
        setError(nextError);
        emitVizEvent("viz_error", {
          lib,
          motion: toMotion(discreteRef.current),
          reason: "mount",
          error: buildErrorMessage(err),
        });
      }
    };

    runMount();

    return () => {
      cancelled = true;
      setIsReady(false);
      const instance = mountedInstance ?? instanceRef.current;
      if (instance) {
        destroySafely(instance, "destroy");
      }
    };
  }, [element, flushPendingStates, lib, adapterState]);

  useEffect(() => {
    emitVizEvent("viz_motion_mode", {
      lib,
      motion: toMotion(isReducedMotion),
      reason: "preference",
    });
  }, [lib, isReducedMotion]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) {
      return;
    }
    applyToInstance(instance, {
      value: specRef.current,
      wasFunction: false,
      meta: { reason: "discrete-change" },
    });
  }, [applyToInstance, isReducedMotion]);

  return useMemo(
    () => ({
      ref: mountRef,
      elementRef: elementStateRef as MutableRefObject<HTMLElement | null>,
      instance: instanceRef.current,
      currentSpec,
      isReady,
      discrete: isReducedMotion,
      error,
      applyState,
    }),
    [applyState, currentSpec, error, isReady, mountRef, isReducedMotion],
  );
}
