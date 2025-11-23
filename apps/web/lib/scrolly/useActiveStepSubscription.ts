"use client";

import { useContext, useEffect, useMemo, useRef } from "react";

import { ScrollyContext, type StepDefinition } from "./ScrollyContext";

export type ScrollyStepDirection = "forward" | "backward" | "initial";

export interface ScrollyStepChange {
  readonly stepId: string | null;
  readonly prevStepId: string | null;
  readonly index: number;
  readonly total: number;
  readonly direction: ScrollyStepDirection;
  readonly meta?: Record<string, unknown>;
}

export type SubscribeActiveStep = (callback: (step: ScrollyStepChange) => void) => () => void;

function getStepIndex(steps: StepDefinition[], id: string | null): number {
  if (!id) return -1;
  return steps.findIndex((step) => step.id === id);
}

function resolveDirection(
  currentId: string | null,
  prevId: string | null,
  steps: StepDefinition[],
): ScrollyStepDirection {
  if (!prevId) {
    return "initial";
  }

  const currentIndex = getStepIndex(steps, currentId);
  const prevIndex = getStepIndex(steps, prevId);

  if (currentIndex < 0 || prevIndex < 0) {
    return "initial";
  }

  return currentIndex >= prevIndex ? "forward" : "backward";
}

export function toScrollyStepChange(
  stepId: string | null,
  prevStepId: string | null,
  steps: StepDefinition[],
  meta?: Record<string, unknown>,
): ScrollyStepChange {
  const total = steps.length;
  const index = getStepIndex(steps, stepId);
  const direction = resolveDirection(stepId, prevStepId, steps);

  return { stepId, prevStepId, index, total, direction, ...(meta ? { meta } : {}) };
}

/**
 * Canonical subscription to the Scrolly (S6) active step stream.
 *
 * Consumers receive a `ScrollyStepChange` whenever the context's active step changes.
 */
export function useActiveStepSubscription(): SubscribeActiveStep | null {
  const scrolly = useContext(ScrollyContext);

  const listenersRef = useRef(new Set<(payload: ScrollyStepChange) => void>());
  const previousStepRef = useRef<string | null>(null);
  const stepsRef = useRef<StepDefinition[]>(scrolly?.steps ?? []);

  useEffect(() => {
    stepsRef.current = scrolly?.steps ?? [];
  }, [scrolly?.steps]);

  useEffect(() => {
    if (!scrolly) {
      return;
    }

    const stepId = scrolly.activeStepId ?? null;
    const payload = toScrollyStepChange(stepId, previousStepRef.current, stepsRef.current);
    previousStepRef.current = stepId;

    listenersRef.current.forEach((listener) => listener(payload));
  }, [scrolly?.activeStepId, scrolly]);

  return useMemo(() => {
    if (!scrolly) {
      return null;
    }

    return (callback: (step: ScrollyStepChange) => void) => {
      listenersRef.current.add(callback);

      const payload = toScrollyStepChange(
        scrolly.activeStepId ?? null,
        previousStepRef.current,
        stepsRef.current,
      );
      callback(payload);

      return () => listenersRef.current.delete(callback);
    };
  }, [scrolly]);
}
