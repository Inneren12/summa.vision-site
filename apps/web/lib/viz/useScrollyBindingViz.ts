"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { VizAdapter, VizLibraryTag } from "./types";
import type { UseVizMountResult } from "./useVizMount";
import { useVizMount } from "./useVizMount";

import { type ScrollyBindingStatesMap, useScrollyBinding } from "@/lib/scrolly/useScrollyBinding";

export interface VizStateContext<TSpec> {
  readonly stepId: string;
  readonly previous: TSpec | null;
  readonly discrete: boolean;
}

export type VizStateProducer<TSpec> = TSpec | ((context: VizStateContext<TSpec>) => TSpec);

export interface UseScrollyBindingVizOptions<TInstance, TSpec> {
  readonly adapter: VizAdapter<TInstance, TSpec>;
  readonly lib: VizLibraryTag;
  readonly states: Record<string, VizStateProducer<TSpec>>;
  readonly initialStepId?: string | null;
}

export interface UseScrollyBindingVizResult<TInstance, TSpec>
  extends Omit<UseVizMountResult<TInstance, TSpec>, "applyState"> {
  readonly activeStepId: string | null;
  readonly applyStepState: (stepId: string) => void;
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

export function useScrollyBindingViz<TInstance, TSpec>(
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

  const { applyState } = viz;
  const specRef = useRef(viz.currentSpec);
  specRef.current = viz.currentSpec;

  const [activeStepId, setActiveStepId] = useState<string | null>(initialKey ?? null);

  const applyStepState = useCallback(
    (stepId: string) => {
      const producer = states[stepId];
      if (!producer) {
        return;
      }
      const nextState = resolveState(producer, {
        stepId,
        discrete: viz.discrete,
        previous: specRef.current,
      });
      applyState(() => nextState, { stepId });
      setActiveStepId(stepId);
    },
    [applyState, states, viz.discrete],
  );

  const bindingMap = useMemo<ScrollyBindingStatesMap>(() => {
    const map: ScrollyBindingStatesMap = {};
    for (const [stepId, producer] of Object.entries(states)) {
      map[stepId] = ({ discrete }) => {
        const nextState = resolveState(producer, {
          stepId,
          discrete,
          previous: specRef.current,
        });
        applyState(() => nextState, { stepId });
        setActiveStepId(stepId);
      };
    }
    return map;
  }, [applyState, setActiveStepId, states]);

  useScrollyBinding(viz.elementRef, bindingMap);

  return useMemo(
    () => ({
      ...viz,
      applyStepState,
      activeStepId,
    }),
    [activeStepId, applyStepState, viz],
  );
}
