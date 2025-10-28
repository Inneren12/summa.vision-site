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
import { useStoryAnalytics } from "./useStoryAnalytics";

import { emitVizEvent } from "@/lib/analytics/send";
import useVisualViewportScale from "@/lib/viewport/useVisualViewportScale";
import { scaleRootMargin } from "@/lib/viewport/visualViewportScale";
import type { MotionMode, VizLibraryTag } from "@/lib/viz/types";

export type StoryVisualizationApplyOptions = { discrete?: boolean };
export type StoryVisualizationController = {
  applyState: (stepId: string, options?: StoryVisualizationApplyOptions) => void;
};

export type StoryProgressStep = {
  id: string;
  hash: string;
  label?: string;
};

type StoryContextValue = {
  activeStepId: string | null;
  setActiveStep: (stepId: string) => void;
  registerStep: (id: string, element: HTMLElement) => void;
  unregisterStep: (id: string) => void;
  updateStepMetadata: (id: string) => void;

  steps: StoryProgressStep[];

  registerVisualization: (controller: StoryVisualizationController | null) => void;
  prefersReducedMotion: boolean;

  focusStep: (stepId: string) => boolean;
  focusStepByOffset: (currentStepId: string, offset: number) => boolean;
  focusFirstStep: () => boolean;
  focusLastStep: () => boolean;

  trackShareClick: () => void;
  trackProgressRender: () => void;
  trackProgressClick: (stepId: string, stepIndex: number) => void;
};

const StoryContext = createContext<StoryContextValue | null>(null);
export function useStoryContext(): StoryContextValue {
  const ctx = useContext(StoryContext);
  if (!ctx) throw new Error("useStoryContext must be used within <Story />");
  return ctx;
}

const isStickyPanel = (child: ReactElement) => child.type === StickyPanel;

export const STORY_VISUALIZATION_LAZY_ROOT_MARGIN = "25% 0px 25% 0px";

const STEP_QUERY_PARAM = "step";
const STEP_HASH_PREFIX = "step-";
const URL_SYNC_THROTTLE_MS = 300;

type UrlSyncEventDetail = {
  stepId: string | null;
  delayMs: number;
  timestamp: string;
};

function emitUrlSyncThrottled(stepId: string | null, delayMs: number) {
  if (typeof window === "undefined") {
    return;
  }

  const event = new CustomEvent<UrlSyncEventDetail>("url_sync_throttled", {
    detail: {
      stepId,
      delayMs,
      timestamp: new Date().toISOString(),
    },
  });

  window.dispatchEvent(event);
}

