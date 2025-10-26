import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useScrollyContext, type StepDefinition } from "./ScrollyContext";

export type OnStepChange = (id: string, prevId: string | null) => void;
export type StepEventHandler = (id: string) => void;

export interface StepControllerOptions {
  readonly rootMargin?: string;
  readonly threshold?: number;
  readonly exitThreshold?: number;
  readonly onStepEnter?: StepEventHandler;
  readonly onStepExit?: StepEventHandler;
  readonly onStepChange?: OnStepChange;
}

const DEFAULT_THRESHOLD = 0.6;
const DEFAULT_EXIT_THRESHOLD = 0.2;

function buildElementMap(steps: StepDefinition[]): Map<HTMLElement, string> {
  const map = new Map<HTMLElement, string>();
  for (const step of steps) {
    if (step.element) {
      map.set(step.element, step.id);
    }
  }
  return map;
}

export function useStepController(options: StepControllerOptions = {}) {
  const { steps, activeStepId: contextActiveStepId, setActiveStepId } = useScrollyContext();

  const {
    rootMargin,
    threshold: thresholdOption,
    exitThreshold: exitThresholdOption,
    onStepEnter,
    onStepExit,
    onStepChange,
  } = options;

  const threshold = Math.min(Math.max(thresholdOption ?? DEFAULT_THRESHOLD, 0), 1);
  const exitThreshold = Math.max(
    Math.min(exitThresholdOption ?? DEFAULT_EXIT_THRESHOLD, threshold),
    0,
  );

  const elementMap = useMemo(() => buildElementMap(steps), [steps]);

  const initialActive = contextActiveStepId ?? null;
  const [activeStepId, setActiveStep] = useState<string | null>(initialActive);
  const activeRef = useRef<string | null>(initialActive);
  const initializedRef = useRef(initialActive !== null);
  const ratiosRef = useRef(new Map<string, number>());

  useEffect(() => {
    activeRef.current = activeStepId;
  }, [activeStepId]);

  useEffect(() => {
    if (contextActiveStepId === undefined || contextActiveStepId === null) {
      return;
    }
    if (contextActiveStepId === activeRef.current) {
      return;
    }
    activeRef.current = contextActiveStepId;
    setActiveStep(contextActiveStepId);
  }, [contextActiveStepId]);

  const emitChange = useCallback(
    (nextId: string, prevId: string | null) => {
      if (prevId && prevId !== nextId) {
        onStepExit?.(prevId);
      }
      if (nextId !== prevId) {
        onStepEnter?.(nextId);
        onStepChange?.(nextId, prevId);
      }
    },
    [onStepChange, onStepEnter, onStepExit],
  );

  const commitActive = useCallback(
    (nextId: string) => {
      setActiveStep((prev) => {
        if (prev === nextId) {
          return prev;
        }
        const prevId = prev ?? null;
        activeRef.current = nextId;
        emitChange(nextId, prevId);
        return nextId;
      });
    },
    [emitChange],
  );

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    if (steps.length === 0) {
      return;
    }
    const first = steps[0];
    if (!first) {
      return;
    }
    initializedRef.current = true;
    activeRef.current = first.id;
    setActiveStep(first.id);
    emitChange(first.id, null);
  }, [emitChange, steps]);

  useEffect(() => {
    const validIds = new Set(steps.map((step) => step.id));
    for (const id of ratiosRef.current.keys()) {
      if (!validIds.has(id)) {
        ratiosRef.current.delete(id);
      }
    }
  }, [steps]);

  const handleIntersect = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const ratios = ratiosRef.current;
      let candidateId: string | null = null;
      let candidateRatio = 0;

      for (const entry of entries) {
        const id = elementMap.get(entry.target as HTMLElement) ?? null;
        if (!id) {
          continue;
        }
        const ratio = entry.intersectionRatio ?? 0;
        ratios.set(id, ratio);
        if (ratio > candidateRatio) {
          candidateId = id;
          candidateRatio = ratio;
        }
      }

      const currentId = activeRef.current;

      if (candidateId && candidateRatio >= threshold) {
        if (candidateId !== currentId) {
          commitActive(candidateId);
        }
        return;
      }

      if (!currentId) {
        return;
      }

      const currentRatio = ratios.get(currentId) ?? 0;
      if (currentRatio >= exitThreshold) {
        return;
      }

      let fallbackId: string | null = null;
      let fallbackRatio = 0;
      for (const [id, ratio] of ratios.entries()) {
        if (id === currentId) {
          continue;
        }
        if (ratio > fallbackRatio) {
          fallbackId = id;
          fallbackRatio = ratio;
        }
      }

      if (fallbackId && fallbackRatio > 0 && fallbackId !== currentId) {
        commitActive(fallbackId);
      }
    },
    [commitActive, elementMap, exitThreshold, threshold],
  );

  useEffect(() => {
    if (activeStepId === contextActiveStepId) {
      return;
    }
    setActiveStepId(activeStepId ?? null);
  }, [activeStepId, contextActiveStepId, setActiveStepId]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    const observed = steps
      .map((step) => step.element)
      .filter((element): element is HTMLElement => Boolean(element));

    if (observed.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(handleIntersect, {
      root: null,
      rootMargin,
      threshold: [0, threshold],
    });

    for (const element of observed) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [handleIntersect, rootMargin, steps, threshold]);

  return { activeStepId } as const;
}
