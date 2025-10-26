import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useScrollyContext, type StepDefinition } from "./ScrollyContext";

import useVisualViewportScale from "@/lib/viewport/useVisualViewportScale";
import { scaleRootMargin } from "@/lib/viewport/visualViewportScale";

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
const STEP_QUERY_PARAM = "step";
const STEP_HASH_PREFIX = "step-";
const URL_SYNC_THROTTLE_MS = 300;

type TimeoutHandle = ReturnType<typeof setTimeout>;

type StepLocationSource = "hash" | "query" | null;

function decodeStepToken(token: string | null | undefined): string | null {
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

function findStepFromToken(steps: StepDefinition[], token: string): StepDefinition | null {
  const normalized = token.trim();
  if (!normalized) {
    return null;
  }

  for (const step of steps) {
    if (step.id === normalized) {
      return step;
    }
  }

  const maybeStripped = normalized.startsWith(STEP_HASH_PREFIX)
    ? normalized.slice(STEP_HASH_PREFIX.length)
    : normalized;

  for (const step of steps) {
    if (step.id === maybeStripped) {
      return step;
    }
  }

  for (const step of steps) {
    const element = step.element;
    if (!element) {
      continue;
    }
    if (element.id === normalized) {
      return step;
    }
    if (
      !normalized.startsWith(STEP_HASH_PREFIX) &&
      element.id === `${STEP_HASH_PREFIX}${normalized}`
    ) {
      return step;
    }
  }

  return null;
}

function isFinitePositive(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function getViewportHeight(viewportScale?: number): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const baseHeight = window.innerHeight || document.documentElement?.clientHeight || 0;
  const visualViewport = window.visualViewport;

  if (!visualViewport) {
    return baseHeight;
  }

  const visualHeight = visualViewport.height;
  if (isFinitePositive(visualHeight)) {
    return visualHeight;
  }

  const scaleCandidate = isFinitePositive(viewportScale)
    ? viewportScale
    : isFinitePositive(visualViewport.scale)
      ? visualViewport.scale
      : undefined;

  if (isFinitePositive(scaleCandidate) && baseHeight > 0) {
    return baseHeight / scaleCandidate;
  }

  return baseHeight;
}

function getScrollMarginTop(element: HTMLElement): number {
  if (typeof window === "undefined" || typeof window.getComputedStyle !== "function") {
    return 0;
  }

  try {
    const computed = window.getComputedStyle(element);
    const marginTopRaw = computed.scrollMarginTop || computed.scrollMarginBlockStart || "0";
    const parsed = Number.parseFloat(marginTopRaw);
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function scrollElementIntoViewWithMargin(element: HTMLElement): void {
  if (typeof window === "undefined" || typeof window.scrollTo !== "function") {
    return;
  }
  if (!element.isConnected) {
    return;
  }

  const rect = element.getBoundingClientRect();
  const scrollTop =
    window.scrollY ?? window.pageYOffset ?? document.documentElement?.scrollTop ?? 0;
  const offset = getScrollMarginTop(element);
  const targetTop = scrollTop + rect.top - offset;

  try {
    window.scrollTo({ top: targetTop, behavior: "auto" });
  } catch {
    window.scrollTo(0, targetTop);
  }
}

function resolveInitialUrlMode(location: Location): StepLocationSource {
  const rawHash = location.hash ?? "";
  const cleanedHash = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
  const decodedHash = decodeStepToken(cleanedHash);
  if (decodedHash && decodedHash.startsWith(STEP_HASH_PREFIX)) {
    return "hash";
  }

  const search = location.search ?? "";
  if (!search) {
    return null;
  }

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  if (params.has(STEP_QUERY_PARAM)) {
    return "query";
  }

  return null;
}

interface InitialStepMatch {
  readonly step: StepDefinition;
  readonly source: Exclude<StepLocationSource, null>;
}

function findInitialStepFromLocation(steps: StepDefinition[]): InitialStepMatch | null {
  if (typeof window === "undefined") {
    return null;
  }

  const { hash, search } = window.location;
  const rawHash = hash?.startsWith("#") ? hash.slice(1) : (hash ?? "");
  const decodedHash = decodeStepToken(rawHash);
  const prefixedHash = decodedHash?.startsWith(STEP_HASH_PREFIX) ? decodedHash : null;

  const params = new URLSearchParams(search ?? "");
  const queryToken = decodeStepToken(params.get(STEP_QUERY_PARAM));

  const candidates: Array<{ token: string; source: Exclude<StepLocationSource, null> }> = [];

  if (prefixedHash) {
    candidates.push({ token: prefixedHash, source: "hash" });
  }

  if (decodedHash && decodedHash !== prefixedHash) {
    candidates.push({ token: decodedHash, source: "hash" });
  }

  if (queryToken) {
    candidates.push({ token: queryToken, source: "query" });
  }

  for (const candidate of candidates) {
    const match = findStepFromToken(steps, candidate.token);
    if (match) {
      return { step: match, source: candidate.source };
    }
  }

  return null;
}

function measureStepVisibility(
  step: StepDefinition,
  viewportHeight: number,
): { ratio: number; top: number } {
  const element = step.element;
  if (!element) {
    return { ratio: 0, top: Number.POSITIVE_INFINITY };
  }

  const rect = element.getBoundingClientRect();
  const height = rect.height || element.offsetHeight || 0;
  if (height <= 0 || viewportHeight <= 0) {
    return { ratio: 0, top: rect.top };
  }

  const viewportTop = 0;
  const viewportBottom = viewportTop + viewportHeight;
  const intersectionTop = Math.max(rect.top, viewportTop);
  const intersectionBottom = Math.min(rect.bottom, viewportBottom);
  const visible = Math.max(0, intersectionBottom - intersectionTop);
  const ratio = Math.max(0, Math.min(1, visible / height));

  return { ratio, top: rect.top };
}

function emitUrlSyncThrottled(stepId: string | null, delayMs: number) {
  if (typeof window === "undefined") {
    return;
  }

  const event = new CustomEvent("url_sync_throttled", {
    detail: {
      stepId,
      delayMs,
      timestamp: new Date().toISOString(),
    },
  });

  window.dispatchEvent(event);
}

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

  const viewportScale = useVisualViewportScale();
  const resolvedRootMargin = useMemo(
    () => (rootMargin ? (scaleRootMargin(rootMargin, viewportScale) ?? rootMargin) : undefined),
    [rootMargin, viewportScale],
  );

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
  const initialStepCleanupRef = useRef<(() => void) | null>(null);
  const ratiosRef = useRef(new Map<string, number>());
  const urlModeRef = useRef<Exclude<StepLocationSource, null>>("hash");
  const lastUrlSyncRef = useRef(0);
  const urlSyncTimeoutRef = useRef<TimeoutHandle | null>(null);
  const lastSyncedHrefRef = useRef<string | null>(null);

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

  const emitStepInitEvent = useCallback((id: string, visibility: number) => {
    if (typeof window === "undefined") {
      return;
    }
    const event = new CustomEvent("step_init_detected", {
      detail: {
        stepId: id,
        visibility,
        timestamp: new Date().toISOString(),
      },
    });
    window.dispatchEvent(event);
  }, []);

  const computeAndSetInitialStep = useCallback(() => {
    if (initializedRef.current) {
      return;
    }
    if (steps.length === 0) {
      return;
    }

    const viewportHeight = getViewportHeight(viewportScale);

    if (typeof window !== "undefined") {
      const detectedMode = resolveInitialUrlMode(window.location);
      if (detectedMode) {
        urlModeRef.current = detectedMode;
      }
    }

    const locationMatch = findInitialStepFromLocation(steps);
    let preferredStepId: string | null = null;
    if (locationMatch) {
      preferredStepId = locationMatch.step.id;
      urlModeRef.current = locationMatch.source;
      if (locationMatch.step.element) {
        scrollElementIntoViewWithMargin(locationMatch.step.element);
      }
    }

    let candidateId: string | null = null;
    let candidateRatio = -1;
    let candidateTop = Infinity;

    for (const step of steps) {
      const { ratio, top } = measureStepVisibility(step, viewportHeight);
      ratiosRef.current.set(step.id, ratio);

      if (preferredStepId && step.id === preferredStepId) {
        candidateId = step.id;
        candidateRatio = ratio;
        candidateTop = top;
        continue;
      }

      if (ratio > candidateRatio || (ratio === candidateRatio && ratio > 0 && top < candidateTop)) {
        candidateId = step.id;
        candidateRatio = ratio;
        candidateTop = top;
      }
    }

    if (preferredStepId) {
      candidateId = preferredStepId;
      candidateRatio = ratiosRef.current.get(preferredStepId) ?? candidateRatio;
    }

    if (!candidateId) {
      const first = steps[0];
      if (!first) {
        return;
      }
      candidateId = first.id;
      candidateRatio = ratiosRef.current.get(first.id) ?? 0;
    }

    initializedRef.current = true;
    emitStepInitEvent(candidateId, Math.max(0, candidateRatio ?? 0));
    commitActive(candidateId);
  }, [commitActive, emitStepInitEvent, steps, viewportScale]);

  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    if (steps.length === 0) {
      return;
    }

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        initialStepCleanupRef.current = null;
        computeAndSetInitialStep();
      });
      initialStepCleanupRef.current = () => cancelAnimationFrame(raf2);
    });

    return () => {
      cancelAnimationFrame(raf1);
      initialStepCleanupRef.current?.();
      initialStepCleanupRef.current = null;
    };
  }, [computeAndSetInitialStep, steps]);

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

  const activeStepElement = useMemo(() => {
    if (!activeStepId) {
      return null;
    }
    const match = steps.find((step) => step.id === activeStepId);
    return match?.element ?? null;
  }, [activeStepId, steps]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!initializedRef.current && !activeStepId) {
      return;
    }

    const currentStepId = activeStepId ?? null;
    const mode = urlModeRef.current;
    const url = new URL(window.location.href);

    if (mode === "query") {
      if (currentStepId) {
        url.searchParams.set(STEP_QUERY_PARAM, currentStepId);
      } else {
        url.searchParams.delete(STEP_QUERY_PARAM);
      }
      url.hash = "";
    } else {
      url.searchParams.delete(STEP_QUERY_PARAM);
      if (currentStepId) {
        const elementId = activeStepElement?.id?.trim();
        const normalized = elementId && elementId.length > 0 ? elementId : currentStepId;
        url.hash = normalized;
      } else {
        url.hash = "";
      }
    }

    const targetHref = url.toString();
    const targetPathname = url.pathname;
    const targetSearch = url.search;
    const targetHash = url.hash;
    const targetRelative = `${targetPathname}${targetSearch}${targetHash}` || targetPathname;

    const applySync = () => {
      urlSyncTimeoutRef.current = null;
      if (window.location.href !== targetHref) {
        try {
          window.history.replaceState(window.history.state, "", targetRelative);
        } catch {
          if (mode === "hash") {
            window.location.hash = targetHash;
          }
        }
      }
      lastSyncedHrefRef.current = targetHref;
      lastUrlSyncRef.current = Date.now();
    };

    if (targetHref === window.location.href) {
      lastSyncedHrefRef.current = targetHref;
      lastUrlSyncRef.current = Date.now();
      return () => undefined;
    }

    if (lastSyncedHrefRef.current === targetHref && !urlSyncTimeoutRef.current) {
      return () => undefined;
    }

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
    emitUrlSyncThrottled(currentStepId, remaining);
    urlSyncTimeoutRef.current = setTimeout(() => {
      applySync();
    }, remaining);

    return () => {
      if (urlSyncTimeoutRef.current) {
        clearTimeout(urlSyncTimeoutRef.current);
        urlSyncTimeoutRef.current = null;
      }
    };
  }, [activeStepElement, activeStepId]);

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
      rootMargin: resolvedRootMargin,
      threshold: [0, threshold],
    });

    for (const element of observed) {
      observer.observe(element);
    }

    return () => {
      observer.disconnect();
    };
  }, [handleIntersect, resolvedRootMargin, steps, threshold]);

  return { activeStepId } as const;
}
