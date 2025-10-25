import { useCallback, useEffect, useMemo, useRef } from "react";

import { useScrollyContext } from "./ScrollyContext";

const ENTER_THRESHOLD = 0.6;
const EXIT_THRESHOLD = 0.4;

interface StepSnapshot {
  id: string;
  element: HTMLElement;
  rect: DOMRectReadOnly;
  ratio: number;
}

export interface StepControllerOptions {
  readonly stickyTop?: number;
  readonly onStepEnter?: (stepId: string) => void;
  readonly onStepExit?: (stepId: string) => void;
  readonly onStepChange?: (stepId: string, previousStepId: string | null) => void;
}

export function useStepController({
  stickyTop = 0,
  onStepEnter,
  onStepExit,
  onStepChange,
}: StepControllerOptions = {}) {
  const { steps, activeStepId, setActiveStepId } = useScrollyContext();
  const activeStepRef = useRef<string | null>(activeStepId);
  const entriesRef = useRef<Map<Element, IntersectionObserverEntry>>(new Map());
  const rafRef = useRef<number | null>(null);

  activeStepRef.current = activeStepId;

  const computeVisibilityRatio = useCallback((rect: DOMRectReadOnly) => {
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;

    if (rect.height === 0 || viewportHeight === 0) {
      return 0;
    }

    const visibleTop = Math.max(rect.top, 0);
    const visibleBottom = Math.min(rect.bottom, viewportHeight);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    return visibleHeight / rect.height;
  }, []);

  const snapshots = useCallback((): StepSnapshot[] => {
    const snapshotList: StepSnapshot[] = [];

    for (const step of steps) {
      if (!step.element) {
        continue;
      }

      const entry = entriesRef.current.get(step.element);
      const rect = entry?.boundingClientRect ?? step.element.getBoundingClientRect();
      const ratio = Math.max(entry?.intersectionRatio ?? 0, computeVisibilityRatio(rect));

      snapshotList.push({
        id: step.id,
        element: step.element,
        rect,
        ratio,
      });
    }

    return snapshotList;
  }, [computeVisibilityRatio, steps]);

  const updateActiveStep = useCallback(
    (nextActiveStepId: string | null) => {
      const previousStepId = activeStepRef.current;

      if (previousStepId === nextActiveStepId) {
        return;
      }

      if (previousStepId && previousStepId !== nextActiveStepId) {
        onStepExit?.(previousStepId);
      }

      if (nextActiveStepId) {
        onStepEnter?.(nextActiveStepId);
      }

      if (nextActiveStepId !== previousStepId) {
        if (nextActiveStepId != null) { if (nextActiveStepId != null) { onStepChange?.(nextActiveStepId, previousStepId ?? null); } }
      }

      activeStepRef.current = nextActiveStepId;
      setActiveStepId(nextActiveStepId);
    },
    [onStepChange, onStepEnter, onStepExit, setActiveStepId],
  );

  const processEntries = useCallback(() => {
    rafRef.current = null;

    if (typeof window === "undefined") {
      return;
    }

    const currentSnapshots = snapshots();

    if (currentSnapshots.length === 0) {
      return;
    }

    const currentActiveId = activeStepRef.current;
    const currentActiveSnapshot = currentActiveId
      ? currentSnapshots.find((snapshot) => snapshot.id === currentActiveId)
      : undefined;

    if (currentActiveSnapshot && currentActiveSnapshot.ratio > EXIT_THRESHOLD) {
      return;
    }

    const fullyVisible = currentSnapshots
      .filter((snapshot) => snapshot.ratio >= ENTER_THRESHOLD)
      .sort((a, b) => {
        if (b.ratio !== a.ratio) {
          return b.ratio - a.ratio;
        }

        return a.rect.top - b.rect.top;
      });

    let nextActiveId: string | null = currentActiveId ?? null;

    if (fullyVisible.length > 0) {
      nextActiveId = fullyVisible[0].id;
    } else {
      const pivotTop = stickyTop;
      const passedSteps = currentSnapshots
        .filter((snapshot) => snapshot.rect.top <= pivotTop)
        .sort((a, b) => b.rect.top - a.rect.top);

      if (passedSteps.length > 0) {
        nextActiveId = passedSteps[0].id;
      } else {
        const sortedByTop = [...currentSnapshots].sort((a, b) => a.rect.top - b.rect.top);
        nextActiveId = sortedByTop[0]?.id ?? null;
      }
    }

    if (nextActiveId !== null) {
      updateActiveStep(nextActiveId);
    }
  }, [snapshots, stickyTop, updateActiveStep]);

  const scheduleProcess = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    rafRef.current = requestAnimationFrame(() => {
      processEntries();
    });
  }, [processEntries]);

  const observer = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          entriesRef.current.set(entry.target, entry);
        }

        scheduleProcess();
      },
      {
        threshold: [0, EXIT_THRESHOLD, ENTER_THRESHOLD, 1],
        rootMargin: `${-stickyTop}px 0px 0px 0px`,
      },
    );
  }, [scheduleProcess, stickyTop]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!observer) {
      return;
    }

    const observedElements = new Set<Element>();

    for (const step of steps) {
      if (!step.element) {
        continue;
      }

      observer.observe(step.element);
      observedElements.add(step.element);
    }

    scheduleProcess();

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      for (const element of observedElements) {
        observer.unobserve(element);
      }

      observer.disconnect();
      entriesRef.current.clear();
    };
  }, [observer, scheduleProcess, steps]);

  return {
    activeStepId,
  };
}
