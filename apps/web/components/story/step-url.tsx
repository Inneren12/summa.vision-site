"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

const STEP_HASH_PREFIX = "step-";
const STEP_QUERY_PARAM = "step";
const DEFAULT_THROTTLE_MS = 300;

export type StepUrlSource = "hash" | "query" | null;

export interface StepUrlParsingOptions {
  hashPrefix?: string;
  queryParam?: string;
}

export interface UseStepUrlSyncOptions extends StepUrlParsingOptions {
  activeStepId: string | null;
  /**
   * When the URL already contains a step identifier (via hash or query), this callback
   * is invoked with the parsed id so the caller can update their state accordingly.
   */
  onStepFromUrl?: (id: string) => void;
  /**
   * Force a particular mode when writing to the URL. When set to "auto" (default), the
   * hook respects the source used on load, or falls back to hash updates.
   */
  mode?: "hash" | "query" | "auto";
  throttleMs?: number;
}

export interface StepLocation {
  stepId: string | null;
  source: StepUrlSource;
}

export function parseStepFromHash(hash: string, prefix: string = STEP_HASH_PREFIX): string | null {
  if (!hash) return null;
  const cleaned = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!cleaned.startsWith(prefix)) return null;
  const raw = cleaned.slice(prefix.length);
  const decoded = decodeURIComponent(raw.trim());
  return decoded.length > 0 ? decoded : null;
}

export function parseStepFromSearch(
  search: string,
  queryParam: string = STEP_QUERY_PARAM,
): string | null {
  if (!search) return null;
  const cleaned = search.startsWith("?") ? search.slice(1) : search;
  if (!cleaned) return null;
  const params = new URLSearchParams(cleaned);
  const raw = params.get(queryParam);
  if (!raw) return null;
  const decoded = decodeURIComponent(raw.trim());
  return decoded.length > 0 ? decoded : null;
}

export function parseStepFromLocation(
  locationLike: Pick<Location, "hash" | "search">,
  options: StepUrlParsingOptions = {},
): StepLocation {
  const hashPrefix = options.hashPrefix ?? STEP_HASH_PREFIX;
  const queryParam = options.queryParam ?? STEP_QUERY_PARAM;
  const hashStep = parseStepFromHash(locationLike.hash ?? "", hashPrefix);
  if (hashStep) {
    return { stepId: hashStep, source: "hash" };
  }
  const queryStep = parseStepFromSearch(locationLike.search ?? "", queryParam);
  if (queryStep) {
    return { stepId: queryStep, source: "query" };
  }
  return { stepId: null, source: null };
}

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function buildUrlWithStep(
  current: URL,
  stepId: string | null,
  mode: Exclude<StepUrlSource, null>,
  options: StepUrlParsingOptions,
): string {
  const hashPrefix = options.hashPrefix ?? STEP_HASH_PREFIX;
  const queryParam = options.queryParam ?? STEP_QUERY_PARAM;
  if (mode === "query") {
    if (stepId) {
      current.searchParams.set(queryParam, stepId);
    } else {
      current.searchParams.delete(queryParam);
    }
    current.hash = "";
  } else {
    current.searchParams.delete(queryParam);
    current.hash = stepId ? `${hashPrefix}${encodeURIComponent(stepId)}` : "";
  }
  return current.toString();
}

function scrollStepIntoViewInternal(stepId: string, options: StepUrlParsingOptions = {}): void {
  if (typeof window === "undefined") return;
  const hashPrefix = options.hashPrefix ?? STEP_HASH_PREFIX;
  const targetId = `${hashPrefix}${stepId}`;
  const element = document.getElementById(targetId);
  if (!element) return;
  const behavior: ScrollBehavior = prefersReducedMotion() ? "auto" : "smooth";
  try {
    element.scrollIntoView({ behavior, block: "start" });
  } catch {
    // Older browsers may not support options; fall back to default behaviour.
    element.scrollIntoView();
  }
}

export function scrollStepIntoView(stepId: string, options: StepUrlParsingOptions = {}): void {
  scrollStepIntoViewInternal(stepId, options);
}

export function useStepUrlSync(options: UseStepUrlSyncOptions): void {
  const {
    activeStepId,
    onStepFromUrl,
    mode = "auto",
    throttleMs = DEFAULT_THROTTLE_MS,
    hashPrefix,
    queryParam,
  } = options;
  const parseOptions = useMemo<StepUrlParsingOptions>(
    () => ({ hashPrefix, queryParam }),
    [hashPrefix, queryParam],
  );
  const lastUpdateRef = useRef<number>(0);
  const lastSyncedStepRef = useRef<string | null>(null);
  const skipSyncRef = useRef<string | null>(null);
  const modeRef = useRef<Exclude<StepUrlSource, null>>(mode === "query" ? "query" : "hash");
  const hasInitialisedRef = useRef(false);
  const initialSourceRef = useRef<StepUrlSource>(null);
  const initialSyncSkippedRef = useRef(false);

  const handleLocationChange = useCallback(
    (fromPopState = false) => {
      if (typeof window === "undefined") return;
      const locationStep = parseStepFromLocation(window.location, parseOptions);
      if (!hasInitialisedRef.current) {
        initialSourceRef.current = locationStep.source;
      }
      if (locationStep.source) {
        modeRef.current = mode === "auto" ? locationStep.source : modeRef.current;
      } else if (mode === "query") {
        modeRef.current = "query";
      }
      if (locationStep.stepId) {
        skipSyncRef.current = locationStep.stepId;
        onStepFromUrl?.(locationStep.stepId);
        // Jump to the requested section. For popstate/hashchange we favour instant positioning.
        scrollStepIntoViewInternal(locationStep.stepId, parseOptions);
        if (fromPopState) {
          lastSyncedStepRef.current = locationStep.stepId;
        }
      } else if (fromPopState) {
        lastSyncedStepRef.current = null;
      }
    },
    [mode, onStepFromUrl, parseOptions],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    handleLocationChange(false);
    hasInitialisedRef.current = true;
  }, [handleLocationChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => handleLocationChange(true);
    const onHashChange = () => handleLocationChange(true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onHashChange);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onHashChange);
    };
  }, [handleLocationChange]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!hasInitialisedRef.current) return;
    if (skipSyncRef.current && skipSyncRef.current === activeStepId) {
      skipSyncRef.current = null;
      return;
    }
    if (!initialSyncSkippedRef.current && initialSourceRef.current === null) {
      initialSyncSkippedRef.current = true;
      lastSyncedStepRef.current = activeStepId;
      return;
    }
    const now = Date.now();
    if (now - lastUpdateRef.current < throttleMs && activeStepId === lastSyncedStepRef.current) {
      return;
    }
    const currentLocation = parseStepFromLocation(window.location, parseOptions);
    if (activeStepId === currentLocation.stepId) {
      lastSyncedStepRef.current = activeStepId;
      return;
    }
    const url = new URL(window.location.href);
    const resolvedMode = mode === "auto" ? modeRef.current : mode === "query" ? "query" : "hash";
    const nextHref = buildUrlWithStep(url, activeStepId, resolvedMode, parseOptions);
    if (nextHref === window.location.href) {
      lastSyncedStepRef.current = activeStepId;
      return;
    }
    window.history.replaceState(window.history.state, "", nextHref);
    lastUpdateRef.current = now;
    lastSyncedStepRef.current = activeStepId;
  }, [activeStepId, mode, parseOptions, throttleMs]);
}
