import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type RefObject,
} from "react";

import { useScrollyContext } from "./ScrollyContext";

const DEBOUNCE_DELAY_MS = 32;

export const SCROLLY_BINDING_ACTIVATE_EVENT = "scrolly:activate";

export interface ScrollyBindingHandlerOptions {
  readonly discrete: boolean;
}

export type ScrollyBindingHandler = (options: ScrollyBindingHandlerOptions) => void;

export type ScrollyBindingStatesMap = Record<string, ScrollyBindingHandler | undefined>;

export interface ScrollyBindingEventDetail {
  readonly stepId: string;
  readonly force?: boolean;
}

type PossibleRef<T> = RefObject<T> | MutableRefObject<T>;

interface ScheduleOptions {
  readonly force?: boolean;
}

function getPrefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }

  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function usePrefersReducedMotion(): boolean {
  const [matches, setMatches] = useState(() => getPrefersReducedMotion());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const handleChange = () => {
      setMatches(mediaQuery.matches);
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", handleChange);
      return () => {
        mediaQuery.removeEventListener("change", handleChange);
      };
    }

    if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(handleChange);
      return () => {
        mediaQuery.removeListener(handleChange);
      };
    }

    return undefined;
  }, []);

  return matches;
}

export function triggerScrollyBinding(
  target: EventTarget,
  detail: ScrollyBindingEventDetail,
): boolean {
  const event = new CustomEvent<ScrollyBindingEventDetail>(SCROLLY_BINDING_ACTIVATE_EVENT, {
    detail,
    bubbles: false,
  });

  return target.dispatchEvent(event);
}

export function useScrollyBinding<T extends EventTarget>(
  chartRef: PossibleRef<T | null>,
  statesMap: ScrollyBindingStatesMap,
): void {
  const { activeStepId } = useScrollyContext();
  const prefersReducedMotion = usePrefersReducedMotion();
  const discreteRef = useRef(prefersReducedMotion);
  const statesRef = useRef(statesMap);
  const previousStepRef = useRef<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  discreteRef.current = prefersReducedMotion;
  statesRef.current = statesMap;

  const clearScheduled = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runHandler = useCallback((stepId: string, options?: ScheduleOptions) => {
    const handler = statesRef.current[stepId];

    if (!handler) {
      return;
    }

    if (!options?.force && previousStepRef.current === stepId) {
      return;
    }

    previousStepRef.current = stepId;
    handler({ discrete: discreteRef.current });
  }, []);

  const schedule = useCallback(
    (stepId: string, options?: ScheduleOptions) => {
      clearScheduled();

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        runHandler(stepId, options);
      }, DEBOUNCE_DELAY_MS);
    },
    [clearScheduled, runHandler],
  );

  useEffect(() => {
    if (!activeStepId) {
      clearScheduled();
      return;
    }

    schedule(activeStepId);

    return clearScheduled;
  }, [activeStepId, clearScheduled, schedule]);

  useEffect(
    () => () => {
      clearScheduled();
    },
    [clearScheduled],
  );

  useEffect(() => {
    const element = chartRef.current;

    if (!element || typeof element.addEventListener !== "function") {
      return undefined;
    }

    const handleActivate = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }

      const detail = event.detail as ScrollyBindingEventDetail | undefined;

      if (!detail || typeof detail.stepId !== "string" || detail.stepId.length === 0) {
        return;
      }

      schedule(detail.stepId, { force: detail.force });
    };

    element.addEventListener(SCROLLY_BINDING_ACTIVATE_EVENT, handleActivate as EventListener);

    return () => {
      element.removeEventListener(SCROLLY_BINDING_ACTIVATE_EVENT, handleActivate as EventListener);
    };
  }, [chartRef, schedule]);
}
