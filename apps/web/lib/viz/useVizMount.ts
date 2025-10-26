"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

import { emitVizEvent } from "./events";
import type { VizAdapter, VizStateMeta, VizLibraryTag } from "./types";

import { usePrefersReducedMotion } from "@/components/motion/prefersReducedMotion";

type InitialSpecResolver<TSpec> = TSpec | ((context: { discrete: boolean }) => TSpec);

type PendingState<TSpec> = {
  value: TSpec;
  wasFunction: boolean;
  meta?: VizStateMeta;
};

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

export interface UseVizMountOptions<TInstance, TSpec> {
  readonly adapter: VizAdapter<TInstance, TSpec>;
  readonly lib: VizLibraryTag;
  readonly initialSpec: InitialSpecResolver<TSpec>;
}

export interface UseVizMountResult<TInstance, TSpec> {
  readonly ref: (element: HTMLElement | null) => void;
  readonly elementRef: MutableRefObject<HTMLElement | null>;
  readonly instance: TInstance | null;
  readonly currentSpec: TSpec;
  readonly isReady: boolean;
  readonly discrete: boolean;
  readonly error: Error | null;
  readonly applyState: (next: TSpec | ((prev: TSpec) => TSpec), meta?: VizStateMeta) => void;
}

export function useVizMount<TInstance, TSpec>(
  options: UseVizMountOptions<TInstance, TSpec>,
): UseVizMountResult<TInstance, TSpec> {
  const { adapter, lib, initialSpec } = options;
  const prefersReducedMotion = usePrefersReducedMotion();
  const discreteRef = useRef(prefersReducedMotion);
  discreteRef.current = prefersReducedMotion;

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

  const applyToInstance = useCallback(
    (instance: TInstance, payload: PendingState<TSpec>) => {
      try {
        const discrete = discreteRef.current;
        if (payload.wasFunction) {
          const value = payload.value;
          adapter.applyState(instance, () => value, { discrete });
        } else {
          adapter.applyState(instance, payload.value, { discrete });
        }
        emitVizEvent("viz_state", {
          lib,
          discrete: discreteRef.current,
          stepId: payload.meta?.stepId,
          reason: payload.meta?.reason ?? "update",
        });
      } catch (err) {
        const nextError = asError(err);
        setError(nextError);
        emitVizEvent("viz_error", {
          lib,
          discrete: discreteRef.current,
          stepId: payload.meta?.stepId,
          reason: payload.meta?.reason ?? "apply",
          error: buildErrorMessage(err),
        });
      }
    },
    [adapter, lib],
  );

  const applyState = useCallback(
    (next: TSpec | ((prev: TSpec) => TSpec), meta?: VizStateMeta) => {
      const wasFunction = typeof next === "function";
      const value = wasFunction
        ? (next as (prev: TSpec) => TSpec)(specRef.current)
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
    if (!target) {
      return;
    }

    let cancelled = false;
    let mountedInstance: TInstance | null = null;

    const discrete = discreteRef.current;
    emitVizEvent("viz_init", { lib, discrete, reason: "mount" });

    const runMount = async () => {
      try {
        const result = await adapter.mount(target, specRef.current, { discrete });
        if (cancelled) {
          adapter.destroy(result);
          return;
        }
        mountedInstance = result;
        instanceRef.current = result;
        setIsReady(true);
        emitVizEvent("viz_ready", { lib, discrete: discreteRef.current });
        flushPendingStates(result);
      } catch (err) {
        const nextError = asError(err);
        setError(nextError);
        emitVizEvent("viz_error", {
          lib,
          discrete: discreteRef.current,
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
        try {
          adapter.destroy(instance);
        } catch (err) {
          emitVizEvent("viz_error", {
            lib,
            discrete: discreteRef.current,
            reason: "destroy",
            error: buildErrorMessage(err),
          });
        }
        if (instanceRef.current === instance) {
          instanceRef.current = null;
        }
      }
    };
  }, [adapter, element, flushPendingStates, lib]);

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
  }, [applyToInstance, prefersReducedMotion]);

  return useMemo(
    () => ({
      ref: mountRef,
      elementRef: elementStateRef as MutableRefObject<HTMLElement | null>,
      instance: instanceRef.current,
      currentSpec,
      isReady,
      discrete: prefersReducedMotion,
      error,
      applyState,
    }),
    [applyState, currentSpec, error, isReady, mountRef, prefersReducedMotion],
  );
}
