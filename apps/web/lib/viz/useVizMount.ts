"use client";

// Client-only: this hook touches browser APIs and must stay out of server components.

import { useReducedMotion } from "@root/components/motion/useReducedMotion";
import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";

import type {
  VizAdapterLoader,
  VizAdapterWithConfig,
  VizEvent,
  VizEventDetail,
  VizInstance,
  VizLifecycleEvent,
  RegisterResizeObserver,
} from "./types";

import { sendVizAnalytics } from "@/lib/analytics/viz";
import type { VizAnalyticsContext } from "@/lib/analytics/vizTypes";
import { dispatchVizBrowserEvent } from "@/lib/viz/events";

const isBrowser = () => typeof window !== "undefined";

export type VizAdapterSource<S, Spec, Data> =
  | VizAdapterWithConfig<S, Spec, Data>
  | VizAdapterLoader<S, Spec, Data>;

function isLoader<S, Spec, Data>(
  value: VizAdapterSource<S, Spec, Data>,
): value is VizAdapterLoader<S, Spec, Data> {
  return typeof value === "function";
}

async function resolveAdapter<S, Spec, Data>(
  source: VizAdapterSource<S, Spec, Data>,
): Promise<VizAdapterWithConfig<S, Spec, Data>> {
  if (!isLoader(source)) {
    return source;
  }

  const maybeAdapter = source();
  return Promise.resolve(maybeAdapter);
}

export interface UseVizMountOptions<S, Spec, Data> {
  readonly adapter: VizAdapterSource<S, Spec, Data>;
  readonly spec?: Spec;
  readonly data?: Data;
  readonly initialState?: S;
  readonly discrete?: boolean;
  readonly enableResizeObserver?: boolean;
  readonly onEvent?: (event: VizLifecycleEvent) => void;
  readonly registerResizeObserver?: RegisterResizeObserver;
  readonly vizId?: string;
  readonly storyId?: string;
  readonly analyticsDisabled?: boolean;
}

export interface UseVizMountResult<S> {
  readonly ref: (element: HTMLElement | null) => void;
  readonly elementRef: MutableRefObject<HTMLElement | null>;
  readonly instance: VizInstance<S> | null;
  readonly mounted: boolean;
  readonly error: Error | null;
  readonly discrete: boolean;
}

function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  if (typeof value === "string") {
    return new Error(value);
  }

  return new Error("Unknown visualization error");
}

