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
  cloneElement,
} from "react";

import { usePrefersReducedMotion } from "../motion/prefersReducedMotion";

import StickyPanel from "./StickyPanel";

export type StoryVisualizationApplyOptions = { discrete?: boolean };
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
};

const StoryContext = createContext<StoryContextValue | null>(null);
export function useStoryContext(): StoryContextValue {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error("useStoryContext must be used within <Story />");
  return ctx;
}

const isStickyPanel = (child: ReactElement) => child.type === StickyPanel;

export const STORY_VISUALIZATION_LAZY_ROOT_MARGIN = "25% 0px 25% 0px";

export type StoryProps = {
  stickyTop?: number | string;
  children: ReactNode;
  className?: string;
  onVisualizationPrefetch?: (signal: AbortSignal) => Promise<void> | void;
};

function classNames(...v: Array<string | undefined | false>): string {
  return v.filter(Boolean).join(" ");
}

export default function Story({
  children,
  stickyTop,
  className,
  onVisualizationPrefetch,
}: StoryProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const stepsRef = useRef(new Map<string, HTMLElement>());
  const orderedStepIdsRef = useRef<string[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const initialHashHandled = useRef(false);

  const prefersReducedMotion = usePrefersReducedMotion();
  const visualizationRef = useRef<StoryVisualizationController | null>(null);

  // ленивый маунт: изначально pending, после пересечения — mounted
  const [shouldRenderSticky, setShouldRenderSticky] = useState(false);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const hasPrefetchedRef = useRef(false);

  const setActiveStep = useCallback((stepId: string) => {
    setActiveStepId((cur) => (cur === stepId ? cur : stepId));
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
      const el = stepsRef.current.get(stepId);
      if (!el || !el.isConnected) return false;
      if (
        typeof el.focus === "function" &&
        (typeof document === "undefined" || document.activeElement !== el)
      ) {
        el.focus({ preventScroll: true });
      }
      setActiveStep(stepId);
      return true;
    },
    [setActiveStep],
  );

  const focusStepByIndex = useCallback(
    (index: number) => {
      if (index < 0) return false;
      const stepId = orderedStepIdsRef.current[index];
      if (!stepId) return false;
      return focusStep(stepId);
    },
    [focusStep],
  );

  const focusStepByOffset = useCallback(
    (currentStepId: string, offset: number) => {
      if (!currentStepId) return false;
      const index = orderedStepIdsRef.current.indexOf(currentStepId);
      if (index < 0) return false;
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
    if (initialHashHandled.current || typeof window === "undefined") return;
    const hash = window.location.hash.slice(1);
    if (!hash) return;
    if (focusStep(hash)) {
      initialHashHandled.current = true;
    }
  }, [focusStep]);

  const registerStep = useCallback(
    (id: string, el: HTMLElement) => {
      stepsRef.current.set(id, el);
      if (!orderedStepIdsRef.current.includes(id)) {
        orderedStepIdsRef.current.push(id);
      }
      handleInitialHash();
    },
    [handleInitialHash],
  );

  const unregisterStep = useCallback((id: string) => {
    stepsRef.current.delete(id);
    orderedStepIdsRef.current = orderedStepIdsRef.current.filter((x) => x !== id);
  }, []);

  // focus логика
  useEffect(() => {
    if (typeof window === "undefined" || !activeStepId) return;
    const el = stepsRef.current.get(activeStepId);
    if (!el || !el.isConnected) return;

    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active && active !== el && el.contains(active)) return;
      if (active === el) return;
    }
    if (typeof document === "undefined" || document.activeElement !== el) {
      el.focus({ preventScroll: true });
    }
  }, [activeStepId]);

  // stickyTop css var
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof window === "undefined") return;
    const updateVH = () => {
      const vh = window.visualViewport?.height ?? window.innerHeight;
      container.style.setProperty("--scrolly-viewport-height", `${vh}px`);
    };
    updateVH();
    window.addEventListener("resize", updateVH);
    window.addEventListener("orientationchange", updateVH);
    window.visualViewport?.addEventListener("resize", updateVH);
    return () => {
      window.removeEventListener("resize", updateVH);
      window.removeEventListener("orientationchange", updateVH);
      window.visualViewport?.removeEventListener("resize", updateVH);
    };
  }, []);

  // stickyTop var (offset)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (stickyTop == null) {
      container.style.removeProperty("--scrolly-sticky-top");
      return;
    }
    const value = typeof stickyTop === "number" ? `${stickyTop}px` : stickyTop;
    container.style.setProperty("--scrolly-sticky-top", value);
  }, [stickyTop]);

  // hash sync
  useEffect(() => {
    if (typeof window === "undefined" || !activeStepId) return;
    const hash = `#${activeStepId}`;
    if (window.location.hash !== hash) {
      window.history.replaceState(null, "", hash);
    }
  }, [activeStepId]);

  // apply visualization state
  useEffect(() => {
    if (!activeStepId) return;
    const controller = visualizationRef.current;
    if (!controller) return;
    controller.applyState(activeStepId, { discrete: prefersReducedMotion });
  }, [activeStepId, prefersReducedMotion]);

  const runPrefetch = useCallback(() => {
    if (!onVisualizationPrefetch || hasPrefetchedRef.current) {
      return;
    }

    const controller = new AbortController();
    prefetchAbortRef.current = controller;
    hasPrefetchedRef.current = true;

    Promise.resolve(onVisualizationPrefetch(controller.signal)).catch(() => {
      /* ignore */
    });
  }, [onVisualizationPrefetch]);

  useEffect(() => {
    return () => {
      prefetchAbortRef.current?.abort();
      prefetchAbortRef.current = null;
    };
  }, []);

  // Сентинел для ленивого маунта визуализации
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let mounted = false;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !mounted) {
            mounted = true;
            runPrefetch();
            setShouldRenderSticky(true);
            break;
          }
        }
      },
      { rootMargin: STORY_VISUALIZATION_LAZY_ROOT_MARGIN },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [runPrefetch]);

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
    }),
    [
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
    ],
  );

  const arr = Children.toArray(children) as ReactElement[];
  const stickyChild = arr.find((c) => isStickyPanel(c));
  const stepChildren = arr.filter((c) => !isStickyPanel(c));

  let stickyContent: ReactNode;
  if (stickyChild) {
    const stickyElement = stickyChild as ReactElement<
      Record<string, unknown> & { children?: ReactNode }
    >;
    stickyContent = cloneElement(stickyElement, {
      "data-scrolly-sticky-state": shouldRenderSticky ? "mounted" : "pending",
      children: shouldRenderSticky ? stickyElement.props.children : null,
    });
  } else {
    stickyContent = <div className="scrolly-sticky" aria-hidden="true" />;
  }

  return (
    <section ref={containerRef} className={classNames("scrolly", className)} data-scrolly>
      <div
        ref={sentinelRef}
        data-scrolly-viz-sentinel
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      />

      <StoryContext.Provider value={contextValue}>
        {stickyContent}
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
