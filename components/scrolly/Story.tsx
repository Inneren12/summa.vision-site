"use client";

import {
  Children,
  cloneElement,
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

import Progress from "./Progress";
import StickyPanel from "./StickyPanel";
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
  steps: StoryStepDescriptor[];
  setActiveStep: (stepId: string) => void;
  registerStep: (id: string, element: HTMLElement, metadata?: StoryStepMetadata) => void;
  unregisterStep: (id: string) => void;

  registerVisualization: (controller: StoryVisualizationController | null) => void;
  prefersReducedMotion: boolean;

  focusStep: (stepId: string) => boolean;
  focusStepByOffset: (currentStepId: string, offset: number) => boolean;
  focusFirstStep: () => boolean;
  focusLastStep: () => boolean;
  trackShareClick: () => void;
  trackProgressClick: (stepId: string, stepIndex: number) => void;
  trackProgressRender: () => void;
};

const StoryContext = createContext<StoryContextValue | null>(null);

export type StoryStepDescriptor = {
  id: string;
  anchorId: string;
  title?: string;
  index: number;
};

type StoryStepMetadata = {
  anchorId?: string;
  title?: string;
};

export function useStoryContext(): StoryContextValue {
  const context = useContext(StoryContext);

  if (!context) {
    throw new Error("useStoryContext must be used within a <Story /> component");
  }

  return context;
}

const isStickyPanel = (child: ReactElement) => child.type === StickyPanel;

export type StoryProps = {
  /**
   * Sticky top offset. Provide a pixel number or CSS length that matches the header height.
   */
  stickyTop?: number | string;
  storyId?: string;
  children: ReactNode;
  className?: string;
  onVisualizationPrefetch?: (signal: AbortSignal) => void | Promise<void>;
};

function classNames(...values: Array<string | undefined | false>): string {
  return values.filter(Boolean).join(" ");
}

export const STORY_VISUALIZATION_LAZY_ROOT_MARGIN = "25% 0px 0px 0px";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleAfterIdle(callback: () => void): () => void {
  if (typeof window === "undefined") {
    callback();
    return () => {};
  }

  const idleWindow = window as IdleWindow;

  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(() => {
      callback();
    });

    return () => {
      idleWindow.cancelIdleCallback?.(handle);
    };
  }

  const timeout = window.setTimeout(callback, 0);
  return () => {
    window.clearTimeout(timeout);
  };
}

