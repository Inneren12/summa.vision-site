"use client";

import { useEffect, useMemo, useState } from "react";

import { emitVizEvent, emitVizLifecycleEvent } from "../analytics/send";

import type { VizEventDetail, VizInstance, VizLifecycleEvent } from "./types";
import { type UseVizMountOptions, type UseVizMountResult, useVizMount } from "./useVizMount";

export interface VizStepState<S> {
  readonly id: string | null;
  readonly state: Partial<S>;
}

export type SubscribeActiveStep = (callback: (stepId: string | null) => void) => () => void;

export interface UseScrollyBindingVizOptions<S, Spec, Data>
  extends Omit<UseVizMountOptions<S, Spec, Data>, "onEvent"> {
  readonly steps: ReadonlyArray<VizStepState<S>>;
  readonly initialStepId?: string | null;
  readonly activeStepId?: string | null;
  readonly subscribeActiveStep?: SubscribeActiveStep;
  readonly onEvent?: (event: VizLifecycleEvent) => void;
}

export interface UseScrollyBindingVizResult<S> extends UseVizMountResult<S> {
  readonly activeStepId: string | null;
}

function applyStepState<S>(instance: VizInstance<S>, state: Partial<S>): void {
  const applyState = instance.applyState;
  if (!applyState) {
    return;
  }

  const result = applyState(state);
  if (result && typeof (result as Promise<void>).then === "function") {
    void (result as Promise<void>).catch(() => {});
  }
}

export function useScrollyBindingViz<S = unknown, Spec = unknown, Data = unknown>(
  options: UseScrollyBindingVizOptions<S, Spec, Data>,
): UseScrollyBindingVizResult<S> {
  const {
    steps,
    initialStepId = null,
    activeStepId,
    subscribeActiveStep,
    onEvent,
    ...vizOptions
  } = options;

  const stepMap = useMemo(() => {
    const map = new Map<string | null, Partial<S>>();
    for (const step of steps) {
      map.set(step.id ?? null, step.state);
    }
    return map;
  }, [steps]);

  const [currentStepId, setCurrentStepId] = useState<string | null>(
    activeStepId ?? initialStepId ?? null,
  );

  useEffect(() => {
    if (typeof activeStepId === "undefined") {
      return;
    }
    setCurrentStepId(activeStepId ?? null);
  }, [activeStepId]);

  useEffect(() => {
    if (!subscribeActiveStep) {
      return;
    }

    return subscribeActiveStep((stepId) => {
      setCurrentStepId(stepId ?? null);
    });
  }, [subscribeActiveStep]);

  const viz = useVizMount<S, Spec, Data>({
    ...vizOptions,
    onEvent,
  });

  useEffect(() => {
    const instance = viz.instance;
    if (!instance) {
      return;
    }

    const state = stepMap.get(currentStepId ?? null);
    if (!state) {
      return;
    }

    applyStepState(instance, state);
    const event: VizLifecycleEvent = {
      type: "viz_state",
      ts: Date.now(),
      meta: {
        stepId: currentStepId ?? undefined,
      },
    };
    onEvent?.(event);
    const detail: VizEventDetail = {
      motion: viz.discrete ? "discrete" : "animated",
      ...(event.meta ?? {}),
    } as VizEventDetail;
    emitVizEvent(event.type, detail);
    emitVizLifecycleEvent(event);
  }, [currentStepId, onEvent, stepMap, viz.discrete, viz.instance]);

  return useMemo(
    () => ({
      ...viz,
      activeStepId: currentStepId,
    }),
    [currentStepId, viz],
  );
}