export function useVizMount<S = unknown, Spec = unknown, Data = unknown>(
  options: UseVizMountOptions<S, Spec, Data>,
): UseVizMountResult<S> {
  const {
    adapter: adapterSource,
    spec,
    data,
    initialState,
    onEvent,
    enableResizeObserver = true,
    registerResizeObserver: registerResizeObserverOption,
    vizId,
    storyId,
    analyticsDisabled = false,
  } = options;

  const { isReducedMotion } = useReducedMotion();
  const discrete = options.discrete ?? isReducedMotion;
  const elementRef = useRef<HTMLElement | null>(null);
  const [element, setElement] = useState<HTMLElement | null>(null);
  const instanceRef = useRef<VizInstance<S> | null>(null);
  const [instance, setInstance] = useState<VizInstance<S> | null>(null);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const observersRef = useRef<ResizeObserver[]>([]);

  const ref = useCallback((node: HTMLElement | null) => {
    elementRef.current = node;
    setElement(node);
  }, []);

  const adapterMemo = useMemo(() => adapterSource, [adapterSource]);
  const adapterId = useMemo(
    () => (adapterSource as { id?: string }).id ?? "unknown",
    [adapterSource],
  );

  const [analyticsContext, setAnalyticsContext] = useState<VizAnalyticsContext>(() => ({
    adapter: adapterId,
    vizId,
    storyId,
    discrete,
  }));

  const analyticsContextRef = useRef(analyticsContext);

  useEffect(() => {
    analyticsContextRef.current = analyticsContext;
  }, [analyticsContext]);

  useEffect(() => {
    setAnalyticsContext((prev) => {
      if (
        prev.adapter === adapterId &&
        prev.vizId === vizId &&
        prev.storyId === storyId &&
        prev.discrete === discrete
      ) {
        return prev;
      }

      return {
        ...prev,
        adapter: adapterId,
        vizId,
        storyId,
        discrete,
      };
    });
  }, [adapterId, discrete, storyId, vizId]);

  const handleVizEvent = useCallback(
    (event: VizEvent) => {
      dispatchVizBrowserEvent(event.type, event);
      onEvent?.(event);
      if (!analyticsDisabled) {
        void sendVizAnalytics(event, analyticsContextRef.current);
      }
    },
    [analyticsDisabled, onEvent],
  );

  useEffect(() => {
    if (!isBrowser() || !element) {
      return;
    }

    let cancelled = false;

    const forwardEvent = (event: VizLifecycleEvent) => {
      const detail: VizEventDetail = {
        motion: discrete ? "discrete" : "animated",
        ...(event.meta ?? {}),
      } as VizEventDetail;

      handleVizEvent({ ...event, meta: detail });
    };

    const registerResizeObserver =
      registerResizeObserverOption ??
      (enableResizeObserver
        ? (target: HTMLElement, callback: () => void) => {
            if (typeof ResizeObserver === "undefined") {
              return () => {};
            }

            const observer = new ResizeObserver(() => {
              callback();
            });
            observersRef.current.push(observer);
            observer.observe(target);
            return () => {
              observer.disconnect();
              observersRef.current = observersRef.current.filter((entry) => entry !== observer);
            };
          }
        : undefined);

    const handleError = (reason: string, err: unknown) => {
      const nextError = toError(err);
      setError(nextError);
      forwardEvent({
        type: "viz_error",
        ts: Date.now(),
        meta: {
          reason,
          message: nextError.message,
        },
      });
    };

    forwardEvent({
      type: "viz_init",
      ts: Date.now(),
      meta: {
        discrete,
      },
    });

    let currentInstance: VizInstance<S> | null = null;

    void resolveAdapter(adapterMemo)
      .then((adapter) => {
        if (cancelled) {
          return;
        }

        const resolvedAdapterId = (adapter as { id?: string }).id;
        if (resolvedAdapterId) {
          setAnalyticsContext((prev) => {
            if (prev.adapter === resolvedAdapterId) {
              return prev;
            }
            return { ...prev, adapter: resolvedAdapterId };
          });
        }

        return adapter.mount({
          el: element,
          spec,
          data,
          initialState,
          discrete,
          onEvent: forwardEvent,
          registerResizeObserver,
        });
      })
      .then((mountedInstance) => {
        if (!mountedInstance || cancelled) {
          return;
        }

        currentInstance = mountedInstance;
        instanceRef.current = mountedInstance;
        setInstance(mountedInstance);
        setMounted(true);
        setError(null);
        forwardEvent({
          type: "viz_ready",
          ts: Date.now(),
          meta: {
            discrete,
          },
        });
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        handleError("mount", err);
      });

    return () => {
      cancelled = true;
      observersRef.current.forEach((observer) => observer.disconnect());
      observersRef.current = [];
      setMounted(false);
      setInstance(null);
      const instanceToDestroy = currentInstance ?? instanceRef.current;
      instanceRef.current = null;
      if (instanceToDestroy) {
        Promise.resolve(instanceToDestroy.destroy())
          .catch((err) => {
            handleError("destroy", err);
          })
          .finally(() => {
            forwardEvent({
              type: "viz_state",
              ts: Date.now(),
              meta: {
                discrete,
                reason: "destroy",
              },
            });
          });
      }
    };
  }, [
    adapterMemo,
    data,
    discrete,
    element,
    enableResizeObserver,
    handleVizEvent,
    initialState,
    registerResizeObserverOption,
    spec,
  ]);

  return {
    ref,
    elementRef,
    instance,
    mounted,
    error,
    discrete,
  };
}
