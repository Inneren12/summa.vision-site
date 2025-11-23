"use client";

import { useCallback, useContext, useEffect, useRef } from "react";

import type { VizInstance } from "./types";

import { ScrollyContext } from "@/lib/scrolly/ScrollyContext";
import {
  toScrollyStepChange,
  useActiveStepSubscription,
  type ScrollyStepChange,
  type SubscribeActiveStep,
} from "@/lib/scrolly/useActiveStepSubscription";
export type {
  ScrollyStepChange,
  SubscribeActiveStep,
} from "@/lib/scrolly/useActiveStepSubscription";

export interface UseScrollyBindingVizOptions<S> {
  /**
   * Visualization instance returned from {@link useVizMount}.
   */
  readonly viz: VizInstance<S> | null | undefined;

  /**
   * Maps an S6 step change payload to a partial visualization state.
   * Returning `null` or `undefined` skips updates for that step.
   */
  readonly mapStepToState: (step: ScrollyStepChange) => Partial<S> | null | undefined;

  /** Optional debug label for console errors in development. */
  readonly debugLabel?: string;

  /**
   * Custom subscription to S6 active step events. When omitted, the hook subscribes to the
   * nearest {@link ScrollyContext} via {@link useActiveStepSubscription}.
   */
  readonly subscribeActiveStep?: SubscribeActiveStep | null;
}

function isPromise(value: unknown): value is Promise<unknown> {
  return Boolean(value) && typeof (value as Promise<unknown>).then === "function";
}

export function useScrollyBindingViz<S>(options: UseScrollyBindingVizOptions<S>): void {
  const { viz, mapStepToState, debugLabel, subscribeActiveStep } = options;

  const scrollyContext = useContext(ScrollyContext);
  const defaultSubscribe = useActiveStepSubscription();
  const subscription = subscribeActiveStep ?? defaultSubscribe;

  const vizRef = useRef<VizInstance<S> | null | undefined>(viz);
  const mapRef = useRef(options.mapStepToState);
  const prevStepRef = useRef<string | null>(null);
  const lastStepRef = useRef<ScrollyStepChange | null>(null);

  useEffect(() => {
    vizRef.current = viz;
  }, [viz]);

  useEffect(() => {
    mapRef.current = mapStepToState;
  }, [mapStepToState]);

  const handleStepChange = useCallback(
    async (step: ScrollyStepChange) => {
      const instance = vizRef.current;
      const mapper = mapRef.current;

      if (!instance || !instance.applyState || !mapper) {
        return;
      }

      const nextState = mapper(step);
      if (!nextState) {
        return;
      }

      try {
        const result = instance.applyState(nextState);
        if (isPromise(result)) {
          await result;
        }
      } catch (error) {
        if (process.env.NODE_ENV !== "production" && debugLabel) {
          // eslint-disable-next-line no-console
          console.error(`[useScrollyBindingViz:${debugLabel}] applyState failed`, error);
        }
      }
    },
    [debugLabel],
  );

  useEffect(() => {
    if (!subscription) {
      return undefined;
    }

    const unsubscribe = subscription((step) => {
      lastStepRef.current = step;
      prevStepRef.current = step.stepId;
      void handleStepChange(step);
    });

    return () => {
      unsubscribe?.();
    };
  }, [handleStepChange, subscription]);

  useEffect(() => {
    if (subscription || !scrollyContext) {
      return;
    }

    const { activeStepId = null, steps } = scrollyContext;
    const change = toScrollyStepChange(activeStepId ?? null, prevStepRef.current, steps);
    lastStepRef.current = change;
    prevStepRef.current = activeStepId ?? null;
    void handleStepChange(change);
  }, [handleStepChange, scrollyContext, subscription]);

  useEffect(() => {
    const instance = vizRef.current;
    if (!instance || !instance.applyState || !lastStepRef.current) {
      return;
    }

    void handleStepChange(lastStepRef.current);
  }, [handleStepChange, viz]);
}