export default function Story({
  children,
  stickyTop,
  className,
  storyId,
  onVisualizationPrefetch,
}: StoryProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const stepsRef = useRef(new Map<string, HTMLElement>());
  const stepMetadataRef = useRef(new Map<string, StoryStepMetadata>());
  const prefersReducedMotion = usePrefersReducedMotion();
  const visualizationRef = useRef<StoryVisualizationController | null>(null);
  const orderedStepIdsRef = useRef<string[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const initialHashHandled = useRef(false);
  const childArray = Children.toArray(children) as ReactElement[];
  const stickyChild = childArray.find((child) => isStickyPanel(child));
  const stepChildren = childArray.filter((child) => !isStickyPanel(child));
  const resolvedStepCount = stepChildren.length;
  const [stepCount, setStepCount] = useState(resolvedStepCount);
  const [steps, setSteps] = useState<StoryStepDescriptor[]>([]);
  const [shouldRenderSticky, setShouldRenderSticky] = useState(() => !stickyChild);
  const lazyMountTriggeredRef = useRef<boolean>(!stickyChild);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const {
    trackStoryView,
    handleStepChange,
    flush,
    trackShareClick,
    trackProgressClick,
    trackProgressRender,
  } = useStoryAnalytics({
    storyId,
    stepCount,
  });

  const setActiveStep = useCallback((stepId: string) => {
    setActiveStepId((current) => (current === stepId ? current : stepId));
  }, []);

  const commitSteps = useCallback(() => {
    setSteps(
      orderedStepIdsRef.current.map((stepId, index) => {
        const metadata = stepMetadataRef.current.get(stepId);

        return {
          id: stepId,
          anchorId: metadata?.anchorId ?? stepId,
          title: metadata?.title,
          index,
        } satisfies StoryStepDescriptor;
      }),
    );
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
    (id: string, element: HTMLElement, metadata: StoryStepMetadata = {}) => {
      stepsRef.current.set(id, element);
      stepMetadataRef.current.set(id, {
        anchorId: metadata.anchorId ?? id,
        title: metadata.title,
      });
      if (!orderedStepIdsRef.current.includes(id)) {
        orderedStepIdsRef.current.push(id);
      }
      handleInitialHash();
      commitSteps();
    },
    [commitSteps, handleInitialHash],
  );

  const unregisterStep = useCallback(
    (id: string) => {
      stepsRef.current.delete(id);
      stepMetadataRef.current.delete(id);
      orderedStepIdsRef.current = orderedStepIdsRef.current.filter((stepId) => stepId !== id);
      commitSteps();
    },
    [commitSteps],
  );

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
      steps,
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
      trackProgressClick,
      trackProgressRender,
    }),
    [
      activeStepId,
      steps,
      trackShareClick,
      trackProgressClick,
      trackProgressRender,
      focusFirstStep,
      focusLastStep,
      focusStep,
      focusStepByOffset,
      registerStep,
      unregisterStep,
      setActiveStep,
      registerVisualization,
      prefersReducedMotion,
    ],
  );

  useEffect(() => {
    setStepCount(resolvedStepCount);
  }, [resolvedStepCount]);

  useEffect(() => {
    if (!stickyChild) {
      setShouldRenderSticky(true);
      lazyMountTriggeredRef.current = true;
    }
  }, [stickyChild]);

  useEffect(() => {
    return () => {
      prefetchAbortRef.current?.abort();
      prefetchAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!stickyChild || shouldRenderSticky) {
      return;
    }

    let cancelPrefetchIdle: (() => void) | null = null;
    let cancelMountIdle: (() => void) | null = null;

    const beginPrefetch = () => {
      if (!onVisualizationPrefetch || prefetchAbortRef.current) {
        return;
      }

      try {
        const controller = new AbortController();
        prefetchAbortRef.current = controller;
        const result = onVisualizationPrefetch(controller.signal);
        if (typeof (result as Promise<unknown>)?.then === "function") {
          (result as Promise<unknown>).finally(() => {
            if (prefetchAbortRef.current === controller) {
              prefetchAbortRef.current = null;
            }
          });
        } else if (prefetchAbortRef.current === controller) {
          prefetchAbortRef.current = null;
        }
      } catch {
        prefetchAbortRef.current = null;
      }
    };

    const triggerLazyMount = () => {
      if (lazyMountTriggeredRef.current) {
        return;
      }

      lazyMountTriggeredRef.current = true;

      if (onVisualizationPrefetch) {
        cancelPrefetchIdle?.();
        cancelPrefetchIdle = scheduleAfterIdle(beginPrefetch);
      }

      cancelMountIdle?.();
      cancelMountIdle = scheduleAfterIdle(() => {
        setShouldRenderSticky(true);
      });
    };

    if (typeof window === "undefined") {
      triggerLazyMount();
      return () => {
        cancelPrefetchIdle?.();
        cancelMountIdle?.();
      };
    }

    const sentinel = sentinelRef.current ?? containerRef.current;
    if (!sentinel) {
      triggerLazyMount();
      return () => {
        cancelPrefetchIdle?.();
        cancelMountIdle?.();
      };
    }

    if (typeof IntersectionObserver === "undefined") {
      triggerLazyMount();
      return () => {
        cancelPrefetchIdle?.();
        cancelMountIdle?.();
      };
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.disconnect();
            triggerLazyMount();
          }
        });
      },
      {
        rootMargin: STORY_VISUALIZATION_LAZY_ROOT_MARGIN,
        threshold: 0,
      },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
      cancelPrefetchIdle?.();
      cancelMountIdle?.();
    };
  }, [shouldRenderSticky, stickyChild, onVisualizationPrefetch]);

  return (
    <section ref={containerRef} className={classNames("scrolly", className)} data-scrolly>
      <StoryContext.Provider value={contextValue}>
        {stickyChild ? (
          <>
            <div ref={sentinelRef} aria-hidden="true" className="scrolly-visualization-sentinel" />
            {cloneElement(stickyChild, {
              children: shouldRenderSticky ? stickyChild.props.children : null,
              "data-scrolly-sticky-state": shouldRenderSticky ? "mounted" : "pending",
            })}
          </>
        ) : (
          <div className="scrolly-sticky" aria-hidden="true" />
        )}
        <Progress />
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
