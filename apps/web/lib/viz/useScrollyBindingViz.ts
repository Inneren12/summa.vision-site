"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { VizAdapter, VizAdapterLoader, VizLibraryTag } from "./types";
import type { UseVizMountResult } from "./useVizMount";
import { useVizMount } from "./useVizMount";

import { useScrollyContext } from "@/lib/scrolly/ScrollyContext";
import { type ScrollyBindingStatesMap, useScrollyBinding } from "@/lib/scrolly/useScrollyBinding";

export interface VizStateContext<TSpec> {
  readonly stepId: string;
  readonly previous: TSpec | null;
  readonly discrete: boolean;
}

export type VizStateProducer<TSpec> = TSpec | ((context: VizStateContext<TSpec>) => TSpec);

type AdapterSource<TInstance, TSpec extends object> =
  | VizAdapter<TInstance, TSpec>
  | VizAdapterLoader<TInstance, TSpec>;

export interface UseScrollyBindingVizOptions<TInstance, TSpec extends object> {
  readonly adapter: AdapterSource<TInstance, TSpec>;
  readonly lib: VizLibraryTag;
  readonly states: Record<string, VizStateProducer<TSpec>>;
  readonly initialStepId?: string | null;
}

export interface UseScrollyBindingVizResult<TInstance, TSpec extends object>
  extends Omit<UseVizMountResult<TInstance, TSpec>, "applyState"> {
  readonly activeStepId: string | null;
  readonly applyStepState: (stepId: string, options?: VizStepApplyOptions) => void;
}

export interface VizStepApplyOptions {
  readonly reason?: string;
  readonly force?: boolean;
  readonly discrete?: boolean;
}

function resolveState<TSpec>(
  producer: VizStateProducer<TSpec>,
  context: VizStateContext<TSpec>,
): TSpec {
  if (typeof producer === "function") {
    return (producer as (ctx: VizStateContext<TSpec>) => TSpec)(context);
  }
  return producer;
}

export function useScrollyBindingViz<TInstance, TSpec extends object>(
  options: UseScrollyBindingVizOptions<TInstance, TSpec>,
): UseScrollyBindingVizResult<TInstance, TSpec> {
  const { adapter, lib, states, initialStepId = null } = options;
  const entries = Object.entries(states);

  if (entries.length === 0) {
    throw new Error("useScrollyBindingViz requires at least one state definition");
  }

  const initialEntry = initialStepId
    ? (entries.find(([key]) => key === initialStepId) ?? entries[0])
    : entries[0];

  const [initialKey, initialProducer] = initialEntry;

  const { activeStepId: contextActiveStepId } = useScrollyContext();

  const viz = useVizMount<TInstance, TSpec>({
    adapter,
    lib,
    initialSpec: ({ discrete }) =>
      resolveState(initialProducer, {
        stepId: initialKey,
        discrete,
        previous: null,
      }),
  });

  const { applyState: applyVizState, discrete } = viz;
  const specRef = useRef(viz.currentSpec);
  specRef.current = viz.currentSpec;

  const [activeStepId, setActiveStepState] = useState<string | null>(initialKey ?? null);
  const appliedStepRef = useRef<string | null>(initialKey ?? null);

  const updateActiveStep = useCallback((next: string | null) => {
    appliedStepRef.current = next;
    setActiveStepState((prev) => {
      if (prev === next) {
        return prev;
      }
      return next;
    });
  }, []);

  const applyStepState = useCallback(
    (stepId: string, options: VizStepApplyOptions = {}) => {
      const producer = states[stepId];
      if (!producer) {
        return;
      }
      if (!options.force && appliedStepRef.current === stepId) {
        return;
      }
      const discreteValue = options.discrete ?? discrete;
      const nextState = resolveState(producer, {
        stepId,
        discrete: discreteValue,
        previous: specRef.current,
      });
      applyVizState(() => nextState, { stepId, reason: options.reason ?? "step" });
      updateActiveStep(stepId);
    },
    [applyVizState, discrete, states, updateActiveStep],
  );

  const bindingMap = useMemo<ScrollyBindingStatesMap>(() => {
    const map: ScrollyBindingStatesMap = {};
    for (const stepId of Object.keys(states)) {
      map[stepId] = ({ discrete: handlerDiscrete }) => {
        applyStepState(stepId, { discrete: handlerDiscrete });
      };
    }
    return map;
  }, [applyStepState, states]);

  useScrollyBinding(viz.elementRef, bindingMap);

  useEffect(() => {
    if (contextActiveStepId === undefined) {
      return;
    }
    if (contextActiveStepId === null) {
      updateActiveStep(null);
      return;
    }
    if (appliedStepRef.current === contextActiveStepId) {
      return;
    }
    applyStepState(contextActiveStepId);
  }, [applyStepState, contextActiveStepId, updateActiveStep]);

  return useMemo(
    () => ({
      ...viz,
      applyStepState,
      activeStepId,
    }),
    [activeStepId, applyStepState, viz],
  );
}
