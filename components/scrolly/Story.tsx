"use client";

import {
  Children,
  createContext,
  type ReactElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { usePrefersReducedMotion } from "../motion/prefersReducedMotion";

import StickyPanel from "./StickyPanel";
import { scheduleIdle } from "./scheduleIdle";
import { useStoryAnalytics } from "./useStoryAnalytics";

export type StoryVisualizationApplyOptions = {
  /**
   * Indicates that the update must be discrete (no interpolated animation).
   */
  discrete?: boolean;
};

export type StoryVisualizationController = {
  applyState: (stepId: string, options?: StoryVisualizationApplyOptions) => void;
};

type StoryContextValue = {
  activeStepId: string | null;
  setActiveStep: (stepId: string) => void;
  registerStep: (id: string, element: HTMLElement) => void;
  unregisterStep: (id: string) => void;

  registerVisualization: (controller: StoryVisualizationController | null) => void;
  prefersReducedMotion: boolean;

  focusStep: (stepId: string) => boolean;
  focusStepByOffset: (currentStepId: string, offset: number) => boolean;
  focusFirstStep: () => boolean;
  focusLastStep: () => boolean;
  trackShareClick: () => void;
};

const StoryContext = createContext<StoryContextValue | null>(null);

export function useStoryContext(): StoryContextValue {
  const context = useContext(StoryContext);

  if (!context) {
    throw new Error("useStoryContext must be used within a <Story /> component");
  }

  return context;
}

const isStickyPanel = (child: ReactElement) => child.type === StickyPanel;

export type StoryPrefetchRequest = {
  url: string;
  options?: RequestInit;
};

export type StoryProps = {
  /**
   * Sticky top offset. Provide a pixel number or CSS length that matches the header height.
   */
  stickyTop?: number | string;
  storyId?: string;
  children: ReactNode;
  className?: string;
  prefetchRequests?: StoryPrefetchRequest[];
};

function classNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export default function Story({
  children,
  stickyTop,
  className,
  storyId,
  prefetchRequests,
}: StoryProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const stepsRef = useRef(new Map<string, HTMLElement>());
  const prefersReducedMotion = usePrefersReducedMotion();
  const visualizationRef = useRef<StoryVisualizationController | null>(null);
  const orderedStepIdsRef = useRef<string[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const lazyObserverRef = useRef<IntersectionObserver | null>(null);
  const prefetchControllerRef = useRef<AbortController | null>(null);
  const prefetchRequestedRef = useRef(false);
  const initialHashHandled = useRef(false);
  const childArray = Children.toArray(children) as ReactElement[];
  const stickyChild = childArray.find((child) => isStickyPanel(child));
  const stepChildren = childArray.filter((child) => !isStickyPanel(child));
  const resolvedStepCount = stepChildren.length;
  const hasStickyChild = Boolean(stickyChild);
  const [isStickyMounted, setIsStickyMounted] = useState(() => !hasStickyChild);
  const [stepCount, setStepCount] = useState(resolvedStepCount);
  const { trackStoryView, handleStepChange, flush, trackShareClick } = useStoryAnalytics({
    storyId,
    stepCount,
  });

  const setActiveStep = useCallback((stepId: string) => {
    setActiveStepId((current) => (current === stepId ? current : stepId));
  }, []);

  const registerVisualization = useCallback(
    (controller: StoryVisualizationController | null) => {
      visualizationRef.current = controller;
      if (controller && activeStepId) {
        controller.applyState(activeStepId, { discrete: prefersReducedMotion });
      }
    },
    [activeStepId, prefersReducedMotion],
  );

  const focusStep = useCallback(
    (stepId: string) => {
      const element = stepsRef.current.get(stepId);
      if (!element || !element.isConnected) {
        return false;
      }

      if (
        typeof element.focus === "function" &&
        (typeof document === "undefined" || document.activeElement !== element)
      ) {
        element.focus({ preventScroll: true });
      }

      setActiveStep(stepId);
      return true;
    },
    [setActiveStep],
  );

  const focusStepByIndex = useCallback(
    (index: number) => {
      if (index < 0) {
        return false;
      }

      const stepId = orderedStepIdsRef.current[index];
      if (!stepId) {
        return false;
      }

      return focusStep(stepId);
    },
    [focusStep],
  );

  const focusStepByOffset = useCallback(
    (currentStepId: string, offset: number) => {
      if (!currentStepId) {
        return false;
      }

      const index = orderedStepIdsRef.current.indexOf(currentStepId);
      if (index < 0) {
        return false;
      }

      return focusStepByIndex(index + offset);
    },
    [focusStepByIndex],
  );

  const focusFirstStep = useCallback(() => focusStepByIndex(0), [focusStepByIndex]);

  const focusLastStep = useCallback(
    () => focusStepByIndex(orderedStepIdsRef.current.length - 1),
    [focusStepByIndex],
  );

  const runPrefetch = useCallback(() => {
    if (
      prefetchRequestedRef.current ||
      !prefetchRequests ||
      prefetchRequests.length === 0 ||
      typeof fetch !== "function"
    ) {
      return;
    }

    prefetchRequestedRef.current = true;

    const controller = new AbortController();
    prefetchControllerRef.current = controller;
    let remaining = prefetchRequests.length;

    for (const request of prefetchRequests) {
      const { url, options } = request;
      if (!url) {
        remaining -= 1;
        continue;
      }

      const { signal, ...rest } = options ?? {};
      const init: RequestInit = {
        method: "GET",
        ...rest,
        signal: signal ?? controller.signal,
      };

      try {
        void fetch(url, init)
          .catch(() => undefined)
          .finally(() => {
            remaining -= 1;
            if (remaining <= 0 && prefetchControllerRef.current === controller) {
              prefetchControllerRef.current = null;
            }
          });
      } catch {
        remaining -= 1;
      }
    }
  }, [prefetchRequests]);

  useEffect(() => {
    return () => {
      lazyObserverRef.current?.disconnect();
      lazyObserverRef.current = null;
      prefetchControllerRef.current?.abort();
      prefetchControllerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!hasStickyChild || isStickyMounted) {
      return;
    }

    if (typeof window === "undefined") {
      setIsStickyMounted(true);
      return;
    }

    const sentinel = sentinelRef.current;

    if (!sentinel) {
      setIsStickyMounted(true);
      return;
    }

    if (typeof IntersectionObserver === "undefined") {
      scheduleIdle(() => {
        setIsStickyMounted(true);
      });
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
    const topMargin = Math.round(viewportHeight * 0.6);
    const bottomMargin = Math.round(viewportHeight * 0.2);
    let cancelIdle: (() => void) | null = null;

    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries.some(
          (entry) => entry.isIntersecting || entry.intersectionRatio > 0,
        );

        if (!isVisible) {
          return;
        }

        observer.disconnect();
        lazyObserverRef.current = null;

        runPrefetch();

        cancelIdle = scheduleIdle(() => {
          setIsStickyMounted(true);
        });
      },
      {
        rootMargin: `${topMargin}px 0px ${bottomMargin}px 0px`,
        threshold: [0, 0.01],
      },
    );

    observer.observe(sentinel);
    lazyObserverRef.current = observer;

    return () => {
      observer.disconnect();
      lazyObserverRef.current = null;
      cancelIdle?.();
      cancelIdle = null;
    };
  }, [hasStickyChild, isStickyMounted, runPrefetch]);

  const handleInitialHash = useCallback(() => {
    if (initialHashHandled.current || typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash.slice(1);
    if (!hash) {
      return;
    }

    const didFocus = focusStep(hash);
    if (didFocus) {
      initialHashHandled.current = true;
    }
  }, [focusStep]);

  const registerStep = useCallback(
    (id: string, element: HTMLElement) => {
      stepsRef.current.set(id, element);
      if (!orderedStepIdsRef.current.includes(id)) {
        orderedStepIdsRef.current.push(id);
      }
      handleInitialHash();
    },
    [handleInitialHash],
  );

  const unregisterStep = useCallback((id: string) => {
    stepsRef.current.delete(id);
    orderedStepIdsRef.current = orderedStepIdsRef.current.filter((stepId) => stepId !== id);
  }, []);

  useEffect(() => {
    trackStoryView();
  }, [trackStoryView]);

  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  useEffect(() => {
    const index = activeStepId ? orderedStepIdsRef.current.indexOf(activeStepId) : -1;
    handleStepChange(activeStepId, index);
  }, [activeStepId, handleStepChange]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeStepId) {
      return;
    }

    const element = stepsRef.current.get(activeStepId);
    if (!element || !element.isConnected) {
      return;
    }

    if (typeof document !== "undefined") {
      const activeElement = document.activeElement;

      if (activeElement && activeElement !== element && element.contains(activeElement)) {
        return;
      }

      if (activeElement === element) {
        return;
      }
    }

    if (typeof document === "undefined" || document.activeElement !== element) {
      element.focus({ preventScroll: true });
    }
  }, [activeStepId]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") {
      return;
    }

    const updateViewportHeight = () => {
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      container.style.setProperty("--scrolly-viewport-height", `${viewportHeight}px`);
    };

    updateViewportHeight();

    window.addEventListener("resize", updateViewportHeight);
    window.addEventListener("orientationchange", updateViewportHeight);
    window.visualViewport?.addEventListener("resize", updateViewportHeight);

    return () => {
      window.removeEventListener("resize", updateViewportHeight);
      window.removeEventListener("orientationchange", updateViewportHeight);
      window.visualViewport?.removeEventListener("resize", updateViewportHeight);
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    if (stickyTop == null) {
      container.style.removeProperty("--scrolly-sticky-top");
      return;
    }

    const value = typeof stickyTop === "number" ? `${stickyTop}px` : stickyTop;
    container.style.setProperty("--scrolly-sticky-top", value);
  }, [stickyTop]);

  useEffect(() => {
    if (typeof window === "undefined" || !activeStepId) {
      return;
    }

    const hash = `#${activeStepId}`;

    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }, [activeStepId]);

  useEffect(() => {
    if (!activeStepId) {
      return;
    }

    const controller = visualizationRef.current;
    if (!controller) {
      return;
    }

    controller.applyState(activeStepId, { discrete: prefersReducedMotion });
  }, [activeStepId, prefersReducedMotion]);

  const contextValue = useMemo<StoryContextValue>(
    () => ({
      activeStepId,
      setActiveStep,
      registerStep,
      unregisterStep,

      registerVisualization,
      prefersReducedMotion,

      focusStep,
      focusStepByOffset,
      focusFirstStep,
      focusLastStep,
      trackShareClick,
    }),
    [
      activeStepId,
      trackShareClick,
      focusFirstStep,
      focusLastStep,
      focusStep,
      focusStepByOffset,
      registerStep,
      setActiveStep,
      registerStep,
      unregisterStep,

      registerVisualization,
      prefersReducedMotion,

      focusStep,
      focusStepByOffset,
      focusFirstStep,
      focusLastStep,
    ],
  );

  useEffect(() => {
    setStepCount(resolvedStepCount);
  }, [resolvedStepCount]);

  useEffect(() => {
    prefetchRequestedRef.current = false;
    if (!prefetchRequests || prefetchRequests.length === 0) {
      prefetchControllerRef.current?.abort();
      prefetchControllerRef.current = null;
    }
  }, [prefetchRequests]);

  return (
    <section ref={containerRef} className={classNames("scrolly", className)} data-scrolly>
      <StoryContext.Provider value={contextValue}>
        {hasStickyChild ? (
          <>
            <div ref={sentinelRef} data-scrolly-lazy-sentinel aria-hidden="true" />
            {isStickyMounted ? (
              stickyChild
            ) : (
              <div
                className="scrolly-sticky"
                aria-hidden="true"
                data-scrolly-sticky-placeholder
                data-placeholder="true"
              />
            )}
          </>
        ) : (
          (stickyChild ?? <div className="scrolly-sticky" aria-hidden="true" />)
        )}
        <div className="scrolly-steps">{stepChildren}</div>
      </StoryContext.Provider>
    </section>
  );
}

export function useStoryVisualization(controller: StoryVisualizationController | null): {
  prefersReducedMotion: boolean;
} {
  const { registerVisualization, prefersReducedMotion } = useStoryContext();

  useEffect(() => {
    registerVisualization(controller);
    return () => {
      registerVisualization(null);
    };
  }, [controller, registerVisualization]);

  return { prefersReducedMotion };
}