function decodeStepToken(token: string | null): string | null {
  if (!token) {
    return null;
  }
  const trimmed = token.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

export type StoryProps = {
  stickyTop?: number | string;
  children: ReactNode;
  className?: string;
  onVisualizationPrefetch?: (signal: AbortSignal) => Promise<void> | void;
  storyId?: string;
  visualizationLib?: VizLibraryTag;
};

function classNames(...v: Array<string | undefined | false>): string {
  return v.filter(Boolean).join(" ");
}

export default function Story({
  children,
  stickyTop,
  className,
  onVisualizationPrefetch,
  storyId,
  visualizationLib,
}: StoryProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const stepsRef = useRef(new Map<string, HTMLElement>());
  const orderedStepIdsRef = useRef<string[]>([]);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [steps, setSteps] = useState<StoryProgressStep[]>([]);
  const initialHashHandled = useRef(false);
  const urlSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUrlSyncRef = useRef<number>(0);

  const prefersReducedMotion = usePrefersReducedMotion();
  const visualizationRef = useRef<StoryVisualizationController | null>(null);

  // ленивый маунт: изначально pending, после пересечения — mounted
  const [shouldRenderSticky, setShouldRenderSticky] = useState(false);
  const prefetchAbortRef = useRef<AbortController | null>(null);
  const hasPrefetchedRef = useRef(false);
  const hasLazyMountEventRef = useRef(false);
  const hasPrefetchEventRef = useRef(false);

  const viewportScale = useVisualViewportScale();
  const sentinelRootMargin = useMemo(
    () =>
      scaleRootMargin(STORY_VISUALIZATION_LAZY_ROOT_MARGIN, viewportScale) ??
      STORY_VISUALIZATION_LAZY_ROOT_MARGIN,
    [viewportScale],
  );

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

  const findStepFromToken = useCallback(
    (token: string): { id: string; element: HTMLElement } | null => {
      const normalized = token.trim();
      if (!normalized) {
        return null;
      }

      const direct = stepsRef.current.get(normalized);
      if (direct) {
        return { id: normalized, element: direct };
      }

      for (const [id, element] of stepsRef.current.entries()) {
        if (!element) {
          continue;
        }
        if (element.id === normalized) {
          return { id, element };
        }
        if (
          !normalized.startsWith(STEP_HASH_PREFIX) &&
          element.id === `${STEP_HASH_PREFIX}${normalized}`
        ) {
          return { id, element };
        }
      }

      return null;
    },
    [],
  );

  const scrollToStepElement = useCallback((element: HTMLElement) => {
    if (typeof element.scrollIntoView !== "function") {
      return;
    }
    try {
      element.scrollIntoView({ block: "start", behavior: "auto" });
    } catch {
      element.scrollIntoView();
    }
  }, []);

  const handleInitialHash = useCallback(() => {
    if (initialHashHandled.current || typeof window === "undefined") return;
    const searchParams = new URLSearchParams(window.location.search ?? "");
    const queryStep = decodeStepToken(searchParams.get(STEP_QUERY_PARAM));
    const rawHash = window.location.hash.slice(1);
    const decodedHash = decodeStepToken(rawHash);
    const prefixedHash = decodedHash?.startsWith(STEP_HASH_PREFIX) ? decodedHash : null;

    const candidates = [queryStep, prefixedHash, decodedHash].filter((value): value is string =>
      Boolean(value),
    );

    for (const candidate of candidates) {
      const match = findStepFromToken(candidate);
      if (!match) {
        continue;
      }
      initialHashHandled.current = true;
      scrollToStepElement(match.element);
      focusStep(match.id);
      break;
    }
  }, [findStepFromToken, focusStep, scrollToStepElement]);

  const syncSteps = useCallback(() => {
    setSteps(() => {
      const result: StoryProgressStep[] = [];
      for (const stepId of orderedStepIdsRef.current) {
        const element = stepsRef.current.get(stepId);
        if (!element) continue;
        const hash = element.id || stepId;
        let label = element.dataset.scrollyStepLabel?.trim();
        if (!label) {
          const ariaLabel = element.getAttribute("aria-label")?.trim();
          if (ariaLabel) {
            label = ariaLabel;
          } else {
            const labelledBy = element.getAttribute("aria-labelledby");
            if (labelledBy && typeof document !== "undefined") {
              const parts = labelledBy
                .split(" ")
                .map((token) => document.getElementById(token)?.textContent?.trim())
                .filter((value): value is string => Boolean(value));
              if (parts.length > 0) {
                label = parts.join(" ");
              }
            }
          }
        }
        result.push({ id: stepId, hash, label: label || undefined });
      }
      return result;
    });
  }, []);

  const registerStep = useCallback(
    (id: string, el: HTMLElement) => {
      stepsRef.current.set(id, el);
      if (!orderedStepIdsRef.current.includes(id)) {
        orderedStepIdsRef.current.push(id);
      }
      syncSteps();
      handleInitialHash();
    },
    [handleInitialHash, syncSteps],
  );

  const unregisterStep = useCallback(
    (id: string) => {
      stepsRef.current.delete(id);
      orderedStepIdsRef.current = orderedStepIdsRef.current.filter((x) => x !== id);
      syncSteps();
    },
    [syncSteps],
  );

  const updateStepMetadata = useCallback(
    (id: string) => {
      if (!stepsRef.current.has(id)) return;
      syncSteps();
    },
    [syncSteps],
  );

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

  // stickyTop var (offset)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (stickyTop == null) {
      container.style.removeProperty("--sticky-top");
      return;
    }
    const value = typeof stickyTop === "number" ? `${stickyTop}px` : stickyTop;
    container.style.setProperty("--sticky-top", value);
  }, [stickyTop]);

  // hash sync
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    if (!activeStepId) {
      return;
    }

    const targetHash = `#${activeStepId}`;
    if (window.location.hash === targetHash) {
      lastUrlSyncRef.current = Date.now();
      return;
    }

    const applySync = () => {
      if (window.location.hash !== targetHash) {
        window.history.replaceState(null, "", targetHash);
      }
      lastUrlSyncRef.current = Date.now();
    };

    const now = Date.now();
    const elapsed = now - lastUrlSyncRef.current;

    if (elapsed >= URL_SYNC_THROTTLE_MS) {
      applySync();
      return () => undefined;
    }

    const remaining = URL_SYNC_THROTTLE_MS - elapsed;
    if (urlSyncTimeoutRef.current) {
      clearTimeout(urlSyncTimeoutRef.current);
    }
    emitUrlSyncThrottled(activeStepId, remaining);
    urlSyncTimeoutRef.current = setTimeout(() => {
      urlSyncTimeoutRef.current = null;
      applySync();
    }, remaining);

    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current);
        urlSyncTimeoutRef.current = null;
      }
    };
  }, [activeStepId, emitUrlSyncThrottled]);

  // apply visualization state
  useEffect(() => {
    if (!activeStepId) return;
    const controller = visualizationRef.current;
    if (!controller) return;
    controller.applyState(activeStepId, { discrete: prefersReducedMotion });
  }, [activeStepId, prefersReducedMotion]);

  const emitStoryVizEvent = useCallback(
    (name: "viz_lazy_mount" | "viz_prefetch", reason: string) => {
      if (!visualizationLib) {
        return;
      }

      const motion: MotionMode = prefersReducedMotion ? "discrete" : "animated";
      emitVizEvent(name, {
        lib: visualizationLib,
        motion,
        storyId,
        reason,
      });
    },
    [prefersReducedMotion, storyId, visualizationLib],
  );

  const runPrefetch = useCallback(() => {
    if (!hasPrefetchEventRef.current) {
      hasPrefetchEventRef.current = true;
      emitStoryVizEvent("viz_prefetch", "sentinel");
    }

    if (!onVisualizationPrefetch || hasPrefetchedRef.current) {
      return;
    }

    const controller = new AbortController();
    prefetchAbortRef.current = controller;
    hasPrefetchedRef.current = true;

    Promise.resolve(onVisualizationPrefetch(controller.signal)).catch(() => {
      /* ignore */
    });
  }, [emitStoryVizEvent, onVisualizationPrefetch]);

  useEffect(() => {
    return () => {
      prefetchAbortRef.current?.abort();
      prefetchAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current);
        urlSyncTimeoutRef.current = null;
      }
    };
  }, []);

  // Сентинел для ленивого маунта визуализации
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    let mounted = shouldRenderSticky;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && !mounted) {
            mounted = true;
            if (!hasLazyMountEventRef.current) {
              hasLazyMountEventRef.current = true;
              emitStoryVizEvent("viz_lazy_mount", "sentinel");
            }
            runPrefetch();
            setShouldRenderSticky(true);
            break;
          }
        }
      },
      { rootMargin: sentinelRootMargin },
    );
    io.observe(el);
    return () => {
      io.disconnect();
    };
  }, [emitStoryVizEvent, runPrefetch, sentinelRootMargin, shouldRenderSticky]);

  const stepCount = steps.length;

  const {
    trackStoryView,
    handleStepChange,
    trackShareClick,
    trackProgressRender,
    trackProgressClick,
  } = useStoryAnalytics({ storyId, stepCount });

  useEffect(() => {
    trackStoryView();
  }, [trackStoryView]);

  useEffect(() => {
    const index = activeStepId ? steps.findIndex((step) => step.id === activeStepId) : -1;
    handleStepChange(activeStepId, index);
  }, [activeStepId, handleStepChange, steps]);

  const contextValue = useMemo<StoryContextValue>(
    () => ({
      activeStepId,
      setActiveStep,
      registerStep,
      unregisterStep,
      updateStepMetadata,

      steps,

      registerVisualization,
      prefersReducedMotion,

      focusStep,
      focusStepByOffset,
      focusFirstStep,
      focusLastStep,

      trackShareClick,
      trackProgressRender,
      trackProgressClick,
    }),
    [
      activeStepId,
      setActiveStep,
      registerStep,
      unregisterStep,
      updateStepMetadata,
      steps,
      registerVisualization,
      prefersReducedMotion,
      focusStep,
      focusStepByOffset,
      focusFirstStep,
      focusLastStep,
      trackShareClick,
      trackProgressRender,
      trackProgressClick,
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
